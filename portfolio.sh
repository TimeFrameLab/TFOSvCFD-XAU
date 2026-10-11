#!/bin/bash
# ============================================================
# portfolio.sh — แสดง Portfolio จาก Bitkub wallet + ราคาล่าสุด + P/L
# Usage: ./portfolio.sh
# Output contract: Currency | Total | ราคาซื้อเฉลี่ย (รวมค่าธรรมเนียม) |
# ราคาล่าสุด | มูลค่า (THB) | กำไร/ขาดทุน (หักค่าธรรมเนียม) | %P/L | Remark
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
      QUERY="?sym=${SYM}&lmt=100"
    else
      QUERY="?sym=${SYM}&lmt=100&cursor=${CURSOR}"
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
from urllib.parse import quote

with open(sys.argv[1]) as f:
    balances_raw = json.load(f)
with open(sys.argv[2]) as f:
    tickers_list = json.load(f)
with open(sys.argv[3]) as f:
    histories = json.load(f)
with open(sys.argv[4]) as f:
    symbols_raw = json.load(f)

tickers = {t['symbol']: t for t in tickers_list if isinstance(t, dict)}
sources = {s.get('symbol','').replace('_THB','').upper(): s.get('source','exchange')
           for s in symbols_raw.get('result', symbols_raw.get('data', []))}
data    = balances_raw.get('data', [])

def avg_buy_price(orders, total_held):
    """คำนวณราคาซื้อเฉลี่ยทางบัญชี (รวมค่าธรรมเนียม)"""
    buys  = []
    sells = []
    for o in orders:
        if o.get('side') == 'buy' and float(o.get('rate', 0)) > 0:
            rate = float(o['rate'])
            amount = float(o['amount'])
            qty = amount / rate
            fee = float(o.get('fee', 0))
            buys.append((rate, qty, fee))
        elif o.get('side') == 'sell':
            amount = float(o['amount'])
            fee = float(o.get('fee', 0))
            sells.append((amount, fee))

    if not buys:
        return None

    total_qty   = sum(q for _, q, _ in buys)
    total_cost  = sum(r * q + f for r, q, f in buys)  # รวมค่าธรรมเนียมซื้อในต้นทุน
    total_sold  = sum(a for a, _ in sells)
    total_sell_fee = sum(f for _, f in sells)  # ค่าธรรมเนียมขาย

    # ถ้าขายไปบางส่วน ใช้ weighted avg ทั้งหมด
    if total_qty <= 0:
        return None

    avg_price = total_cost / total_qty

    # ส่งคืก tuple: (ราคาซื้อเฉลี่ย, ค่าธรรมเนียมขายรวม)
    return (avg_price, total_sell_fee)

rows = []
thb_total = 0.0
for item in data:
    cur   = str(item.get('currency', '')).upper()
    total = float(item.get('total', 0))
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
    avg_result = avg_buy_price(orders, total)

    if avg_result and avg_result[0] and avg_result[0] > 0 and last > 0:
        avg_price = avg_result[0]
        total_sell_fee = avg_result[1]
        cost_basis = avg_price * total
        pnl        = value - cost_basis - total_sell_fee
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
        elif not orders:
            remark = 'No OH*'
        else:
            remark = 'No OH*'

    rows.append((cur, total, avg_price, last, value, pnl, pnl_pct, remark))

rows.sort(key=lambda x: x[4], reverse=True)
total_value = sum(r[4] for r in rows) + thb_total
total_pnl   = sum(r[5] for r in rows if r[5] is not None)

print(f'## 💼 Portfolio ({len(rows)} เหรียญ)\n')
print(f'| Currency | Total | ราคาซื้อเฉลี่ย (รวมค่าธรรมเนียม) | ราคาล่าสุด | มูลค่า (THB) | กำไร/ขาดทุน (หักค่าธรรมเนียม) | %P/L | Remark |')
print(f'|:---|---:|---:|---:|---:|---:|---:|:---|')
for cur, total, avg_price, last, val, pnl, pnl_pct, remark in rows:
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
    print(f'| {currency_cell} | {total:,.4f} | {avg_str} | {last_str} | {val_str} | {pnl_str} | {pct_str} | {remark} |')
if thb_total > 0:
    print(f'| **THB** | {thb_total:,.2f} | — | 1.0000 | {thb_total:,.2f} | — | — | — |')

pnl_sign = '+' if total_pnl >= 0 else ''
print(f'\n**รวมมูลค่าพอร์ต: {total_value:,.2f} THB** | **กำไร/ขาดทุนรวม: {pnl_sign}{total_pnl:,.2f} THB**')
print(f'\n> \* Broker Coin = Broker coin ไม่มี Order History ใน Bitkub API')
print(f'> \* No OH = No Order History found; may be from Airdrop/Reward or external transfer.')
PYEOF

python3 "$TMPDIR_PF/portfolio.py" "$TMPDIR_PF/balances.json" "$TMPDIR_PF/tickers.json" "$TMPDIR_PF/histories.json" "$TMPDIR_PF/symbols.json"
