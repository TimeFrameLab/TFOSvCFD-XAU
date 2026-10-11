#!/bin/bash
# ============================================================
# trade.sh — Bitkub Order CLI
# Usage:
#   BUY  market : ./trade.sh "BUY/BTC/L=M/1000"
#   BUY  limit  : ./trade.sh "BUY/BTC/L=2000000/1000"
#   SELL market : ./trade.sh "SELL/BTC/L=M/100%"
#   SELL limit  : ./trade.sh "SELL/BTC/L=2000000/100%"
#   Balance     : ./trade.sh "MONEY"
#   Target price: ./trade.sh "TARGET/BTC"
# CANDIDATE is a read-only report; its table schema is documented in README.md
# and TimeFrame-OS-guidelines-and-model-vX.md and includes a live Liquidity value.
# Trade confirmation output is separate from the CANDIDATE report table.
# ============================================================
set -e

# โหลด .env
ENV_FILE="$(dirname "$0")/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ ไม่พบไฟล์ .env"
  echo ""
  echo "� ตัวอย่างเนื้อหาในไฟล์ .env:"
  echo "# Reference Sheet URL (Google Sheets)"
  echo "REF_SHEET_URL=https://..."
  echo ""
  echo "# Bitkub API Credentials (สำหรับฟีเจอร์การซื้อขาย)"
  echo "BITKUB_API_KEY=your_api_key_here"
  echo "BITKUB_API_SECRET=your_api_secret_here"
  echo ""
  echo "�💡 กำลังสร้างไฟล์ .env จาก .env.example..."
  cp "$(dirname "$0")/.env.example" "$ENV_FILE"
  echo "✅ สร้างไฟล์ .env เรียบร้อยแล้ว"
  echo "� ไฟล์: $ENV_FILE"
  echo "�💡 กรุณาแก้ไขไฟล์ .env และใส่ค่าจริงก่อนรันใหม่"
  exit 1
fi
export $(grep -v '^#' "$ENV_FILE" | xargs)

API_KEY="${BITKUB_API_KEY}"
API_SECRET="${BITKUB_API_SECRET}"
BASE_URL="https://api.bitkub.com"

if [[ -z "$API_KEY" || -z "$API_SECRET" ]]; then
  echo "❌ กรุณาตั้งค่า BITKUB_API_KEY และ BITKUB_API_SECRET ใน .env"
  exit 1
fi

CMD="$1"
if [[ -z "$CMD" ]]; then
  echo "Usage: ./trade.sh \"BUY/BTC/L=M/1000\""
  echo "       ./trade.sh \"BUY/BTC/L=2000000/1000\""
  echo "       ./trade.sh \"SELL/BTC/L=M/100%\""
  echo "       ./trade.sh \"SELL/BTC/L=2000000/100%\""
  echo "       ./trade.sh \"MONEY\""
  echo "       ./trade.sh \"TARGET/BTC\""
  exit 1
fi

# --- Signature helper ---
sign() {
  echo -n "$1" | openssl dgst -sha256 -hmac "$API_SECRET" | awk '{print $NF}'
}

