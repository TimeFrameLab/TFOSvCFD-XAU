#!/bin/bash
# ============================================================
# portfolio.sh — แสดง Portfolio จาก Bitkub wallet + ราคาล่าสุด + P/L
# Usage: ./portfolio.sh
# Output contract: Currency | Source | Tier | Total | ราคาซื้อเฉลี่ย (รวมค่าธรรมเนียม) |
# ราคาล่าสุด | มูลค่า (THB) | กำไร/ขาดทุน (หักค่าธรรมเนียม) | %P/L |
# ราคา Limit (THB) | ปริมาณในคำสั่ง | Remark
# Currency coin symbols are TradingView links; THB is rendered as plain text.
# ============================================================
set -e

SCRIPT_DIR="$(dirname "$0")"
ENV_FILE="$SCRIPT_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ ไม่พบไฟล์ .env"
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

sign() {
  echo -n "$1" | openssl dgst -sha256 -hmac "$API_SECRET" | awk '{print $NF}'
}

TMPDIR_PF=$(mktemp -d)
trap "rm -rf $TMPDIR_PF" EXIT

# ดึง wallet balances
TS=$(curl -s "$BASE_URL/api/v3/servertime")
QUERY="?symbol=ALL"
SIGN=$(sign "${TS}GET/api/v4/wallet/balances${QUERY}")
curl -s "$BASE_URL/api/v4/wallet/balances${QUERY}" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "X-BTK-APIKEY: $API_KEY" \
  -H "X-BTK-TIMESTAMP: $TS" \
  -H "X-BTK-SIGN: $SIGN" > "$TMPDIR_PF/balances.json"

# ดึง ticker ทุกคู่
curl -s "$BASE_URL/api/v3/market/ticker" > "$TMPDIR_PF/tickers.json"

# ดึง symbols source (exchange/broker)
curl -s "$BASE_URL/api/v3/market/symbols" > "$TMPDIR_PF/symbols.json"

# อ่าน SOURCE และ TIER จากแถว AKA เดียวกันใน REF Sheet
echo "{}" > "$TMPDIR_PF/reference.json"
if [[ -n "$REF_SHEET_URL" ]]; then
  REF_SHEET_ID=$(echo "$REF_SHEET_URL" | sed -n 's|.*/d/\([^/]*\).*|\1|p')
  if [[ -n "$REF_SHEET_ID" ]] && curl -fsSL "https://docs.google.com/spreadsheets/d/$REF_SHEET_ID/export?format=xlsx" -o "$TMPDIR_PF/reference.xlsx"; then
    python3 - "$TMPDIR_PF/reference.xlsx" "$TMPDIR_PF/reference.json" <<'PYEOF'
import json
import re
import sys
import openpyxl

reference = {}
try:
    workbook = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)
    sheet = workbook["All-Bitkub-BATCH"]
    headers = [str(value).strip().upper() if value is not None else ""
               for value in next(sheet.iter_rows(min_row=1, max_row=1, values_only=True))]
    aka_col = headers.index("AKA")
    tier_col = headers.index("TIER")
    source_col = headers.index("SOURCE")
    for row in sheet.iter_rows(min_row=2, values_only=True):
        if aka_col >= len(row) or row[aka_col] is None:
            continue
        aka = str(row[aka_col]).strip().upper()
        entry = reference.setdefault(aka, {})
        if source_col < len(row) and row[source_col] is not None:
            source = str(row[source_col]).strip()
            if source:
                entry["source"] = source
        if tier_col >= len(row):
            continue
        match = re.fullmatch(r"T?([1-4])(?:\.0+)?", str(row[tier_col] or "").strip().upper())
        if match:
            entry["tier"] = "T" + match.group(1)
except Exception:
    pass
with open(sys.argv[2], "w") as output:
    json.dump(reference, output)
PYEOF
  fi
fi

