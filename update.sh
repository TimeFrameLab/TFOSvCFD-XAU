#!/bin/bash
set -e

# โหลดค่าจาก .env
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

# ดึง Sheet ID จาก REF_SHEET_URL (ต้องมีใน .env)
if [[ -z "$REF_SHEET_URL" ]]; then
  echo "❌ กรุณาตั้งค่า REF_SHEET_URL ใน .env"
  echo "💡 สร้างไฟล์ .env จาก .env.example: cp .env.example .env"
  exit 1
fi
SHEET_ID=$(echo "$REF_SHEET_URL" | sed -n 's|.*/d/\([^/]*\).*|\1|p')

DOWNLOAD_DIR="$(dirname "$0")/downloads"
INPUT="$DOWNLOAD_DIR/All-Bitkub-Batch-Log-vX.xlsx"
OUTPUT="$DOWNLOAD_DIR/All-Bitkub-Batch-Log-vX_output.xlsx"

echo "📥 Downloading latest data from Reference Sheet (REF Sheet)..."
echo "   Sheet ID: $SHEET_ID"
curl -sL "https://docs.google.com/spreadsheets/d/$SHEET_ID/export?format=xlsx" -o "$INPUT"
echo "✅ Downloaded: $INPUT"

echo "⚙️  Processing MPTM signals..."
python3 << 'PYEOF'
import openpyxl, re
from copy import copy
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from datetime import datetime
from urllib.parse import quote
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT  = os.path.join(SCRIPT_DIR, "downloads", "All-Bitkub-Batch-Log-vX.xlsx")
OUTPUT = os.path.join(SCRIPT_DIR, "downloads", "All-Bitkub-Batch-Log-vX_output.xlsx")

# กำหนดเหรียญที่ต้องการแสดง LAST_CANDLE, UPDATED, Source
TARGET_COIN = 'BTC'  # เปลี่ยนเป็นเหรียญที่ต้องการ (เช่น 'AAVE', 'ATOM', 'QNT')

def tradingview_url(aka):
    symbol = quote(f'{aka}THB', safe='')
    return f'https://www.tradingview.com/chart/?symbol={symbol}'

def terminal_link(aka):
    label = re.sub(r'[\x00-\x1f\x7f]', '', str(aka))
    url = tradingview_url(label)
    return f'\033]8;;{url}\033\\{label}\033]8;;\033\\'

def set_coin_link(cell, aka):
    cell.hyperlink = tradingview_url(aka)
    font = copy(cell.font)
    font.color = '0563C1'
    font.underline = 'single'
    cell.font = font

wb_src = openpyxl.load_workbook(INPUT)
ws_src = wb_src['All-Bitkub-BATCH']
headers = [cell.value for cell in ws_src[1]]

def col(name): return headers.index(name) if name in headers else None

def get_val(row, idx):
    if idx is None: return None
    val = row[idx]
    if isinstance(val, str):
        m = re.search(r'COMPUTED_VALUE""\"\),(.+?)\)$', val)
        if m:
            v = m.group(1).strip().strip('"')
            try: return float(v)
            except: return v
        m2 = re.search(r',([^,]+)\)$', val)
        if m2:
            v = m2.group(1).strip().strip('"')
            try: return float(v)
            except: return v
    return val

IDX = {k: col(k) for k in ['AKA','TIER','TREND(W)','TREND(D)','RSI(W)','RSI(D)',
    'MACD_HIST(W)','MACD_HIST_DELTA(W)','EMA9(W)','EMA21(W)',
    'PRICE_STRUCTURE(W)','ENTRY_ZONE(4H)','ENTRY_TRIGGER(1H)',
    'ACTION(1H)','PRICE','LAST_CANDLE','UPDATED','Source','URL',
    'TREND(4H)','TREND(1H)','RSI(1H)',
    'SIGNAL_VOLUME(W)','SIGNAL_VOLUME(D)','SIGNAL_VOLUME(4H)','SIGNAL_VOLUME(1H)']}

rows_data = []
for row in ws_src.iter_rows(min_row=2, values_only=True):
    aka = get_val(row, IDX['AKA'])
    if not aka: continue
    d = {k: get_val(row, v) for k,v in IDX.items()}
    d['AKA'] = aka
    rows_data.append(d)

