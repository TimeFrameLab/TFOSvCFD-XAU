#!/bin/bash
# CANCEL CLI: read-only listing unless an explicit side and order ID are supplied.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
BASE_URL="https://api.bitkub.com"

usage() {
  echo 'Usage: ./cancel.sh "CANCEL/BTC"'
  echo '       ./cancel.sh "CANCEL/BTC/SELL/ID=123456"'
  echo '       ./cancel.sh "CANCEL/BTC/BUY/ID=123456"'
}

[[ $# -eq 1 ]] || { usage; exit 1; }
CMD="$1"
shopt -s nocasematch
if [[ "$CMD" =~ ^CANCEL/([A-Z0-9]+)(/(SELL|BUY)/ID=([A-Z0-9]+))?$ ]]; then
  COIN="${BASH_REMATCH[1]}"
  SIDE="${BASH_REMATCH[3]:-}"
  ORDER_ID="${BASH_REMATCH[4]:-}"
else
  shopt -u nocasematch
  echo '❌ รูปแบบคำสั่งไม่ถูกต้อง' >&2
  usage
  exit 1
fi
shopt -u nocasematch

[[ -f "$ENV_FILE" ]] || { echo "❌ ไม่พบไฟล์ .env: $ENV_FILE" >&2; exit 1; }
API_KEY=""
API_SECRET=""
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^[[:space:]]*(#|$) ]] && continue
  [[ "$line" == *=* ]] || continue
  key="${line%%=*}"
  value="${line#*=}"
  value="${value%$'\r'}"
  case "$key" in
    BITKUB_API_KEY) API_KEY="$value" ;;
    BITKUB_API_SECRET) API_SECRET="$value" ;;
  esac
done < "$ENV_FILE"
[[ -n "$API_KEY" && -n "$API_SECRET" ]] || { echo '❌ กรุณาตั้งค่า BITKUB_API_KEY และ BITKUB_API_SECRET ใน .env' >&2; exit 1; }

sign() { printf '%s' "$1" | openssl dgst -sha256 -hmac "$API_SECRET" | awk '{print $NF}'; }

# Validate the complete Open Orders response before printing options or allowing cancellation.
fetch_open_orders() {
  local ts query signature response status
  ts=$(curl -fsS "$BASE_URL/api/v3/servertime") || { echo '❌ อ่านเวลา Bitkub ไม่สำเร็จ' >&2; return 1; }
  [[ "$ts" =~ ^[0-9]+$ ]] || { echo '❌ เวลา Bitkub ไม่ถูกต้อง' >&2; return 1; }
  query="?sym=${COIN}_thb"
  signature=$(sign "${ts}GET/api/v3/market/my-open-orders${query}")
  response=$(curl -sS -w $'\n%{http_code}' "$BASE_URL/api/v3/market/my-open-orders${query}" \
    -H 'Accept: application/json' -H "X-BTK-APIKEY: $API_KEY" \
    -H "X-BTK-TIMESTAMP: $ts" -H "X-BTK-SIGN: $signature") || {
      echo '❌ อ่าน Open Orders ไม่สำเร็จ (transport error)' >&2; return 1;
    }
  status="${response##*$'\n'}"
  response="${response%$'\n'*}"
  OPEN_JSON="$response" OPEN_STATUS="$status" COIN="$COIN" python3 - <<'PY'
import json, os, sys
status, raw, coin = os.environ['OPEN_STATUS'], os.environ['OPEN_JSON'], os.environ['COIN']
try:
    data = json.loads(raw)
except json.JSONDecodeError as exc:
    sys.exit(f'❌ Open Orders JSON ไม่ถูกต้อง (HTTP {status}): {exc}')
if not status.isdigit() or not 200 <= int(status) < 300:
    sys.exit(f"❌ Open Orders HTTP status {status}; Bitkub error code: {data.get('error', 'unavailable') if isinstance(data,dict) else 'invalid response'}")
if not isinstance(data, dict) or str(data.get('error', 'unavailable')) != '0':
    sys.exit(f"❌ Bitkub Open Orders error code: {data.get('error', 'invalid response') if isinstance(data,dict) else 'invalid response'}")
orders = data.get('result')
if not isinstance(orders, list):
    sys.exit('❌ Open Orders ไม่มี result ที่เป็นรายการ')
normalized = []
for i, o in enumerate(orders):
    if not isinstance(o, dict):
        sys.exit(f'❌ Open Orders รายการที่ {i+1} มีข้อมูลไม่ครบ/ผิดรูปแบบ')
    side = str(o.get('sd', o.get('side', ''))).lower()
    if side not in ('buy', 'sell'):
        sys.exit(f'❌ Open Orders รายการที่ {i+1} ไม่มี side BUY/SELL ที่ถูกต้อง')
    oid = o.get('id')
    kind = o.get('typ', o.get('type'))
    price = o.get('rat', o.get('rate'))
    amount = o.get('amt', o.get('amount'))
    if oid is None or not str(oid).isalnum() or kind is None or not str(kind).strip() or amount is None or not str(amount).strip():
        sys.exit(f'❌ Open Orders รายการที่ {i+1} ขาด order_id/ประเภท/ราคา/ปริมาณ')
    kind = str(kind).strip()
    if kind.lower() == 'market':
        price = 'Market'
    elif price is None or not str(price).strip():
        sys.exit(f'❌ Open Orders รายการที่ {i+1} ขาด order_id/ประเภท/ราคา/ปริมาณ')
    normalized.append({'id': str(oid), 'side': side, 'type': kind, 'price': str(price), 'amount': str(amount)})
print(json.dumps(normalized, separators=(',', ':')))
PY
}

if ! OPEN_ORDERS="$(fetch_open_orders)"; then exit 1; fi

if [[ -z "$SIDE" ]]; then
  OPEN_ORDERS="$OPEN_ORDERS" COIN="$COIN" python3 - <<'PY'
import json, os
orders = json.loads(os.environ['OPEN_ORDERS'])
print(f"Open Orders {os.environ['COIN']}_THB — {len(orders)} รายการ")
if not orders:
    print('ไม่พบคำสั่ง BUY/SELL ที่ยังเปิดอยู่')
for o in orders:
    print(f"ID={o['id']} | {o['side'].upper()} | {o['type']} | ราคา {o['price']} | ปริมาณ {o['amount']}")
    print(f"เสนอคำสั่ง: CANCEL/{os.environ['COIN']}/{o['side'].upper()}/ID={o['id']}")
PY
  exit 0
fi

MATCH="$(OPEN_ORDERS="$OPEN_ORDERS" SIDE="$SIDE" ORDER_ID="$ORDER_ID" python3 - <<'PY'
import json, os, sys
orders = json.loads(os.environ['OPEN_ORDERS'])
match = next((o for o in orders if o['id'] == os.environ['ORDER_ID'] and o['side'] == os.environ['SIDE'].lower()), None)
if not match:
    sys.exit(f"❌ ไม่พบ Order ID={os.environ['ORDER_ID']} ฝั่ง {os.environ['SIDE']} ใน Open Orders ปัจจุบัน จึงไม่ส่งคำขอยกเลิก")
print(json.dumps(match, separators=(',', ':')))
PY
)" || exit 1