# หาเหรียญที่มีใน wallet (ไม่รวม THB)
COINS=$(python3 -c "
import json
with open('$TMPDIR_PF/balances.json') as f:
    d = json.load(f)
coins = [x['currency'].lower() for x in d.get('data',[]) if x['currency'].upper() != 'THB' and float(x.get('total',0)) > 0]
print(' '.join(coins))
")

# ดึง order history ทุกเหรียญ — เก็บเป็น JSON array
echo "{}" > "$TMPDIR_PF/histories.json"
echo "{}" > "$TMPDIR_PF/deposits.json"
echo "{}" > "$TMPDIR_PF/withdraws.json"

for COIN in $COINS; do
  SYM="${COIN}_thb"
  CURSOR=""
  ALL_ORDERS="[]"

  # ดึง order history
  while true; do
    TS=$(curl -s "$BASE_URL/api/v3/servertime")
    if [[ -z "$CURSOR" ]]; then
      QUERY="?sym=${SYM}&lmt=100&pagination_type=keyset"
    else
      QUERY="?sym=${SYM}&lmt=100&cursor=${CURSOR}&pagination_type=keyset"
    fi
    SIGN=$(sign "${TS}GET/api/v3/market/my-order-history${QUERY}")
    RESP=$(curl -s "$BASE_URL/api/v3/market/my-order-history${QUERY}" \
      -H "X-BTK-APIKEY: $API_KEY" \
      -H "X-BTK-TIMESTAMP: $TS" \
      -H "X-BTK-SIGN: $SIGN")
    ALL_ORDERS=$(python3 -c "
import json, sys
existing = json.loads('$ALL_ORDERS'.replace(\"'\", \"'\"))
resp = json.loads(sys.stdin.read())
existing.extend(resp.get('result', []))
print(json.dumps(existing))
" <<< "$RESP")
    HAS_NEXT=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('pagination',{}).get('has_next', False))")
    if [[ "$HAS_NEXT" != "True" ]]; then break; fi
    CURSOR=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('pagination',{}).get('cursor',''))")
  done

  # บันทึก orders + error ของเหรียญนี้
  ERROR_CODE=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',0))" 2>/dev/null || echo 0)
  python3 -c "
import json
with open('$TMPDIR_PF/histories.json') as f:
    h = json.load(f)
h['${COIN}'.upper()] = {'orders': json.loads('''$ALL_ORDERS'''), 'error': int('$ERROR_CODE')}
with open('$TMPDIR_PF/histories.json', 'w') as f:
    json.dump(h, f)
"

  # ดึงคำสั่งที่ยังเปิดอยู่ เพื่อแสดง Limit Sell ใน Portfolio
  TS=$(curl -s "$BASE_URL/api/v3/servertime")
  QUERY="?sym=${SYM}"
  SIGN=$(sign "${TS}GET/api/v3/market/my-open-orders${QUERY}")
  if OPEN_WITH_STATUS=$(curl -sS -w $'\n%{http_code}' "$BASE_URL/api/v3/market/my-open-orders${QUERY}" \
    -H "X-BTK-APIKEY: $API_KEY" \
    -H "X-BTK-TIMESTAMP: $TS" \
    -H "X-BTK-SIGN: $SIGN"); then
    OPEN_HTTP_STATUS="${OPEN_WITH_STATUS##*$'\n'}"
    OPEN_RESP="${OPEN_WITH_STATUS%$'\n'*}"
  else
    OPEN_HTTP_STATUS="unavailable"
    OPEN_RESP=""
  fi
  OPEN_METADATA=$(OPEN_JSON="$OPEN_RESP" OPEN_HTTP_STATUS="$OPEN_HTTP_STATUS" python3 - <<'PYEOF'
import json
import os

status = os.environ["OPEN_HTTP_STATUS"]
try:
    response = json.loads(os.environ["OPEN_JSON"])
except json.JSONDecodeError:
    print(json.dumps({
        "orders": [],
        "error": f"HTTP status code: {status}; Bitkub error code: unavailable (invalid JSON)",
    }))
    raise SystemExit(0)

if not isinstance(response, dict):
    error = "invalid response"
elif not status.isdigit() or not 200 <= int(status) < 300:
    error = response.get("error", "unavailable")
else:
    error = response.get("error", "unavailable")

orders = response.get("result") if isinstance(response, dict) else None
if (
    isinstance(response, dict)
    and status.isdigit()
    and 200 <= int(status) < 300
    and str(error) == "0"
    and isinstance(orders, list)
):
    print(json.dumps({"orders": orders, "error": "0"}, separators=(",", ":")))
else:
    detail = f"HTTP status code: {status}; Bitkub error code: {error}"
    if isinstance(response, dict) and str(error) == "0" and not isinstance(orders, list):
        detail += " (invalid open-orders result)"
    print(json.dumps({"orders": [], "error": detail}, separators=(",", ":")))
PYEOF
)
  OPEN_METADATA="$OPEN_METADATA" COIN="$COIN" HISTORY_FILE="$TMPDIR_PF/histories.json" python3 -c '
import json
import os

metadata = json.loads(os.environ["OPEN_METADATA"])
with open(os.environ["HISTORY_FILE"]) as history_file:
    histories = json.load(history_file)
entry = histories.setdefault(os.environ["COIN"].upper(), {})
entry["open_orders"] = metadata["orders"]
entry["open_orders_error"] = metadata["error"]
with open(os.environ["HISTORY_FILE"], "w") as history_file:
    json.dump(histories, history_file)
'

  # ดึง deposit history
  TS=$(curl -s "$BASE_URL/api/v3/servertime")
  QUERY="?symbol=${COIN}&limit=100"
  SIGN=$(sign "${TS}GET/api/v4/crypto/deposits${QUERY}")
  curl -s "$BASE_URL/api/v4/crypto/deposits${QUERY}" \
    -H "X-BTK-APIKEY: $API_KEY" \
    -H "X-BTK-TIMESTAMP: $TS" \
    -H "X-BTK-SIGN: $SIGN" > "$TMPDIR_PF/deposits_${COIN}.json"

  python3 -c "
import json
with open('$TMPDIR_PF/deposits.json') as f:
    d = json.load(f)
with open('$TMPDIR_PF/deposits_${COIN}.json') as f:
    resp = json.load(f)
d['${COIN}'.upper()] = resp.get('data', {}).get('items', [])
with open('$TMPDIR_PF/deposits.json', 'w') as f:
    json.dump(d, f)
"

  # ดึง withdraw history
  TS=$(curl -s "$BASE_URL/api/v3/servertime")
  QUERY="?symbol=${COIN}&limit=100"
  SIGN=$(sign "${TS}GET/api/v4/crypto/withdraws${QUERY}")
  curl -s "$BASE_URL/api/v4/crypto/withdraws${QUERY}" \
    -H "X-BTK-APIKEY: $API_KEY" \
    -H "X-BTK-TIMESTAMP: $TS" \
    -H "X-BTK-SIGN: $SIGN" > "$TMPDIR_PF/withdraws_${COIN}.json"

  python3 -c "
import json
with open('$TMPDIR_PF/withdraws.json') as f:
    d = json.load(f)
with open('$TMPDIR_PF/withdraws_${COIN}.json') as f:
    resp = json.load(f)
d['${COIN}'.upper()] = resp.get('data', {}).get('items', [])
with open('$TMPDIR_PF/withdraws.json', 'w') as f:
    json.dump(d, f)
"
done

# สร้าง python script
cat > "$TMPDIR_PF/portfolio.py" << 'PYEOF'
import sys, json
from decimal import Decimal, InvalidOperation, ROUND_DOWN
from urllib.parse import quote

with open(sys.argv[1]) as f:
    balances_raw = json.load(f, parse_float=Decimal)
with open(sys.argv[2]) as f:
    tickers_list = json.load(f)
with open(sys.argv[3]) as f:
    histories = json.load(f)
with open(sys.argv[4]) as f:
    symbols_raw = json.load(f)
with open(sys.argv[5]) as f:
    reference = json.load(f)

tickers = {t['symbol']: t for t in tickers_list if isinstance(t, dict)}
symbols = symbols_raw.get('result', symbols_raw.get('data', []))
sources = {s.get('symbol','').replace('_THB','').upper(): s.get('source','exchange')
           for s in symbols if isinstance(s, dict)}
base_scales = {s.get('symbol','').replace('_THB','').upper(): s.get('base_asset_scale')
               for s in symbols if isinstance(s, dict)}
data    = balances_raw.get('data', [])

def avg_buy_price(orders, total_held, base_asset_scale):
    """คำนวณต้นทุนถัวเฉลี่ยของจำนวนที่ยังถืออยู่จาก matched orders."""
    if not isinstance(orders, list) or not orders:
        return None, 'No OH*'
    try:
        scale = int(base_asset_scale)
        if scale < 0 or scale > 18:
            raise ValueError('invalid base asset scale')
        quantity_unit = Decimal(1).scaleb(-scale)

        events = []
        seen_txns = set()
        buy_fill_count = 0
        precision_tolerance = Decimal(0)
        for index, order in enumerate(orders):
            if not isinstance(order, dict):
                raise ValueError('invalid order record')
            side = str(order.get('side', '')).lower()
            timestamp = int(order['ts'])
            amount = Decimal(str(order['amount']))
            if amount <= 0:
                raise ValueError('non-positive order amount')
            txn_id = order.get('txn_id')
            if txn_id is not None:
                if txn_id in seen_txns:
                    continue
                seen_txns.add(txn_id)
            if side == 'buy':
                rate = Decimal(str(order['rate']))
                fee = Decimal(str(order['fee']))
                credit = Decimal(str(order['credit']))
                if rate <= 0 or fee < 0 or credit < 0 or credit > fee:
                    raise ValueError('invalid buy price or fee')
                quantity = ((amount - fee + credit) / rate).quantize(
                    quantity_unit, rounding=ROUND_DOWN
                )
                buy_fill_count += 1
                quote_precision = sum(
                    Decimal(1).scaleb(value.as_tuple().exponent) / 2
                    for value in (amount, fee, credit)
                    if value != 0
                )
                precision_tolerance += quote_precision / rate
                cost = amount
            elif side == 'sell':
                quantity = amount
                cost = Decimal(0)
            else:
                raise ValueError('unknown order side')
            events.append((timestamp, index, side, quantity, cost))

        quantity_held = Decimal(0)
        cost_basis = Decimal(0)
        known_buy_seen = False
        matched_sell_count = 0
        for _, _, side, quantity, cost in sorted(events, key=lambda event: (event[0], event[1])):
            if side == 'buy':
                known_buy_seen = True
                quantity_held += quantity
                cost_basis += cost
            else:
                if quantity > quantity_held:
                    if known_buy_seen:
                        raise ValueError('sell exceeds known holdings')
                    continue
                cost_basis -= (cost_basis / quantity_held) * quantity
                quantity_held -= quantity
                matched_sell_count += 1

        wallet_quantity = Decimal(str(total_held))
        if quantity_held <= 0 or cost_basis <= 0:
            raise ValueError('no remaining purchased holdings')
        tolerance = (
            quantity_unit * (buy_fill_count + 1)
            + precision_tolerance
        )
        if abs(quantity_held - wallet_quantity) > tolerance:
            difference = abs(quantity_held - wallet_quantity)
            return None, f'Cost basis N/A (wallet/history mismatch: {difference:f})'
        average_quantity = quantity_held if matched_sell_count else wallet_quantity
        average_price = cost_basis / average_quantity
        reconciled_cost_basis = average_price * wallet_quantity
        return (float(average_price), float(reconciled_cost_basis)), None
    except (KeyError, InvalidOperation, TypeError, ValueError, OverflowError):
        return None, 'Cost basis N/A (invalid or incomplete order history)'

rows = []
thb_total = 0.0
for item in data:
    cur   = str(item.get('currency', '')).upper()
    total_raw = item.get('total', 0)
    total = float(total_raw)
    if cur == 'THB':
        thb_total = total
        continue
    if total <= 0:
        continue
    sym    = f'{cur}_THB'
    ticker = tickers.get(sym, {})
    last   = float(ticker.get('last', 0))
    value  = total * last if last > 0 else 0

    hist_data  = histories.get(cur, {})
    orders     = hist_data.get('orders', []) if isinstance(hist_data, dict) else []
    hist_error = hist_data.get('error', 0)   if isinstance(hist_data, dict) else 0
    coin_src   = sources.get(cur, 'exchange')
    if str(hist_error) != '0':
        avg_result, cost_basis_error = None, f'Order History N/A (Bitkub error {hist_error})'
    else:
        avg_result, cost_basis_error = avg_buy_price(orders, total_raw, base_scales.get(cur))

    if avg_result and avg_result[0] > 0 and avg_result[1] > 0 and last > 0:
        avg_price = avg_result[0]
        cost_basis = avg_result[1]
        pnl        = value - cost_basis
        pnl_pct    = (pnl / cost_basis) * 100
        remark     = ''
    else:
        avg_price = None
        pnl       = None
        pnl_pct   = None
        if coin_src == 'broker':
            remark = 'Broker Coin*'
        elif hist_error == 61:
            remark = 'Broker Coin*'
        else:
            remark = cost_basis_error or 'Cost basis N/A'

    open_orders = hist_data.get('open_orders', []) if isinstance(hist_data, dict) else []
    open_orders_error = hist_data.get('open_orders_error', 'unavailable') if isinstance(hist_data, dict) else 'unavailable'
    limit_sells = [
        order for order in open_orders
        if isinstance(order, dict)
        and str(order.get('side', '')).lower() == 'sell'
        and str(order.get('type', order.get('typ', ''))).lower() == 'limit'
    ]
    def display_order_value(value):
        try:
            number = Decimal(str(value))
            if not number.is_finite():
                return 'N/A'
        except (InvalidOperation, TypeError, ValueError):
            return 'N/A'
        text = format(number, ',f')
        return text.rstrip('0').rstrip('.') if '.' in text else text
    limit_prices = '<br>'.join(display_order_value(order.get('rate')) for order in limit_sells) or '—'
    limit_amounts = '<br>'.join(display_order_value(order.get('amount')) for order in limit_sells) or '—'
    if str(open_orders_error) != '0':
        remark = ' | '.join(filter(None, [remark, f'Open Orders N/A ({open_orders_error})']))
    elif limit_sells:
        remark = ' | '.join(filter(None, [remark, f'Limit Sell เปิด {len(limit_sells)} คำสั่ง']))
        if 'N/A' in limit_prices or 'N/A' in limit_amounts:
            remark = ' | '.join(filter(None, [remark, 'Open Orders data incomplete']))
    ref_data = reference.get(cur, {})
    source_value = str(ref_data.get('source', '')).strip()
    source = source_value.capitalize() if source_value else 'N/A'
    tier = ref_data.get('tier', 'N/A')
    rows.append((cur, source, tier, total, avg_price, last, value, pnl, pnl_pct, limit_prices, limit_amounts, remark))

rows.sort(key=lambda x: x[6], reverse=True)
total_value = sum(r[6] for r in rows) + thb_total
total_pnl   = sum(r[7] for r in rows if r[7] is not None)

print(f'## 💼 Portfolio ({len(rows)} เหรียญ)\n')
print(f'| Currency | Source | Tier | Total | ราคาซื้อเฉลี่ย (รวมค่าธรรมเนียม) | ราคาล่าสุด | มูลค่า (THB) | กำไร/ขาดทุน (หักค่าธรรมเนียม) | %P/L | ราคา Limit (THB) | ปริมาณในคำสั่ง | Remark |')
print(f'|:---|:---:|:---:|---:|---:|---:|---:|---:|---:|---:|---:|:---|')
for cur, source, tier, total, avg_price, last, val, pnl, pnl_pct, limit_prices, limit_amounts, remark in rows:
    avg_str  = f'{avg_price:,.4f}'  if avg_price else 'N/A'
    last_str = f'{last:,.4f}'      if last > 0  else 'N/A'
    val_str  = f'{val:,.2f}'       if val  > 0  else 'N/A'
    if pnl is not None:
        pnl_str = f'+{pnl:,.2f}' if pnl >= 0 else f'{pnl:,.2f}'
        pct_str = f'+{pnl_pct:.2f}%' if pnl_pct >= 0 else f'{pnl_pct:.2f}%'
    else:
        pnl_str = 'N/A'
        pct_str = 'N/A'
    currency_cell = f'[{cur}](https://www.tradingview.com/chart/?symbol={quote(cur + "THB", safe="")})'
    print(f'| {currency_cell} | {source} | {tier} | {total:,.4f} | {avg_str} | {last_str} | {val_str} | {pnl_str} | {pct_str} | {limit_prices} | {limit_amounts} | {remark or "—"} |')
if thb_total > 0:
    print(f'| **THB** | — | — | {thb_total:,.2f} | — | 1.0000 | {thb_total:,.2f} | — | — | — | — | — |')

pnl_sign = '+' if total_pnl >= 0 else ''
print(f'\n**รวมมูลค่าพอร์ต: {total_value:,.2f} THB** | **กำไร/ขาดทุนรวม: {pnl_sign}{total_pnl:,.2f} THB**')
print(f'\n> \* Broker Coin = Broker coin ไม่มี Order History ใน Bitkub API')
print(f'> \* No OH = No Order History found; may be from Airdrop/Reward or external transfer.')
PYEOF

python3 "$TMPDIR_PF/portfolio.py" "$TMPDIR_PF/balances.json" "$TMPDIR_PF/tickers.json" "$TMPDIR_PF/histories.json" "$TMPDIR_PF/symbols.json" "$TMPDIR_PF/reference.json"