def classify(d):
    trend_w  = str(d.get('TREND(W)','')).upper()
    trend_4h = str(d.get('TREND(4H)','')).upper()
    trend_1h = str(d.get('TREND(1H)','')).upper()
    rsi_d    = d.get('RSI(D)')
    rsi_w    = d.get('RSI(W)')
    rsi_1h   = d.get('RSI(1H)')
    macd_d   = d.get('MACD_HIST_DELTA(W)')
    ema9     = d.get('EMA9(W)')
    ema21    = d.get('EMA21(W)')
    trigger  = str(d.get('ENTRY_TRIGGER(1H)',''))
    try: rsi_d  = float(rsi_d)
    except: rsi_d = None
    try: rsi_w  = float(rsi_w)
    except: rsi_w = None
    try: rsi_1h = float(rsi_1h)
    except: rsi_1h = None
    try: macd_d = float(macd_d)
    except: macd_d = None
    try: ema9  = float(ema9)
    except: ema9 = None
    try: ema21 = float(ema21)
    except: ema21 = None
    vol_buy = any('BUY' in str(d.get(k,'')).upper()
                  for k in ['SIGNAL_VOLUME(W)','SIGNAL_VOLUME(D)','SIGNAL_VOLUME(4H)','SIGNAL_VOLUME(1H)'])
    if rsi_d and rsi_d >= 70: return 'OVEREXTENDED'
    if 'ENTRY' in trigger or 'TRIGGER' in trigger: return 'BUY_CONFIRMED'
    if (trend_w == 'UP' and trend_4h == 'UP' and trend_1h == 'UP'
            and rsi_1h is not None and rsi_1h < 50): return 'PULLBACK_ZONE'
    if (trend_w == 'UP' and rsi_w and rsi_w > 50 and macd_d and macd_d > 0
            and rsi_d and rsi_d < 70
            and ema9 and ema21 and ema9 > ema21
            and vol_buy): return 'EARLY_WATCH'
    return 'WAIT_RETEST'

for d in rows_data:
    d['STATUS'] = classify(d)

buy_confirmed = [d for d in rows_data if d['STATUS'] == 'BUY_CONFIRMED']
early_watch   = sorted([d for d in rows_data if d['STATUS'] == 'EARLY_WATCH'],
                       key=lambda d: -(float(d['MACD_HIST_DELTA(W)']) if d['MACD_HIST_DELTA(W)'] else 0))
pullback_zone = sorted([d for d in rows_data if d['STATUS'] == 'PULLBACK_ZONE'],
                       key=lambda d: -sum(1 for k_v, k_t in [
                           ('SIGNAL_VOLUME(W)','TREND(W)'),('SIGNAL_VOLUME(D)','TREND(D)'),
                           ('SIGNAL_VOLUME(4H)','TREND(4H)'),('SIGNAL_VOLUME(1H)','TREND(1H)')]
                           if 'BUY' in str(d.get(k_v,'')).upper() and str(d.get(k_t,'')).upper() == 'UP'))
overextended  = [d for d in rows_data if d['STATUS'] == 'OVEREXTENDED']
wait_retest   = [d for d in rows_data if d['STATUS'] == 'WAIT_RETEST']

snap_rows = buy_confirmed + early_watch[:20]
# ค้นหา TARGET_COIN ใน rows_data ถ้าไม่พบใช้แถวแรกสุด
target_coin = next((x for x in rows_data if x.get('AKA') == TARGET_COIN), rows_data[0])
updated     = target_coin.get('UPDATED','') if target_coin else ''
last_candle = target_coin.get('LAST_CANDLE','') if target_coin else ''
first_aka   = target_coin.get('AKA','') if target_coin else ''
source      = target_coin.get('Source','exchange') if target_coin else 'exchange'

# --- Styles ---
GREEN_FILL  = PatternFill("solid", fgColor="C6EFCE")
YELLOW_FILL = PatternFill("solid", fgColor="FFEB9C")
RED_FILL    = PatternFill("solid", fgColor="FFC7CE")
HEADER_FILL = PatternFill("solid", fgColor="1F4E79")
TITLE_FILL  = PatternFill("solid", fgColor="2E75B6")
WHITE_FONT  = Font(bold=True, color="FFFFFF")
BOLD_FONT   = Font(bold=True)
thin        = Side(style='thin', color="CCCCCC")
BORDER      = Border(left=thin, right=thin, top=thin, bottom=thin)
ORANGE_FILL = PatternFill("solid", fgColor="FCE4D6")
STATUS_FILL = {'BUY_CONFIRMED': GREEN_FILL, 'EARLY_WATCH': YELLOW_FILL,
               'OVEREXTENDED': RED_FILL, 'PULLBACK_ZONE': ORANGE_FILL, 'WAIT_RETEST': None}