# Read TIER from the same current REF Sheet row used by PORTFOLIO.
get_tier_for_coin() {
  local coin="$1" sheet_id tier_dir tier_file tier_value
  if [[ -z "$REF_SHEET_URL" ]]; then
    echo "ไม่พบ REF_SHEET_URL ใน .env" >&2
    return 1
  fi
  sheet_id=$(echo "$REF_SHEET_URL" | sed -n 's|.*/d/\([^/]*\).*|\1|p')
  if [[ -z "$sheet_id" ]]; then
    echo "REF_SHEET_URL ไม่มี Sheet ID ที่ถูกต้อง" >&2
    return 1
  fi
  tier_dir=$(mktemp -d) || return 1
  tier_file="$tier_dir/reference.xlsx"
  if ! curl -fsSL "https://docs.google.com/spreadsheets/d/$sheet_id/export?format=xlsx" -o "$tier_file"; then
    rm -rf "$tier_dir"
    echo "ดาวน์โหลด REF Sheet เพื่ออ่าน TIER ไม่สำเร็จ" >&2
    return 1
  fi
  if tier_value=$(TIER_FILE="$tier_file" COIN="$coin" python3 -c '
import os, re, sys
from zipfile import BadZipFile
import openpyxl
try:
    workbook = openpyxl.load_workbook(os.environ["TIER_FILE"], read_only=True, data_only=True)
    sheet = workbook["All-Bitkub-BATCH"]
    headers = [str(value).strip().upper() if value is not None else "" for value in next(sheet.iter_rows(min_row=1, max_row=1, values_only=True))]
    coin_col = headers.index("AKA")
    tier_col = headers.index("TIER")
    tier_value = None
    for row in sheet.iter_rows(min_row=2, values_only=True):
        if coin_col >= len(row) or tier_col >= len(row):
            continue
        if str(row[coin_col] or "").strip().upper() != os.environ["COIN"]:
            continue
        match = re.fullmatch(r"T?([1-4])(?:\.0+)?", str(row[tier_col] or "").strip().upper())
        if match:
            tier_value = match.group(1)
    if tier_value is not None:
        print(tier_value)
        sys.exit(0)
except (OSError, KeyError, StopIteration, ValueError, BadZipFile, openpyxl.utils.exceptions.InvalidFileException) as exc:
    print(f"อ่าน REF Sheet หรือ AKA/TIER ไม่สำเร็จ: {exc}", file=sys.stderr)
    sys.exit(1)
print("ไม่พบ TIER 1-4 ของเหรียญใน REF Sheet", file=sys.stderr)
sys.exit(1)
'); then
    rm -rf "$tier_dir"
    printf '%s\n' "$tier_value"
    return 0
  fi
  rm -rf "$tier_dir"
  return 1
}

# Read the current price precision and tick size for a THB trading pair.
get_price_rules_for_coin() {
  local coin="$1" response status
  if ! response=$(curl -sS -w $'\n%{http_code}' "$BASE_URL/api/v3/market/symbols"); then
    echo "ดึง Bitkub Symbols API ไม่สำเร็จ" >&2
    return 1
  fi
  status="${response##*$'\n'}"
  response="${response%$'\n'*}"
  SYMBOLS_JSON="$response" SYMBOLS_HTTP_STATUS="$status" COIN="$coin" python3 -c '
import json
import os
import sys
from decimal import Decimal, InvalidOperation

status = os.environ["SYMBOLS_HTTP_STATUS"]
try:
    response = json.loads(os.environ["SYMBOLS_JSON"])
except json.JSONDecodeError:
    print(f"Bitkub Symbols API ตอบ JSON ไม่ถูกต้อง (HTTP status: {status})", file=sys.stderr)
    sys.exit(1)
if (
    not isinstance(response, dict)
    or not status.isdigit()
    or not 200 <= int(status) < 300
    or str(response.get("error", "unavailable")) != "0"
):
    error = response.get("error", "unavailable") if isinstance(response, dict) else "invalid response"
    print(f"Bitkub Symbols API error (HTTP status: {status}, Bitkub error code: {error})", file=sys.stderr)
    sys.exit(1)
symbols = response.get("result", response.get("data"))
if not isinstance(symbols, list):
    print("Bitkub Symbols API ไม่มีรายการคู่เทรดที่ถูกต้อง", file=sys.stderr)
    sys.exit(1)
symbol = next(
    (
        item for item in symbols
        if isinstance(item, dict) and str(item.get("symbol", "")).upper() == os.environ["COIN"] + "_THB"
    ),
    None,
)
if symbol is None:
    print("ไม่พบคู่ {}_THB ใน Bitkub Symbols API".format(os.environ["COIN"]), file=sys.stderr)
    sys.exit(1)
try:
    scale_text = str(symbol["price_scale"])
    if not scale_text.isdigit():
        raise ValueError("price_scale is not a non-negative integer")
    scale = int(scale_text)
    step = Decimal(str(symbol["price_step"]))
    if not step.is_finite() or step <= 0 or step.normalize().as_tuple().exponent < -scale:
        raise ValueError("price_step is invalid for price_scale")
except (KeyError, InvalidOperation, ValueError) as exc:
    print("ข้อมูล price_scale/price_step ของคู่ {}_THB ไม่ถูกต้อง: {}".format(os.environ["COIN"], exc), file=sys.stderr)
    sys.exit(1)
print("{}\t{}\t{}".format(symbol.get("source") or "Unknown", scale, format(step, "f")))
'
}

# ============================================================
# MONEY — ตรวจยอดเงินบาทคงเหลือ
# ============================================================
CMD_UPPER=$(echo "$CMD" | tr '[:lower:]' '[:upper:]')
if [[ "$CMD_UPPER" == "MONEY" ]]; then
  TS=$(curl -s "$BASE_URL/api/v3/servertime")
  QUERY="?symbol=THB"
  SIGN=$(sign "${TS}GET/api/v4/wallet/balances${QUERY}")
  RESP=$(curl -s "$BASE_URL/api/v4/wallet/balances${QUERY}" \
    -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    -H "X-BTK-APIKEY: $API_KEY" \
    -H "X-BTK-TIMESTAMP: $TS" \
    -H "X-BTK-SIGN: $SIGN")
  echo "$RESP" | python3 -c "
import sys, json
r = json.load(sys.stdin)
data = r.get('data', r.get('result', []))
thb = next((x for x in data if x.get('currency','').upper() == 'THB'), None)
if thb:
    avail    = float(thb.get('available', 0))
    reserved = float(thb.get('reserved', 0))
    total    = float(thb.get('total', 0))
    print(f'💰 THB Balance')
    print(f'   Available : {avail:>15,.2f} THB')
    print(f'   Reserved  : {reserved:>15,.2f} THB')
    print(f'   Total     : {total:>15,.2f} THB')
else:
    print(f'❌ ไม่พบข้อมูล THB: {r}')
"
  exit 0
fi

# ============================================================
# TARGET — คำนวณราคาเป้าหมายจากเหรียญที่ถืออยู่
# ============================================================
if [[ "$CMD_UPPER" == TARGET/* ]]; then
  COIN="${CMD#*/}"
  COIN=$(echo "$COIN" | tr '[:lower:]' '[:upper:]')
  if [[ -z "$COIN" || ! "$COIN" =~ ^[A-Z0-9]+$ ]]; then
    echo "❌ รูปแบบคำสั่งไม่ถูกต้อง ใช้ ./trade.sh \"TARGET/BTC\""
    exit 1
  fi

  TS_TARGET=$(curl -sS "$BASE_URL/api/v3/servertime") || {
    echo "❌ ตรวจสอบพอร์ตไม่สำเร็จ | HTTP status code: unavailable | Bitkub error code: unavailable"
    exit 1
  }
  if ! [[ "$TS_TARGET" =~ ^[0-9]+$ ]]; then
    echo "❌ ตรวจสอบพอร์ตไม่สำเร็จ | HTTP status code: unavailable | Bitkub error code: unavailable (invalid server time)"
    exit 1
  fi

  BALANCE_QUERY="?symbol=${COIN}"
  BALANCE_SIGN=$(sign "${TS_TARGET}GET/api/v4/wallet/balances${BALANCE_QUERY}")
  if ! BALANCE_WITH_STATUS=$(curl -sS -w $'\n%{http_code}' "$BASE_URL/api/v4/wallet/balances${BALANCE_QUERY}" \
    -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    -H "X-BTK-APIKEY: $API_KEY" \
    -H "X-BTK-TIMESTAMP: $TS_TARGET" \
    -H "X-BTK-SIGN: $BALANCE_SIGN"); then
    echo "❌ ตรวจสอบพอร์ตไม่สำเร็จ | HTTP status code: unavailable | Bitkub error code: unavailable"
    exit 1
  fi
  BALANCE_HTTP_STATUS="${BALANCE_WITH_STATUS##*$'\n'}"
  BALANCE_RESP="${BALANCE_WITH_STATUS%$'\n'*}"
  if ! BALANCE_FIELDS=$(BALANCE_JSON="$BALANCE_RESP" BALANCE_HTTP_STATUS="$BALANCE_HTTP_STATUS" COIN="$COIN" python3 -c "
import json, os, sys
status = os.environ['BALANCE_HTTP_STATUS']
try:
    response = json.loads(os.environ['BALANCE_JSON'])
except json.JSONDecodeError:
    print(f\"❌ ตรวจสอบพอร์ตไม่สำเร็จ | HTTP status code: {status} | Bitkub error code: unavailable (invalid JSON)\", file=sys.stderr)
    sys.exit(1)
if not isinstance(response, dict):
    print(f\"❌ ตรวจสอบพอร์ตไม่สำเร็จ | HTTP status code: {status} | Bitkub error code: unavailable (invalid response)\", file=sys.stderr)
    sys.exit(1)
error = response.get('error', 0)
if not status.isdigit() or not 200 <= int(status) < 300 or str(error) != '0':
    print(f\"❌ ตรวจสอบพอร์ตไม่สำเร็จ | HTTP status code: {status} | Bitkub error code: {error}\", file=sys.stderr)
    sys.exit(1)
balances = response.get('data', response.get('result'))
if not isinstance(balances, list):
    print(f\"❌ ตรวจสอบพอร์ตไม่สำเร็จ | HTTP status code: {status} | Bitkub error code: invalid balance response\", file=sys.stderr)
    sys.exit(1)
row = next((item for item in balances if isinstance(item, dict) and str(item.get('currency', '')).upper() == os.environ['COIN']), None)
if row is None:
    print('0\\t0\\t0')
    sys.exit(0)
try:
    if row.get('available') is None or row.get('reserved') is None:
        raise ValueError('missing available/reserved balance fields')
    available = float(row.get('available', 0))
    reserved = float(row.get('reserved', 0))
    total = float(row.get('total', available + reserved))
except (TypeError, ValueError):
    print(f\"❌ ตรวจสอบพอร์ตไม่สำเร็จ | HTTP status code: {status} | Bitkub error code: invalid balance values\", file=sys.stderr)
    sys.exit(1)
if min(available, reserved, total) < 0:
    print(f\"❌ ตรวจสอบพอร์ตไม่สำเร็จ | HTTP status code: {status} | Bitkub error code: invalid negative balance\", file=sys.stderr)
    sys.exit(1)
print(f'{available}\\t{reserved}\\t{total}')
"); then
    exit 1
  fi
  IFS=$'\t' read -r AVAILABLE RESERVED TOTAL <<< "$BALANCE_FIELDS"
  if ! python3 -c "import sys; sys.exit(0 if float(sys.argv[1]) > 0 else 1)" "$AVAILABLE"; then
    if python3 -c "import sys; sys.exit(0 if float(sys.argv[1]) > 0 else 1)" "$TOTAL"; then
      echo "⚠️ พบ $COIN ในพอร์ต แต่ยอดพร้อมขายเป็น 0 (reserved: $RESERVED)"
      echo "ยกเลิก/รอคำสั่งที่กันยอดไว้ก่อน แล้วรัน TARGET ใหม่"
    else
      echo "⚠️ อาจไม่มี $COIN อยู่ในพอร์ต (available: 0, total: 0)"
      echo "HTTP status code: $BALANCE_HTTP_STATUS | Bitkub error code: 0"
    fi
    exit 0
  fi

  if ! TIER=$(get_tier_for_coin "$COIN" 2>&1); then
    echo "❌ คำนวณ Target ไม่ได้: $TIER"
    echo "ตรวจ REF_SHEET_URL/Tier ใน Portfolio แล้วใช้คำสั่ง SELL ระบุราคาเองได้"
    exit 1
  fi

  if ! PRICE_RULES=$(get_price_rules_for_coin "$COIN" 2>&1); then
    echo "❌ คำนวณ Target ไม่ได้ เพราะอ่านข้อกำหนดราคา Limit ของคู่ ${COIN}_THB ไม่สำเร็จ: $PRICE_RULES"
    exit 1
  fi
  IFS=$'\t' read -r SOURCE PRICE_SCALE PRICE_STEP <<< "$PRICE_RULES"

  HISTORY_ROWS='[]'
  HISTORY_PAGE=1
  HISTORY_ERROR=""
  HISTORY_HTTP_STATUS="unavailable"
  HISTORY_API_ERROR="unavailable"
  while true; do
    TS_HISTORY=$(curl -sS "$BASE_URL/api/v3/servertime") || {
      HISTORY_ERROR="เวลา Bitkub ไม่พร้อมใช้งาน"
      break
    }
    if ! [[ "$TS_HISTORY" =~ ^[0-9]+$ ]]; then
      HISTORY_ERROR="เวลา Bitkub ไม่ถูกต้อง"
      break
    fi
    HISTORY_QUERY="?sym=${COIN}_THB&p=${HISTORY_PAGE}&lmt=100"
    HISTORY_SIGN=$(sign "${TS_HISTORY}GET/api/v3/market/my-order-history${HISTORY_QUERY}")
    if ! HISTORY_WITH_STATUS=$(curl -sS -w $'\n%{http_code}' "$BASE_URL/api/v3/market/my-order-history${HISTORY_QUERY}" \
      -H "Accept: application/json" \
      -H "Content-Type: application/json" \
      -H "X-BTK-APIKEY: $API_KEY" \
      -H "X-BTK-TIMESTAMP: $TS_HISTORY" \
      -H "X-BTK-SIGN: $HISTORY_SIGN"); then
      HISTORY_ERROR="HTTP status code: unavailable; Bitkub error code: unavailable"
      break
    fi
    HISTORY_HTTP_STATUS="${HISTORY_WITH_STATUS##*$'\n'}"
    HISTORY_RESP="${HISTORY_WITH_STATUS%$'\n'*}"
    if ! HISTORY_META=$(HISTORY_JSON="$HISTORY_RESP" HISTORY_HTTP_STATUS="$HISTORY_HTTP_STATUS" HISTORY_ROWS="$HISTORY_ROWS" python3 -c "
import json, os, sys
status = os.environ['HISTORY_HTTP_STATUS']
try:
    response = json.loads(os.environ['HISTORY_JSON'])
except json.JSONDecodeError:
    print(f\"HTTP status code: {status}; Bitkub error code: unavailable (invalid JSON)\", file=sys.stderr)
    sys.exit(1)
if not isinstance(response, dict):
    print(f\"HTTP status code: {status}; Bitkub error code: unavailable (invalid response)\", file=sys.stderr)
    sys.exit(1)
error = response.get('error', 'unavailable')
if not status.isdigit() or not 200 <= int(status) < 300 or str(error) != '0':
    print(f\"HTTP status code: {status}; Bitkub error code: {error}\", file=sys.stderr)
    sys.exit(1)
rows = response.get('result')
if not isinstance(rows, list):
    print(f\"HTTP status code: {status}; Bitkub error code: invalid order-history response\", file=sys.stderr)
    sys.exit(1)
try:
    existing = json.loads(os.environ['HISTORY_ROWS'])
except json.JSONDecodeError:
    print('Invalid accumulated order history', file=sys.stderr)
    sys.exit(1)
existing.extend(rows)
pagination = response.get('pagination', {})
last = pagination.get('last', response.get('pagination', {}).get('page', 1)) if isinstance(pagination, dict) else 1
try:
    last = int(last or 1)
except (TypeError, ValueError):
    last = 1
print(json.dumps(existing, separators=(',', ':')) + '\\t' + str(last))
" 2>&1); then
      HISTORY_ERROR="$HISTORY_META"
      break
    fi
    HISTORY_ROWS="${HISTORY_META%$'\t'*}"
    HISTORY_LAST="${HISTORY_META##*$'\t'}"
    HISTORY_API_ERROR="0"
    if (( HISTORY_PAGE >= HISTORY_LAST )); then
      break
    fi
    HISTORY_PAGE=$((HISTORY_PAGE + 1))
  done
  if [[ -n "$HISTORY_ERROR" ]]; then
    echo "❌ มี $COIN ในพอร์ต (available: $AVAILABLE) แต่คำนวณต้นทุนจาก Order History ไม่ได้"
    echo "Order History $HISTORY_ERROR"
    echo "อาจเป็น Broker Coin (เช่น error 61), เหรียญโอนเข้า หรือ API ขัดข้อง"
    echo "แนะนำตรวจสอบต้นทุนจากแหล่งที่มา แล้วระบุราคาขายเองด้วย ./trade.sh \"SELL/$COIN/L=<ราคา>/100%\""
    exit 1
  fi

  HISTORY_JSON="$HISTORY_ROWS" BALANCE_AVAILABLE="$AVAILABLE" BALANCE_RESERVED="$RESERVED" \
    BALANCE_TOTAL="$TOTAL" TIER="$TIER" COIN="$COIN" SOURCE="$SOURCE" \
    PRICE_SCALE="$PRICE_SCALE" PRICE_STEP="$PRICE_STEP" \
    HISTORY_HTTP_STATUS="$HISTORY_HTTP_STATUS" HISTORY_API_ERROR="$HISTORY_API_ERROR" python3 - <<'PY'
import json
import os
from decimal import Decimal, InvalidOperation, ROUND_CEILING

rates = {
    1: Decimal("0.0825"),
    2: Decimal("0.0725"),
    3: Decimal("0.0675"),
    4: Decimal("0.0575"),
}
coin = os.environ["COIN"]
tier = int(os.environ["TIER"])
try:
    orders = json.loads(os.environ["HISTORY_JSON"])
    available = Decimal(os.environ["BALANCE_AVAILABLE"])
    reserved = Decimal(os.environ["BALANCE_RESERVED"])
    total = Decimal(os.environ["BALANCE_TOTAL"])
except (KeyError, json.JSONDecodeError, InvalidOperation, ValueError) as exc:
    raise SystemExit(f"❌ ข้อมูลพอร์ตหรือประวัติไม่ถูกต้อง: {exc}")

buys = []
for order in orders:
    if not isinstance(order, dict) or str(order.get("side", "")).lower() != "buy":
        continue
    try:
        amount = Decimal(str(order["amount"]))
        rate = Decimal(str(order["rate"]))
        fee = Decimal(str(order["fee"]))
        credit = Decimal(str(order["credit"]))
    except (KeyError, InvalidOperation, TypeError):
        raise SystemExit("❌ ข้อมูล BUY ใน Order History ไม่ครบหรือไม่ถูกต้อง; ไม่สามารถคำนวณ Target Price")
    if amount <= 0 or rate <= 0 or fee < 0 or credit < 0 or credit > fee:
        raise SystemExit("❌ พบข้อมูล amount/rate/fee/credit ที่ไม่สมเหตุสมผล; ไม่สามารถคำนวณ Target Price")
    quantity = (amount - fee + credit) / rate
    if quantity <= 0:
        raise SystemExit("❌ จำนวนเหรียญสุทธิหลังหักค่าธรรมเนียมไม่เป็นบวก; ไม่สามารถคำนวณ Target Price")
    buys.append((quantity, amount))

if not buys:
    print(f"Order History HTTP status code: {os.environ['HISTORY_HTTP_STATUS']} | Bitkub error code: {os.environ['HISTORY_API_ERROR']}")
    raise SystemExit("❌ มีเหรียญในพอร์ต แต่ไม่พบประวัติ BUY ที่ใช้คำนวณต้นทุนได้ (อาจเป็น Broker Coin/error 61 หรือเหรียญโอนเข้า)\nตรวจสอบต้นทุนจากแหล่งที่มา แล้วใช้คำสั่ง SELL ระบุราคาเอง")

total_quantity = sum((quantity for quantity, _ in buys), Decimal("0"))
total_cost = sum((cost for _, cost in buys), Decimal("0"))
if total_quantity <= 0 or total_cost <= 0:
    raise SystemExit("❌ ต้นทุนรวม/จำนวน BUY ไม่ถูกต้อง; ไม่สามารถคำนวณ Target Price")

average_cost = total_cost / total_quantity
target_price = average_cost * (Decimal("1") + rates[tier])
try:
    scale = int(os.environ["PRICE_SCALE"])
    step = Decimal(os.environ["PRICE_STEP"])
    target_price = (target_price / step).to_integral_value(rounding=ROUND_CEILING) * step
    target_price = target_price.quantize(Decimal(1).scaleb(-scale))
except (KeyError, InvalidOperation, ValueError):
    raise SystemExit("❌ ข้อกำหนด price_scale/price_step ของคู่เทรดไม่ถูกต้อง; ไม่สามารถแนะนำราคา Limit")
target_text = format(target_price, f".{scale}f")
print(f"AKA: {coin}")
print(f"TIER: {tier}")
print(f"Source: {os.environ['SOURCE'].strip().capitalize()}")
print(f"ยอดพร้อมขาย: {available} {coin} (reserved: {reserved}, total: {total})")
print(f"ต้นทุนเฉลี่ยรวมค่าธรรมเนียม: {format(average_cost, 'f')} THB/{coin}")
print(f"%Target Price: T1=8.25%, T2=7.25%, T3=6.75%, T4=5.75%")
print(f"Target Price T{tier}: {target_text} THB")
print("คำสั่งแนะนำ (ยังไม่ได้ส่ง):")
print(f'"SELL/{coin}/L={target_text}/100%"')
PY
  exit $?
fi

# --- Parse BUY/SELL command ---
IFS='/' read -r SIDE COIN RATE_PART AMOUNT_PART <<< "$CMD"
SIDE=$(echo "$SIDE" | tr '[:lower:]' '[:upper:]')
COIN=$(echo "$COIN" | tr '[:lower:]' '[:upper:]')
SYM_LOWER=$(echo "$COIN" | tr '[:upper:]' '[:lower:]')_thb

RATE_VAL=$(echo "$RATE_PART" | sed 's/[Ll]=//')
if [[ "$(echo "$RATE_VAL" | tr '[:lower:]' '[:upper:]')" == "M" ]]; then
  RAT=0; TYP="market"
else
  RAT="$RATE_VAL"; TYP="limit"
fi

if [[ "$TYP" == "limit" ]]; then
  if ! PRICE_RULES=$(get_price_rules_for_coin "$COIN" 2>&1); then
    echo "❌ ไม่ส่งคำสั่ง Limit: อ่าน price_scale/price_step ของคู่ ${COIN}_THB ไม่สำเร็จ"
    echo "$PRICE_RULES"
    exit 1
  fi
  IFS=$'\t' read -r _ PRICE_SCALE PRICE_STEP <<< "$PRICE_RULES"
  if ! PRICE_ERROR=$(RATE="$RAT" PRICE_SCALE="$PRICE_SCALE" PRICE_STEP="$PRICE_STEP" python3 -c '
import os
import sys
from decimal import Decimal, InvalidOperation

try:
    price = Decimal(os.environ["RATE"])
    scale = int(os.environ["PRICE_SCALE"])
    step = Decimal(os.environ["PRICE_STEP"])
    if not price.is_finite() or price <= 0 or step <= 0:
        raise ValueError("ราคาหรือ price_step ต้องมากกว่าศูนย์")
    if price != price.quantize(Decimal(1).scaleb(-scale)):
        raise ValueError("จำนวนตำแหน่งทศนิยมเกิน price_scale")
    if price % step != 0:
        raise ValueError("ราคาไม่ตรงกับ price_step")
except (InvalidOperation, ValueError, ArithmeticError) as exc:
    print(str(exc), file=sys.stderr)
    sys.exit(1)
' 2>&1); then
    echo "❌ ไม่ส่งคำสั่ง Limit ราคา $RAT ไม่ตรงข้อกำหนดของคู่ ${COIN}_THB (price_scale=$PRICE_SCALE, price_step=$PRICE_STEP): $PRICE_ERROR"
    exit 1
  fi
fi

TIMESTAMP=$(curl -s "$BASE_URL/api/v3/servertime")

# ============================================================
# BUY
# ============================================================
if [[ "$SIDE" == "BUY" ]]; then
  # ตรวจสอบ source (broker/exchange) จาก Bitkub symbols
  COIN_SOURCE=$(curl -s "$BASE_URL/api/v3/market/symbols" | python3 -c "
import sys, json
d = json.load(sys.stdin)
syms = d.get('result', d.get('data', []))
m = {s.get('symbol','').replace('_THB','').upper(): s.get('source','exchange') for s in syms}
print(m.get('$COIN', 'exchange'))
" 2>/dev/null || echo "exchange")

  if [[ "$COIN_SOURCE" == "broker" ]]; then
    echo "ℹ️  $COIN เป็น Broker Coin (source: broker)"
    echo "⚠️  Broker Coin อาจมีข้อจำกัดบางอย่าง เช่น ไม่มี Order History"
    echo ""
    echo "คุณต้องการซื้อต่อไหม? (y/n)"
    read -r CONFIRM_SRC
    if [[ "$CONFIRM_SRC" != "y" && "$CONFIRM_SRC" != "Y" ]]; then
      echo "❌ ยกเลิกคำสั่ง"
      exit 1
    fi
    echo ""
  else
    echo "ℹ️  $COIN เป็น Exchange Coin (source: exchange)"
    echo ""
  fi

  # ตรวจสอบสถานะเหรียญจาก Excel output
  OUTPUT_FILE="$(dirname "$0")/downloads/All-Bitkub-Batch-Log-vX_output.xlsx"
  if [[ -f "$OUTPUT_FILE" ]]; then
    STATUS=$(python3 -c "
import openpyxl
try:
    wb = openpyxl.load_workbook('$OUTPUT_FILE')
    sheet = wb['Latest Snapshot']
    for row in sheet.iter_rows(min_row=3, values_only=True):
        aka = row[2]
        if aka == '$COIN':
            advice = row[12]
            if advice and 'BUY CONFIRMED' in advice:
                print('BUY_CONFIRMED')
            elif advice and 'EARLY/WATCH' in advice:
                print('EARLY_WATCH')
            elif advice and 'PULLBACK ZONE' in advice:
                print('PULLBACK_ZONE')
            elif advice and 'OVEREXTENDED' in advice:
                print('OVEREXTENDED')
            elif advice and 'WAIT/RETEST' in advice:
                print('WAIT_RETEST')
            else:
                print('UNKNOWN')
            break
    else:
        print('NOT_FOUND')
except:
    print('ERROR')
" 2>/dev/null)

    if [[ "$STATUS" == "NOT_FOUND" ]]; then
      echo "⚠️ คำเตือน: ไม่พบ $COIN ใน Excel output (ยังไม่ได้รัน UPDATE หรือเหรียญไม่อยู่ใน Sheet)"
      echo "ไม่สามารถตรวจสอบสถานะ MPTM ได้"
      echo ""
      echo "คุณต้องการซื้อต่อไหม? (y/n)"
      read -r CONFIRM
      if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
        echo "❌ ยกเลิกคำสั่ง"
        exit 1
      fi
      echo ""
    elif [[ "$STATUS" == "ERROR" ]]; then
      echo "⚠️ คำเตือน: อ่าน Excel output หรือชีท Latest Snapshot ไม่ได้"
      echo "กรุณารัน UPDATE เพื่อตรวจสอบสถานะ MPTM ก่อนซื้อ"
      echo ""
      echo "คุณต้องการซื้อต่อไหม? (y/n)"
      read -r CONFIRM
      if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
        echo "❌ ยกเลิกคำสั่ง"
        exit 1
      fi
      echo ""
    elif [[ "$STATUS" == "BUY_CONFIRMED" ]]; then
      echo "✅ $COIN อยู่ในสถานะ BUY CONFIRMED (ผ่านเกณฑ์ MPTM)"
      echo "กรุณายืนยันคำสั่งซื้อก่อนส่งคำสั่ง"
      echo ""
      echo "คุณต้องการซื้อต่อไหม? (y/n)"
      read -r CONFIRM
      if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
        echo "❌ ยกเลิกคำสั่ง"
        exit 1
      fi
      echo ""
    elif [[ "$STATUS" != "BUY_CONFIRMED" ]]; then
      echo "⚠️ คำเตือน: $COIN อยู่ในสถานะ $STATUS (ไม่ใช่ BUY CONFIRMED)"
      echo "การซื้อละเมิดกฎ MPTM"
      echo ""
      echo "ตามกฎ MPTM: ต้องมี 1H Trigger ยืนยันก่อนซื้อ"
      echo "BUY CONFIRMED = ผ่าน MPTM 6 เกณฑ์ + 1H Trigger ยืนยัน"
      echo ""
      echo "คุณต้องการซื้อต่อไหม? (y/n)"
      read -r CONFIRM
      if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
        echo "❌ ยกเลิกคำสั่ง"
        exit 1
      fi
      echo "✅ ยืนยันการซื้อที่ละเมิดกฎ MPTM"
      echo ""
    fi
  else
    echo "⚠️ คำเตือน: ไม่พบไฟล์ Excel output"
    echo "ไม่สามารถตรวจสอบสถานะ MPTM ได้ กรุณารัน UPDATE ก่อนซื้อ"
    echo ""
    echo "คุณต้องการซื้อต่อไหม? (y/n)"
    read -r CONFIRM
    if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
      echo "❌ ยกเลิกคำสั่ง"
      exit 1
    fi
    echo ""
  fi

  AMT="$AMOUNT_PART"
  BODY="{\"sym\":\"${SYM_LOWER}\",\"amt\":${AMT},\"rat\":${RAT},\"typ\":\"${TYP}\"}"
  TIMESTAMP=$(curl -sS "$BASE_URL/api/v3/servertime") || {
    echo "❌ ดึงเวลา Bitkub ไม่สำเร็จ จึงไม่ส่งคำสั่ง BUY"
    exit 1
  }
  if ! [[ "$TIMESTAMP" =~ ^[0-9]+$ ]]; then
    echo "❌ ได้เวลา Bitkub ไม่ถูกต้อง จึงไม่ส่งคำสั่ง BUY"
    exit 1
  fi
  SIGN=$(sign "${TIMESTAMP}POST/api/v3/market/place-bid${BODY}")

  echo "📤 BUY ${COIN} | typ:${TYP} | rat:${RAT} | amt:${AMT} THB"
  if ! BUY_RESPONSE_WITH_STATUS=$(curl -sS -w $'\n%{http_code}' "$BASE_URL/api/v3/market/place-bid" \
    -X POST \
    -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    -H "X-BTK-APIKEY: $API_KEY" \
    -H "X-BTK-TIMESTAMP: $TIMESTAMP" \
    -H "X-BTK-SIGN: $SIGN" \
    -d "$BODY"); then
    echo "❌ ไม่ได้รับคำตอบจาก BUY API จึงยืนยันผลคำสั่งซื้อไม่ได้ | HTTP status code: unavailable | Bitkub error code: unavailable"
    exit 1
  fi
  BUY_HTTP_STATUS="${BUY_RESPONSE_WITH_STATUS##*$'\n'}"
  RESP="${BUY_RESPONSE_WITH_STATUS%$'\n'*}"
  if ! ORDER_ID=$(printf '%s' "$RESP" | python3 -c "
import json, sys
try:
    r = json.load(sys.stdin)
except json.JSONDecodeError:
    print('❌ คำสั่งซื้อดำเนินการไม่สำเร็จหรือยืนยันไม่ได้ | HTTP status code: ${BUY_HTTP_STATUS} | Bitkub error code: unavailable (invalid JSON)', file=sys.stderr)
    sys.exit(1)
if not isinstance(r, dict):
    print('❌ คำสั่งซื้อดำเนินการไม่สำเร็จหรือยืนยันไม่ได้ | HTTP status code: ${BUY_HTTP_STATUS} | Bitkub error code: unavailable (invalid response)', file=sys.stderr)
    sys.exit(1)
if not isinstance(r, dict):
    print('❌ คำสั่งซื้อดำเนินการไม่สำเร็จหรือยืนยันไม่ได้ | HTTP status code: unavailable | Bitkub error code: unavailable (invalid response)', file=sys.stderr)
    sys.exit(1)
http_status = '${BUY_HTTP_STATUS}'
error_code = r.get('error', 'unavailable')
if not http_status.isdigit() or not 200 <= int(http_status) < 300 or str(error_code) != '0':
    print(f\"❌ คำสั่งซื้อดำเนินการไม่สำเร็จ | HTTP status code: {http_status} | Bitkub error code: {error_code}\", file=sys.stderr)
    sys.exit(1)
o = r.get('result')
if not isinstance(o, dict) or not o.get('id'):
    print(\"⚠️ BUY API ตอบ HTTP status ${BUY_HTTP_STATUS}, error code 0 แต่ไม่มี Order ID จึงตรวจสอบสถานะต่อไม่ได้\", file=sys.stderr)
    sys.exit(1)
print(o['id'])
"); then
    exit 1
  fi
  printf '%s' "$RESP" | python3 -c "
import json, sys
response = json.load(sys.stdin)
o = response.get('result', {})
print(f\"✅ BUY API HTTP status code: ${BUY_HTTP_STATUS} | Bitkub error code: {response.get('error')} | Order placed | id:{o.get('id')} | sym:{o.get('sym')} | typ:{o.get('typ')} | rat:{o.get('rat')} | amt:{o.get('amt')} | ts:{o.get('ts')}\")
"

  HISTORY_RESP='{"_transport_error":"Cannot retrieve Bitkub server time"}'
  HISTORY_HTTP_STATUS="unavailable"
  if TS_HISTORY=$(curl -sS "$BASE_URL/api/v3/servertime") && [[ "$TS_HISTORY" =~ ^[0-9]+$ ]]; then
    HISTORY_QUERY="?sym=${COIN}_THB&p=1&lmt=100"
    HISTORY_SIGN=$(sign "${TS_HISTORY}GET/api/v3/market/my-order-history${HISTORY_QUERY}")
    if HISTORY_WITH_STATUS=$(curl -sS -w $'\n%{http_code}' "$BASE_URL/api/v3/market/my-order-history${HISTORY_QUERY}" \
      -H "Accept: application/json" \
      -H "Content-Type: application/json" \
      -H "X-BTK-APIKEY: $API_KEY" \
      -H "X-BTK-TIMESTAMP: $TS_HISTORY" \
      -H "X-BTK-SIGN: $HISTORY_SIGN"); then
      HISTORY_HTTP_STATUS="${HISTORY_WITH_STATUS##*$'\n'}"
      HISTORY_RESP="${HISTORY_WITH_STATUS%$'\n'*}"
    else
      HISTORY_RESP='{"_transport_error":"Order History request failed"}'
    fi
  fi

  OPEN_ORDERS_RESP='{"_transport_error":"Cannot retrieve Bitkub server time"}'
  OPEN_HTTP_STATUS="unavailable"
  if TS_OPEN=$(curl -sS "$BASE_URL/api/v3/servertime") && [[ "$TS_OPEN" =~ ^[0-9]+$ ]]; then
    OPEN_QUERY="?sym=${SYM_LOWER}"
    OPEN_SIGN=$(sign "${TS_OPEN}GET/api/v3/market/my-open-orders${OPEN_QUERY}")
    if OPEN_WITH_STATUS=$(curl -sS -w $'\n%{http_code}' "$BASE_URL/api/v3/market/my-open-orders${OPEN_QUERY}" \
      -H "Accept: application/json" \
      -H "Content-Type: application/json" \
      -H "X-BTK-APIKEY: $API_KEY" \
      -H "X-BTK-TIMESTAMP: $TS_OPEN" \
      -H "X-BTK-SIGN: $OPEN_SIGN"); then
      OPEN_HTTP_STATUS="${OPEN_WITH_STATUS##*$'\n'}"
      OPEN_ORDERS_RESP="${OPEN_WITH_STATUS%$'\n'*}"
    else
      OPEN_ORDERS_RESP='{"_transport_error":"Open Orders request failed"}'
    fi
  fi

  OUTPUT_FILE="$(dirname "$0")/downloads/All-Bitkub-Batch-Log-vX_output.xlsx"
  BUY_TIER=$(get_tier_for_coin "$COIN" 2>/dev/null || true)
  BUY_PRICE_RULES_ERROR=""
  if ! BUY_PRICE_RULES=$(get_price_rules_for_coin "$COIN" 2>&1); then
    BUY_PRICE_RULES_ERROR="$BUY_PRICE_RULES"
    BUY_PRICE_RULES=""
  fi
  BUY_RESPONSE="$RESP" BUY_HTTP_STATUS="$BUY_HTTP_STATUS" HISTORY_JSON="$HISTORY_RESP" \
    HISTORY_HTTP_STATUS="$HISTORY_HTTP_STATUS" OPEN_ORDERS_JSON="$OPEN_ORDERS_RESP" \
    OPEN_HTTP_STATUS="$OPEN_HTTP_STATUS" BUY_TIER="$BUY_TIER" \
    BUY_PRICE_RULES="$BUY_PRICE_RULES" BUY_PRICE_RULES_ERROR="$BUY_PRICE_RULES_ERROR" \
    python3 - "$OUTPUT_FILE" "$COIN" "$ORDER_ID" "$COIN_SOURCE" <<'PY'
import json
import os
import re
import sys
from decimal import Decimal, InvalidOperation, ROUND_CEILING
from zipfile import BadZipFile

import openpyxl

_, coin, order_id, source = sys.argv[1:]
rates = {
    1: Decimal("0.0825"),
    2: Decimal("0.0725"),
    3: Decimal("0.0675"),
    4: Decimal("0.0575"),
}

try:
    buy_response = json.loads(os.environ["BUY_RESPONSE"])
except (KeyError, json.JSONDecodeError) as exc:
    print(f"⚠️ อ่านผล BUY API ไม่ได้หลังได้รับ Order ID: {exc}")
    print("ไม่แสดงราคาเป้าหมายหรือคำสั่งขาย")
    sys.exit(0)
buy_result = buy_response.get("result")
if not isinstance(buy_result, dict):
    print("⚠️ BUY API ตอบกลับโดยไม่มีรายละเอียดคำสั่งซื้อ")
    print("ไม่แสดงราคาเป้าหมายหรือคำสั่งขาย")
    sys.exit(0)
print(f"BUY API HTTP status code: {os.environ.get('BUY_HTTP_STATUS', 'unavailable')} | Bitkub error code: {buy_response.get('error', 'unavailable')}")

tier_match = re.fullmatch(r"T?([1-4])(?:\.0+)?", os.environ.get("BUY_TIER", "").strip().upper())
tier = int(tier_match.group(1)) if tier_match else None
source_label = str(source).strip().capitalize() or "Unknown"
print(f"AKA: {coin}")
print(f"TIER: {tier if tier is not None else 'N/A'}")
print(f"Source: {source_label}")
print("%Target Price: T1=8.25%, T2=7.25%, T3=6.75%, T4=5.75%")

try:
    history = json.loads(os.environ["HISTORY_JSON"])
except (KeyError, json.JSONDecodeError) as exc:
    history = {"_transport_error": str(exc)}

history_http_status = os.environ.get("HISTORY_HTTP_STATUS", "unavailable")
history_error = history.get("error") if isinstance(history, dict) else None
history_ok = (
    history_http_status.isdigit()
    and 200 <= int(history_http_status) < 300
    and str(history_error) == "0"
)
history_rows = history.get("result", []) if isinstance(history, dict) else []
if not history_ok or not isinstance(history_rows, list):
    history_rows = []

fills = [
    item for item in history_rows
    if isinstance(item, dict)
    and str(item.get("order_id", "")) == str(order_id)
    and str(item.get("side", "")).lower() == "buy"
]

try:
    open_orders = json.loads(os.environ["OPEN_ORDERS_JSON"])
except (KeyError, json.JSONDecodeError):
    open_orders = {}
open_error = open_orders.get("error") if isinstance(open_orders, dict) else None
open_http_status = os.environ.get("OPEN_HTTP_STATUS", "unavailable")
open_ok = (
    open_http_status.isdigit()
    and 200 <= int(open_http_status) < 300
    and str(open_error) == "0"
)
open_rows = open_orders.get("result", []) if isinstance(open_orders, dict) else []
if not open_ok or not isinstance(open_rows, list):
    open_rows = []
has_open_order = any(
    isinstance(item, dict) and str(item.get("id", "")) == str(order_id)
    for item in open_rows
)
if has_open_order:
    print(f"สถานะคำสั่งซื้อ: ยังเปิดรอจับคู่ (Order ID {order_id})")
    print("ไม่แสดงราคาเป้าหมายหรือคำสั่งขายจนกว่าจะยืนยันยอดซื้อที่จับคู่แล้ว")
    sys.exit(0)

if fills:
    if not history_ok:
        print(f"⚠️ Order History HTTP status code: {history_http_status} | Bitkub error code: {history_error if history_error is not None else 'unavailable'}")
        print("ไม่ใช้ข้อมูลประวัติที่ตอบกลับมาคำนวณราคา")
        fills = []
    else:
        print(f"Order History HTTP status code: {history_http_status} | Bitkub error code: 0")

if not fills:
    print(f"⚠️ ไม่พบ fill ของ Order ID {order_id} ใน Order History")
    print(f"Order History HTTP status code: {history_http_status} | Bitkub error code: {history_error if history_error is not None else 'unavailable'}")
    if not open_ok:
        print(f"Open Orders HTTP status code: {open_http_status} | Bitkub error code: {open_error if open_error is not None else 'unavailable'}")
        if str(buy_result.get("typ", "")).lower() != "market":
            print("ไม่สามารถยืนยันได้ว่าคำสั่ง Limit ยังเปิดค้างอยู่หรือไม่")
            print("ไม่แสดงราคาเป้าหมายหรือคำสั่งขาย")
            sys.exit(0)

    try:
        amount = Decimal(str(buy_result["amt"]))
        fee = Decimal(str(buy_result["fee"]))
        credit = Decimal(str(buy_result["cre"]))
        received = Decimal(str(buy_result["rec"]))
        if amount <= 0 or received <= 0 or fee < 0 or credit < 0 or credit > fee:
            raise ValueError("พบ amt/rec/fee/cre ที่ไม่สมเหตุสมผล หรือยังไม่มีเหรียญที่ได้รับ")
        total_cost = amount + fee - credit
        total_quantity = received
    except (KeyError, InvalidOperation, TypeError, ValueError) as exc:
        print(f"⚠️ ไม่ยืนยันการซื้อสำเร็จจากข้อมูล fill: {exc}")
        print("ไม่แสดงราคาเป้าหมายหรือคำสั่งขาย")
        sys.exit(0)
    print("คำนวณจากผล BUY API ที่ยืนยันจำนวนได้รับและค่าธรรมเนียม เพราะ Order History ไม่มีรายการที่ตรงกัน")
else:
    total_cost = Decimal("0")
    total_quantity = Decimal("0")
    try:
        for fill in fills:
            amount = Decimal(str(fill["amount"]))
            rate = Decimal(str(fill["rate"]))
            fee = Decimal(str(fill["fee"]))
            credit = Decimal(str(fill["credit"]))
            if amount <= 0 or rate <= 0 or fee < 0 or credit < 0 or credit > fee:
                raise ValueError("พบ amount/rate/fee/credit ที่ไม่สมเหตุสมผล")
            net_quantity = (amount - fee + credit) / rate
            if net_quantity <= 0:
                raise ValueError("จำนวนเหรียญสุทธิหลังหักค่าธรรมเนียมไม่เป็นบวก")
            total_quantity += net_quantity
            total_cost += amount
    except (KeyError, InvalidOperation, TypeError, ValueError) as exc:
        print(f"⚠️ ข้อมูล Fill หรือค่าธรรมเนียมไม่ครบ/ไม่ถูกต้อง: {exc}")
        print("ไม่แสดงราคาเป้าหมายหรือคำสั่งขาย")
        sys.exit(0)

    if total_quantity <= 0:
        print("⚠️ ไม่สามารถคำนวณจำนวนเหรียญที่ซื้อสำเร็จได้")
        print("ไม่แสดงราคาเป้าหมายหรือคำสั่งขาย")
        sys.exit(0)

average_cost = total_cost / total_quantity
if tier is None:
    print(f"⚠️ ไม่พบ TIER 1-4 ที่ถูกต้องสำหรับ {coin} ใน REF Sheet")
    print("ไม่แสดงราคาเป้าหมายหรือคำสั่งขาย")
    sys.exit(0)
rules = os.environ.get("BUY_PRICE_RULES", "").split("\t")
if len(rules) != 3:
    print(f"⚠️ อ่าน price_scale/price_step ของคู่ {coin}_THB ไม่ได้: {os.environ.get('BUY_PRICE_RULES_ERROR', 'metadata unavailable')}")
    print("ไม่แสดงราคาเป้าหมายหรือคำสั่งขาย")
    sys.exit(0)
try:
    price_scale = int(rules[1])
    price_step = Decimal(rules[2])
    target_price = average_cost * (Decimal("1") + rates[tier])
    target_price = (
        (target_price / price_step).to_integral_value(rounding=ROUND_CEILING)
        * price_step
    ).quantize(Decimal(1).scaleb(-price_scale))
except (InvalidOperation, ValueError, ArithmeticError) as exc:
    print(f"⚠️ price_scale/price_step ของคู่ {coin}_THB ไม่ถูกต้อง: {exc}")
    print("ไม่แสดงราคาเป้าหมายหรือคำสั่งขาย")
    sys.exit(0)
target_text = format(target_price, f".{price_scale}f")
print(f"ต้นทุนเฉลี่ยรวมค่าธรรมเนียม: {format(average_cost, 'f')} THB/{coin}")
print(f"Target Price T{tier}: {target_text} THB")
print(f'"SELL/{coin}/L={target_text}/100%"')
PY

# ============================================================
# SELL
# ============================================================
elif [[ "$SIDE" == "SELL" ]]; then
  PCT=$(echo "$AMOUNT_PART" | tr -d '%')
  TS2=$(curl -s "$BASE_URL/api/v3/servertime")
  QUERY="?symbol=${COIN}"
  SIGN2=$(sign "${TS2}GET/api/v4/wallet/balances${QUERY}")
  BAL_RESP=$(curl -s "$BASE_URL/api/v4/wallet/balances${QUERY}" \
    -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    -H "X-BTK-APIKEY: $API_KEY" \
    -H "X-BTK-TIMESTAMP: $TS2" \
    -H "X-BTK-SIGN: $SIGN2")

  AVAILABLE=$(echo "$BAL_RESP" | python3 -c "
import sys, json
r = json.load(sys.stdin)
data = r.get('data', r.get('result', []))
for x in data:
    if x.get('currency','').upper() == '${COIN}':
        print(x.get('available', 0))
        sys.exit()
print(0)
" 2>/dev/null || echo "0")

QTY=$(python3 -c "
from decimal import Decimal, ROUND_DOWN
avail = Decimal('${AVAILABLE}')
qty = avail * Decimal('${PCT}') / Decimal('100')
places = 2 if qty >= 1 else 8
quantum = Decimal(1).scaleb(-places)
qty = qty.quantize(quantum, rounding=ROUND_DOWN)
print(format(qty, 'f'))
")

  if [[ "$QTY" == "0" || "$QTY" == "0.00000000" ]]; then
    echo "❌ ไม่พบยอด ${COIN} ในพอร์ต หรือ balance = 0"
    exit 1
  fi

  BODY="{\"sym\":\"${SYM_LOWER}\",\"amt\":${QTY},\"rat\":${RAT},\"typ\":\"${TYP}\"}"
  TS3=$(curl -s "$BASE_URL/api/v3/servertime")
  SIGN3=$(sign "${TS3}POST/api/v3/market/place-ask${BODY}")

  echo "📤 SELL ${COIN} | typ:${TYP} | rat:${RAT} | qty:${QTY} (${PCT}% of ${AVAILABLE})"
  RESP=$(curl -s -X POST "$BASE_URL/api/v3/market/place-ask" \
    -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    -H "X-BTK-APIKEY: $API_KEY" \
    -H "X-BTK-TIMESTAMP: $TS3" \
    -H "X-BTK-SIGN: $SIGN3" \
    -d "$BODY")
  echo "$RESP" | python3 -c "
import sys, json
r = json.load(sys.stdin)
if r.get('error') == 0:
    o = r.get('result',{})
    print(f\"✅ Order placed | id:{o.get('id')} | sym:{o.get('sym')} | typ:{o.get('typ')} | rat:{o.get('rat')} | amt:{o.get('amt')} | ts:{o.get('ts')}\")
else:
    print(f\"❌ Error {r.get('error')}: {r}\")
"

else
  echo "❌ ไม่รู้จักคำสั่ง: $CMD"
  exit 1
fi