TS=$(curl -fsS "$BASE_URL/api/v3/servertime") || { echo '❌ ดึงเวลา Bitkub ไม่สำเร็จ จึงไม่ส่งคำขอยกเลิก' >&2; exit 1; }
[[ "$TS" =~ ^[0-9]+$ ]] || { echo '❌ เวลา Bitkub ไม่ถูกต้อง จึงไม่ส่งคำขอยกเลิก' >&2; exit 1; }
# COIN is passed explicitly to keep the signed body identical to the transmitted body.
BODY="$(COIN="$COIN" ORDER_ID="$ORDER_ID" SIDE="$SIDE" python3 -c 'import json,os; print(json.dumps({"sym":os.environ["COIN"].lower()+"_thb","id":os.environ["ORDER_ID"],"sd":os.environ["SIDE"].lower()},separators=(",",":")))')"
SIGNATURE=$(sign "${TS}POST/api/v3/market/cancel-order${BODY}")
echo "ส่งคำขอยกเลิก ID=$ORDER_ID | $SIDE | ${COIN}_THB"
if ! CANCEL_RESULT=$(curl -sS -w $'\n%{http_code}' "$BASE_URL/api/v3/market/cancel-order" -X POST \
  -H 'Accept: application/json' -H 'Content-Type: application/json' \
  -H "X-BTK-APIKEY: $API_KEY" -H "X-BTK-TIMESTAMP: $TS" \
  -H "X-BTK-SIGN: $SIGNATURE" -d "$BODY"); then
  echo "❌ ส่งคำขอยกเลิกไม่สำเร็จสำหรับ ID=$ORDER_ID (transport error)" >&2
  exit 1
fi
CANCEL_STATUS="${CANCEL_RESULT##*$'\n'}"
CANCEL_JSON="${CANCEL_RESULT%$'\n'*}"
if ! CANCEL_JSON="$CANCEL_JSON" CANCEL_STATUS="$CANCEL_STATUS" python3 - <<'PY'
import json, os, sys
try: r=json.loads(os.environ['CANCEL_JSON'])
except Exception: sys.exit(f"❌ คำตอบ Cancel API ไม่ใช่ JSON (HTTP {os.environ['CANCEL_STATUS']})")
if not os.environ['CANCEL_STATUS'].isdigit() or not 200 <= int(os.environ['CANCEL_STATUS']) < 300 or not isinstance(r,dict) or str(r.get('error','unavailable')) != '0':
    sys.exit(f"❌ Cancel API ไม่สำเร็จ | HTTP {os.environ['CANCEL_STATUS']} | Bitkub error code: {r.get('error','invalid response') if isinstance(r,dict) else 'invalid response'}")
PY
then
  exit 1
fi

if ! AFTER="$(fetch_open_orders)"; then
  echo "⚠️ ส่งคำขอแล้ว แต่ตรวจ Open Orders ซ้ำไม่สำเร็จสำหรับ ID=$ORDER_ID" >&2
  exit 1
fi
AFTER="$AFTER" ORDER_ID="$ORDER_ID" SIDE="$SIDE" python3 - <<'PY'
import json, os
orders=json.loads(os.environ['AFTER'])
still=any(o['id']==os.environ['ORDER_ID'] and o['side']==os.environ['SIDE'].lower() for o in orders)
print(f"{'⚠️ ยังพบคำสั่งเปิดอยู่' if still else '✅ ไม่พบคำสั่งใน Open Orders แล้ว'} | ID={os.environ['ORDER_ID']} | {os.environ['SIDE']}")
PY