def set_header(ws, row_num, cols):
    for c, val in enumerate(cols, 1):
        cell = ws.cell(row=row_num, column=c, value=val)
        cell.fill = HEADER_FILL; cell.font = WHITE_FONT
        cell.alignment = Alignment(horizontal='center', wrap_text=True)
        cell.border = BORDER

def write_row(ws, row_num, vals, fill=None):
    for c, val in enumerate(vals, 1):
        cell = ws.cell(row=row_num, column=c, value=val)
        if fill: cell.fill = fill
        cell.alignment = Alignment(horizontal='left')
        cell.border = BORDER

def get_advice(d):
    s = d['STATUS']
    macd_d = d.get('MACD_HIST_DELTA(W)')
    try: macd_d = round(float(macd_d), 4)
    except: pass
    if s == 'BUY_CONFIRMED':  return f'🟢 BUY CONFIRMED — ผ่าน MPTM ครบ + 1H Trigger ยืนยัน'
    if s == 'EARLY_WATCH':    return f'🟡 EARLY/WATCH — MACD Delta W = {macd_d}, รอ 1H Trigger'
    if s == 'OVEREXTENDED':   return f'🔴 OVEREXTENDED — RSI(D) ≥ 70 ห้ามไล่ราคา'
    if s == 'PULLBACK_ZONE':  return f'🟠 PULLBACK ZONE — W/4H/1H=UP แต่ RSI(1H) < 50 กำลังพักฐาน'
    return f'⚪ WAIT/RETEST — โครงสร้างยังไม่พร้อม'

now_str  = datetime.now().strftime('%Y-%m-%d')
now_time = datetime.now().strftime('%H:%M')

wb  = openpyxl.Workbook()
ws1 = wb.active
ws1.title = 'Latest Snapshot'

ws1.merge_cells('A1:O1')
c = ws1['A1']
c.value = '🐋 Latest Active Signals Snapshot (สรุปสัญญาณรอบล่าสุด)'
c.fill = TITLE_FILL; c.font = WHITE_FONT
c.alignment = Alignment(horizontal='center')

snap_headers = ['วันที่อัปเดต','เวลาอัปเดต','ชื่อเหรียญ','SOURCE','TIER','PRICE',
                'LAST_CANDLE','UPDATED','TREND (W)','ENTRY_ZONE (4H)',
                'ENTRY_TRIGGER (1H)','ACTION (1H)','คำแนะนำ','TV URL','Bitkub URL']
set_header(ws1, 2, snap_headers)

r = 3
for d in snap_rows:
    aka    = d['AKA']
    url    = tradingview_url(aka)
    bk_url = f'https://www.bitkub.com/market/{aka}'
    write_row(ws1, r, [
        now_str, now_time, aka,
        d.get('Source','exchange'), d.get('TIER',''), d.get('PRICE',''),
        d.get('LAST_CANDLE',''), d.get('UPDATED',''),
        d.get('TREND(W)',''), d.get('ENTRY_ZONE(4H)',''),
        d.get('ENTRY_TRIGGER(1H)',''), d.get('ACTION(1H)',''),
        get_advice(d),
        f'=HYPERLINK("{url}","{url}")',
        f'=HYPERLINK("{bk_url}","{bk_url}")',
    ], STATUS_FILL.get(d['STATUS']))
    coin_cell = ws1.cell(row=r, column=3)
    set_coin_link(coin_cell, aka)
    r += 1

for i, w in enumerate([12,10,10,10,6,10,18,18,10,16,18,12,55,50,40], 1):
    ws1.column_dimensions[get_column_letter(i)].width = w
ws1.freeze_panes = 'A3'

# --- Sheet 2: Master Signal Log ---
ws2 = wb.create_sheet('Master Signal Log')
try:
    wb_old  = openpyxl.load_workbook(OUTPUT)
    ws_old  = wb_old['Master Signal Log']
    old_rows = list(ws_old.iter_rows(min_row=3, values_only=True))
except: old_rows = []

ws2.merge_cells('A1:P1')
c2 = ws2['A1']
c2.value = '🐋 All-Bitkub Master Signal Log (บันทึกสัญญาณรายรอบ)'
c2.fill = TITLE_FILL; c2.font = WHITE_FONT
c2.alignment = Alignment(horizontal='center')

log_headers = ['วันที่ (Date)','เวลา (Time)','ชื่อเหรียญ (Symbol)','SOURCE','TIER','PRICE',
               'LAST_CANDLE','UPDATED','TREND (W)','ENTRY_ZONE (4H)',
               'ENTRY_TRIGGER (1H)','ACTION (1H)','สถานะสัญญาณ','หมายเหตุ / Action Plan','TV URL','Bitkub URL']
set_header(ws2, 2, log_headers)

r2 = 3
for old_row in old_rows:
    for c, val in enumerate(old_row, 1):
        ws2.cell(row=r2, column=c, value=val).border = BORDER
    if len(old_row) >= 3 and old_row[2]:
        set_coin_link(ws2.cell(row=r2, column=3), old_row[2])
    r2 += 1

status_label = {'BUY_CONFIRMED':'🟢 พร้อมซื้อ','EARLY_WATCH':'🟡 เฝ้าระวัง',
                'OVEREXTENDED':'🔴 Overextended','PULLBACK_ZONE':'🟠 Pullback Zone','WAIT_RETEST':'⚪ รอสร้างฐาน'}
for d in snap_rows:
    aka    = d['AKA']
    url    = tradingview_url(aka)
    bk_url = f'https://www.bitkub.com/market/{aka}'
    write_row(ws2, r2, [
        now_str, now_time, aka,
        d.get('Source','exchange'), d.get('TIER',''), d.get('PRICE',''),
        d.get('LAST_CANDLE',''), d.get('UPDATED',''),
        d.get('TREND(W)',''), d.get('ENTRY_ZONE(4H)',''),
        d.get('ENTRY_TRIGGER(1H)',''), d.get('ACTION(1H)',''),
        status_label.get(d['STATUS'],''), get_advice(d),
        f'=HYPERLINK("{url}","{url}")',
        f'=HYPERLINK("{bk_url}","{bk_url}")',
    ], STATUS_FILL.get(d['STATUS']))
    coin_cell = ws2.cell(row=r2, column=3)
    set_coin_link(coin_cell, aka)
    r2 += 1

for i, w in enumerate([12,10,10,10,6,10,18,18,10,16,18,12,16,55,50,40], 1):
    ws2.column_dimensions[get_column_letter(i)].width = w
ws2.freeze_panes = 'A3'

# --- Sheet 3: REF. ---
ws3 = wb.create_sheet('REF.')
ws3['A1'] = 'รายการ'; ws3['B1'] = 'ลิงก์ข้อมูลอ้างอิง (URL / Reference Link)'
ws3['A1'].font = BOLD_FONT; ws3['B1'].font = BOLD_FONT
ref_url = 'https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit?gid=1772128467#gid=1772128467'
ws3['A2'] = 'REF.'
ws3['B2'] = f'=HYPERLINK("{ref_url}","{ref_url}")'
ws3.column_dimensions['A'].width = 10
ws3.column_dimensions['B'].width = 80

wb.save(OUTPUT)

# --- Liquidity Check ---
import requests as _req

def check_liquidity(aka):
    try:
        sym = f"{aka.lower()}_thb"
        t = _req.get(f'https://api.bitkub.com/api/v3/market/ticker?sym={sym}', timeout=5).json()
        if not t: return '⚫ N/A', 0, 0
        t = t[0]
        bid = float(t.get('highest_bid', 0))
        ask = float(t.get('lowest_ask', 0))
        vol = float(t.get('quote_volume', 0))
        spread_pct = ((ask - bid) / ask * 100) if ask else 999
        if vol >= 1_000_000 and spread_pct < 1.0:
            liq = '🟢 HIGH'
        elif vol >= 300_000 and spread_pct < 2.0:
            liq = '🟡 MEDIUM'
        else:
            liq = '🔴 LOW'
        return liq, vol, spread_pct
    except:
        return '⚫ N/A', 0, 0

print(f"AKA         : {first_aka} 🚀")
print(f"LAST_CANDLE : {last_candle}")
print(f"UPDATED     : {updated}")
print(f"Source      : {source}")
print(f"")
print(f"🟢 BUY CONFIRMED — {len(buy_confirmed)} เหรียญ")
print("| เหรียญ | Tier | Source | RSI(W) | RSI(D) | MACD_D | ราคา | Liquidity |")
print("|---|---|---|---:|---:|---:|---:|---|")

def format_price(value):
    try: return f"{float(value):,.4f}"
    except: return str(value or '')

def tv_markdown_link(aka):
    label = re.sub(r'[^A-Za-z0-9._-]', '', str(aka))
    return f"[{label}]({tradingview_url(label)})"

def print_signal_table(coins):
    for d in coins:
        liq, _, _ = check_liquidity(d['AKA'])
        print(f"| {tv_markdown_link(d['AKA'])} | {d.get('TIER','')} | {d.get('Source','')} | {d.get('RSI(W)','')} | {d.get('RSI(D)','')} | {d.get('MACD_HIST_DELTA(W)','')} | {format_price(d.get('PRICE'))} | {liq} |")

if buy_confirmed:
    print_signal_table(buy_confirmed)
else:
    print("| — | — | — | — | — | — | — | — |")

print("")
print(f"🟡 EARLY/WATCH — {len(early_watch)} เหรียญ (TOP 10)")
print("| เหรียญ | Tier | Source | RSI(W) | RSI(D) | MACD_D | ราคา | Liquidity |")
print("|---|---|---|---:|---:|---:|---:|---|")
print_signal_table(early_watch[:10])

print("")
print(f"🟠 PULLBACK ZONE — {len(pullback_zone)} เหรียญ (TOP 10)")
print("| เหรียญ | Tier | RSI(W) | RSI(1H) | ราคา | VOL (x/4) | TREND (x/4) | CMB (x/4) | Liquidity |")
print("|---|---|---:|---:|---:|---|---|---|---|")
for d in pullback_zone[:10]:
    price = format_price(d.get('PRICE'))
    vw  = '🟢' if 'BUY' in str(d.get('SIGNAL_VOLUME(W)','')).upper()  else '⚪'
    vd  = '🟢' if 'BUY' in str(d.get('SIGNAL_VOLUME(D)','')).upper()  else '⚪'
    v4h = '🟢' if 'BUY' in str(d.get('SIGNAL_VOLUME(4H)','')).upper() else '⚪'
    v1h = '🟢' if 'BUY' in str(d.get('SIGNAL_VOLUME(1H)','')).upper() else '⚪'
    vol_score = sum(1 for v in [vw,vd,v4h,v1h] if v == '🟢')
    tw  = '🟢' if str(d.get('TREND(W)','')).upper()  == 'UP' else '🔴'
    td  = '🟢' if str(d.get('TREND(D)','')).upper()  == 'UP' else '🔴'
    t4h = '🟢' if str(d.get('TREND(4H)','')).upper() == 'UP' else '🔴'
    t1h = '🟢' if str(d.get('TREND(1H)','')).upper() == 'UP' else '🔴'
    trend_score = sum(1 for t in [tw,td,t4h,t1h] if t == '🟢')
    cmb = ['✅' if v=='🟢' and t=='🟢' else '❌' for v,t in zip([vw,vd,v4h,v1h],[tw,td,t4h,t1h])]
    cmb_score = sum(1 for c in cmb if c == '✅')
    liq, vol, spd = check_liquidity(d['AKA'])
    print(f"| {tv_markdown_link(d['AKA'])} | {d.get('TIER','')} | {d.get('RSI(W)','')} | {d.get('RSI(1H)','')} | {price} | {vw}{vd}{v4h}{v1h} ({vol_score}/4) | {tw}{td}{t4h}{t1h} ({trend_score}/4) | {''.join(cmb)} ({cmb_score}/4) | {liq} |")

print("")
print(f"🔴 OVEREXTENDED — {len(overextended)} เหรียญ")
if overextended:
    print(" · ".join(tv_markdown_link(d['AKA']) for d in overextended))
else:
    print("ไม่มีเหรียญในสถานะนี้")
print(f"⚪ WAIT/RETEST — {len(wait_retest)} เหรียญ")
print(f"")
print(f"✅ Saved: {OUTPUT}")
PYEOF

echo "🎉 Done."
