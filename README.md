# TimeFrame Operation System — CFD Gold

*A disciplined gold CFD market analysis system powered by systematic workflows and MPTM Architecture.*

## 📋 ภาพรวม

โปรเจกต์นี้จัด workflow วิเคราะห์ CFD Gold แบบ Multi-Timeframe:

- **Google Sheets / Apps Script** สร้างสัญญาณ MPTM ตามลำดับ `W → D → 4H → 1H`
- **CLI ใน repository นี้** ดาวน์โหลด snapshot สัญญาณล่าสุดแบบ read-only, ตรวจ schema,
  คัดกรอง candidate และรายงาน Liquidity proxy จาก TradingView

CLI ไม่ refresh Google Apps Script เอง ไม่เขียนกลับชีตต้นทาง ไม่ส่งคำสั่งซื้อขาย และไม่รับรองว่าราคาหรือ volume ของผู้ให้บริการรายหนึ่งแทน CFD ของโบรกเกอร์อื่นได้

> **ข้อควรระวัง:** ข้อมูลเป็นสัญญาณและค่าประมาณเพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน CFD และ leverage มีความเสี่ยงสูง

## 🔔 การเริ่มต้นใช้งาน

ใช้ Python 3.9 ขึ้นไป:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cp .env.example .env
```

กำหนด `SET_DATA_URL` เป็นลิงก์ Google Sheets ที่อ่านได้โดยไม่ลงชื่อเข้าใช้ และตรวจ `SET_DATA_SHEET` กับ `TRADINGVIEW_SYMBOL_MAP` ใน `.env` ก่อนรัน:

```dotenv
SET_DATA_URL=https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit
SET_DATA_SHEET=All-CFD-MTFS
TRADINGVIEW_SYMBOL_MAP=XAU=OANDA:XAUUSD
```

ชีตต้องมีคอลัมน์ MPTM ตามรายการใน [GOOGLE-SHEETS-SETUP.md](./GOOGLE-SHEETS-SETUP.md) และค่า `AKA` ต้องไม่ซ้ำ ค่า `LAST_CANDLE`/`UPDATED` บอกเวลาจากระบบสร้างสัญญาณต้นทาง ไม่ใช่เวลาที่ CLI ยืนยันความสดของสัญญาณ

## 🧭 คำสั่งหลัก

| คำสั่ง | วิธีใช้ | ผลลัพธ์ |
|---|---|---|
| `START @README.md` | พิมพ์ในแชต | อ่านแนวทางและขอบเขตก่อนเริ่มงาน |
| `UPDATE` | `./update.sh` | ดาวน์โหลด snapshot, รายงาน MPTM ทุกสัญลักษณ์ และแสดง current-week turnover กับ Avg Turnover 20D proxy |
| `UPDATE/<AKA>-<AKA>-...` | `./update.sh UPDATE/XAU` | รายงานเฉพาะสัญลักษณ์ที่ระบุ เช่น `UPDATE/XAU-GOLD` |
| `CANDIDATE` | `./candidate.sh` | คัดรายการที่ W/D/4H พร้อมแล้วและรอ 1H Trigger |
| `REVIEW` | พิมพ์ในแชต | ทบทวนแนวทางและข้อจำกัด |

`UPDATE` และ `UPDATE/<AKA>` สร้าง `downloads/All-CFD-MTFS_output.xlsx` ซึ่งมีชีต `Latest Snapshot`, `Master Signal Log` และ `REF.`; `CANDIDATE` แสดงผลใน Terminal โดยไม่เขียน workbook เพิ่ม

## 📌 ข้อมูลสำคัญ

ทุกรอบจะดาวน์โหลด XLSX ใหม่จาก Google Sheets ก่อนประมวลผลและบันทึก snapshot ที่ `downloads/All-CFD-MTFS.xlsx` หากดาวน์โหลดหรืออ่านไฟล์ไม่สำเร็จ คำสั่งจะหยุด ไม่ใช้ snapshot เก่าแทน

MPTM ในรายงานอ่านจาก snapshot เท่านั้น ส่วน current-week turnover ดึงจาก TradingView Scanner และ Avg Turnover 20D อ่านจาก Pine CSV ที่ export แยกไว้ หากข้อมูลไม่ครบจะแสดง `⚫ N/A` และคำเตือน ไม่มีการใช้ค่าเก่าทดแทน

## 🧩 แนวทางการแสดงผลแบบ TFOS สำหรับ CFD Gold

แนวทางนี้กำหนดรูปแบบรายงานในแชตให้สม่ำเสมอ โดยยึด snapshot MPTM ที่ดาวน์โหลดสำเร็จในรอบนั้นและข้อมูล CFD ที่ workflow ดึงได้จริง ห้ามอนุมานหรือเติมค่าที่ไม่มีในข้อมูล

### กลุ่มสถานะ

จัดกลุ่มจากคอลัมน์ใน snapshot ตาม logic ของรายงาน:

- 🟢 `BUY CONFIRMED`: `ACTION` มีคำว่า `BUY`
- 🔵 `EXIT`: `ACTION` มีคำว่า `EXIT` หรือ `SELL`
- 🔴 `OVEREXTENDED`: `SETUP(D)` มีคำว่า `EXTENDED` และไม่เข้าเงื่อนไข BUY/EXIT ก่อนหน้า
- 🟡 `PRE-ENTRY — WAIT 1H`: ผ่านเงื่อนไข CANDIDATE คือ `BIAS(W)` เป็น bullish, `SETUP(D)` เป็น ready/recovery/pullback, `ENTRY_ZONE(4H)` สีเขียว และ `ENTRY_TRIGGER(1H)` สีเหลือง
- ⚪ `WAIT/RETEST`: ไม่เข้าเงื่อนไขข้างต้น

ใช้ชื่อ symbol เป็น Markdown link ไปยัง TradingView ตาม ticker ใน `TRADINGVIEW_SYMBOL`; รูปแบบลิงก์คือ `https://www.tradingview.com/chart/?symbol=<URL-encoded ticker>` เช่น [XAU](https://www.tradingview.com/chart/?symbol=OANDA%3AXAUUSD). โปรเจกต์นี้ไม่มี `GROUP` แบบหุ้นไทย จึงไม่สร้าง GROUP, Finnomena link, VOL/TREND/CMB score หรือเกณฑ์ที่ไม่มีอยู่ใน snapshot/implementation

### รูปแบบ `UPDATE`

เริ่มด้วยเวลาที่ดาวน์โหลด snapshot และแหล่งข้อมูล จากนั้นแสดง metadata ของแต่ละ symbol จากแถวต้นทาง:

```text
AKA         : XAU
TRADINGVIEW : OANDA:XAUUSD
LAST_CANDLE : <ค่าจาก snapshot>
UPDATED     : <ค่าจาก snapshot>
```

แยกตารางตามสถานะ โดยใช้หัวคอลัมน์ชุดเดียวกันและคงลำดับนี้:

`AKA | TRADINGVIEW_SYMBOL | MPTM_STATUS | ACTION | BIAS(W) | SETUP(D) | ENTRY_ZONE(4H) | ENTRY_TRIGGER(1H) | PRICE | RSI(W) | RSI(D) | RSI(1H) | MACD_HIST_DELTA(W) | CURRENT_WEEK_TURNOVER_PROXY | AVG_TURNOVER_20D_PROXY`

หัวข้อแต่ละกลุ่มต้องแสดงจำนวน symbol; `WAIT/RETEST` แสดงเฉพาะหัวข้อกับจำนวน ไม่แสดงรายชื่อหรือตาราง ตัวอย่างเช่น `⚪ WAIT/RETEST — 1 สัญลักษณ์`. กลุ่มอื่นแสดงทุกรายการที่อยู่ใน snapshot โดยไม่ตัดเหลือ TOP N และไม่สลับลำดับคอลัมน์

### รูปแบบ `UPDATE/<AKA>-<AKA>-...`

แสดง metadata `AKA`, `TRADINGVIEW`, `LAST_CANDLE`, `UPDATED` แยกทีละ symbol ตามลำดับที่ร้องขอ แล้วแสดงหัวข้อ `🔵 SPECIFIED CFD — n สัญลักษณ์` และตาราง:

`AKA | TRADINGVIEW_SYMBOL | MPTM_STATUS | ACTION | BIAS(W) | SETUP(D) | ENTRY_ZONE(4H) | ENTRY_TRIGGER(1H) | PRICE | RSI(W) | RSI(D) | RSI(1H) | MACD_HIST_DELTA(W) | CURRENT_WEEK_TURNOVER_PROXY | AVG_TURNOVER_20D_PROXY | LAST_CANDLE | UPDATED`

AKA ในทุกแถวเป็นลิงก์ TradingView; คงลำดับที่ร้องขอ ไม่จัดอันดับด้วย score ที่ไม่มีในระบบ หาก AKA ไม่อยู่ใน snapshot ให้รายงานข้อผิดพลาดและไม่อ้างว่าคำสั่งสำเร็จ

### รูปแบบ `CANDIDATE`

ใช้หัวข้อ `ผลการค้นหา CANDIDATE (MPTM W→D→4H→1H, รอ 1H Trigger) — n รายการ` และ schema เฉพาะนี้:

`# | AKA | TRADINGVIEW_SYMBOL | PRICE | MACD_HIST_DELTA(W) | BIAS(W) | SETUP(D) | ENTRY_ZONE(4H) | ENTRY_TRIGGER(1H) | LAST_CANDLE | UPDATED | CURRENT_WEEK_TURNOVER_PROXY | AVG_TURNOVER_20D_PROXY`

เรียง `MACD_HIST_DELTA(W)` จากมากไปน้อย แสดงจำนวนผู้ผ่านทั้งหมดและไม่เกิน 25 แถว ตามพฤติกรรม CLI; ลำดับคอลัมน์ต้องคงเดิมและ AKA ในรายงานแชตเป็นลิงก์ TradingView

### ✅ ข้อกำหนดผลลัพธ์

- รายงานในแชตเป็น Markdown ที่ render ได้จริง ไม่ครอบด้วย code fence; คงข้อมูล คอลัมน์ และคำเตือนตามผลจริง
- ใช้เฉพาะ snapshot ที่ดาวน์โหลดสำเร็จล่าสุดในรอบปัจจุบัน ไม่อ้างอิง snapshot เก่าหรือใช้ HTTP cache เป็นข้อมูลใหม่
- แสดง timestamp `LAST_CANDLE`/`UPDATED` ตามค่าต้นทางเท่านั้น; หากว่างให้แสดง `⚫ N/A` และแจ้งเตือน ไม่คาดเดาหรือสร้าง timestamp
- แสดง current-week turnover และ Avg Turnover 20D แยกกัน; หาก feed หรือ CSV ไม่มีข้อมูลให้แสดง `⚫ N/A` พร้อม warning และไม่ใช้ค่ารอบก่อนทดแทน
- แจ้งข้อผิดพลาดเมื่อ snapshot ดาวน์โหลด/อ่านไม่ได้, schema ที่จำเป็นขาด, หรือ AKA ที่ระบุไม่พบ; อย่ารายงานผลสำเร็จโดยไม่มีข้อมูล
- `UPDATE` สร้าง/อัปเดต Excel report; `CANDIDATE` แสดงผลใน Terminal และไม่เขียน workbook

## 🧩 Liquidity proxy จาก TradingView

รายงานแยกตัวเลขสองแบบ ไม่ใช้แทนกัน:

```text
Current week turnover proxy = current 1W close × current 1W volume
Avg Turnover 20D proxy = sum(close × volume, 4 completed 1W bars) / 20
```

ค่า current-week turnover ดึงจาก TradingView CFD Scanner ตาม `TRADINGVIEW_SYMBOL_MAP` และเป็นข้อมูลสัปดาห์ปัจจุบันที่อาจยังไม่ปิด ส่วน Avg Turnover 20D ใช้สูตรประมาณการตามแนวทาง [TFOSvS](https://github.com/TimeFrameLab/TFOSvS) ผ่าน Pine CSV เนื่องจาก Scanner ไม่ได้ส่งประวัติ weekly ย้อนหลังครบสี่แท่ง

### เตรียม Pine CSV สำหรับ Avg Turnover 20D

1. เปิด TradingView chart ของ symbol ที่ตรงกับ `TRADINGVIEW_SYMBOL_MAP` และเลือก timeframe `1W`.
2. เพิ่ม [tradingview-cfd-gold-liquidity.pine](./tradingview-cfd-gold-liquidity.pine) ลงใน Pine Editor แล้วเพิ่ม indicator ลงบน chart.
3. ใช้ **Export chart data** และบันทึก CSV เป็น `downloads/tradingview-liquidity/<AKA>.csv` เช่น `downloads/tradingview-liquidity/XAU.csv`. สร้างโฟลเดอร์ปลายทางก่อน หากยังไม่มี.
4. เก็บคอลัมน์ `TFOS_AVG_TURNOVER_20D_USD_DAY` ไว้ใน CSV; workflow จะอ่านค่าล่าสุดที่ใช้ได้จากคอลัมน์นี้.

ต้อง export CSV ใหม่ตามรอบที่ต้องการวิเคราะห์ เพราะ CLI ไม่ตรวจความสดของ Pine CSV และไม่ยืนยันว่า export มาจากแท่งล่าสุด ค่าทั้งสองเป็น provider-specific proxy ไม่ใช่มูลค่าซื้อขายทั้งตลาด, bid/ask depth หรือสภาพคล่องที่รับประกัน และอาจต่างจาก CFD broker ที่ใช้งาน หากไม่มี CSV หรือข้อมูลไม่ครบจะแสดง `⚫ N/A` พร้อม warning โดยไม่ใช้ค่าเก่าแทน ไฟล์ใน `downloads/` ไม่ถูกติดตามโดย Git

Scanner ใช้ ticker เช่น `OANDA:XAUUSD` ผ่าน CFD endpoint โดยไม่ใช้ session cookie หรือ credential; endpoint นี้ไม่ได้ประกาศเป็น public API อย่างเป็นทางการและอาจเปลี่ยนแปลงหรือหยุดให้บริการ

## 🔍 MPTM และ CANDIDATE

ระบบสร้างสัญญาณต้นทางจัดลำดับ `W → D → 4H → 1H`:

1. `BIAS(W)` ให้บริบทแนวโน้มภาพใหญ่
2. `SETUP(D)` ระบุความพร้อมของ setup
3. `ENTRY_ZONE(4H)` ยืนยันโซน
4. `ENTRY_TRIGGER(1H)` ยืนยันจังหวะเข้า
5. `ACTION` เป็นผลสรุปรวมจากแต่ละชั้นตาม logic ต้นทาง

`CANDIDATE` ใช้รูปแบบ Pre-entry ที่สอดคล้องกับ workflow ใน Apps Script:

- `BIAS(W)` เป็น `BULLISH`
- `SETUP(D)` เป็น `READY`, `RECOVERY` หรือ `PULLBACK`
- `ENTRY_ZONE(4H)` เป็นสถานะสีเขียว
- `ENTRY_TRIGGER(1H)` ยังเป็นสถานะสีเหลืองเพื่อรอการยืนยัน

ตัวกรองนี้เรียงตาม `MACD_HIST_DELTA(W)` จากมากไปน้อย แสดงจำนวนผู้ผ่านทั้งหมดและไม่เกิน 25 แถว ไม่สร้างหรือคำนวณ signal ใหม่จาก quote snapshot และไม่ถือว่าเป็นคำสั่งซื้อขาย

## 📊 สถานะในรายงาน

- **BUY CONFIRMED**: `ACTION` มีสถานะ BUY จาก snapshot ต้นทาง
- **EXIT**: `ACTION` มีสถานะ EXIT/SELL จาก snapshot ต้นทาง
- **OVEREXTENDED**: `SETUP(D)` ระบุ EXTENDED
- **PRE-ENTRY — WAIT 1H**: ผ่านเงื่อนไข CANDIDATE ข้างต้น
- **WAIT/RETEST**: ยังไม่เข้ากลุ่มข้างต้น

สถานะเหล่านี้เป็นการจัดรูปแบบข้อมูลจากต้นทางเท่านั้น ไม่ใช่การรับรอง signal หรือผลตอบแทน

เมื่อนำผลไปสรุปในแชต ให้แสดงรายการสถานะที่มีข้อมูลเป็นตารางและทำชื่อ symbol เป็นลิงก์ TradingView; สำหรับ `WAIT/RETEST` ให้แสดงเฉพาะหัวข้อกับจำนวนรายการ ไม่ต้องแจกแจงรายชื่อ แนวทางนี้เป็นรูปแบบการสรุป ไม่ได้หมายความว่า CLI ส่งข้อความหรือ Telegram notification เอง

## 🛡️ ขอบเขตและข้อควรระวัง

- ระบบนี้ไม่มีราคา CFD จาก broker account และไม่ส่งคำสั่งซื้อขาย
- ค่า volume และ Liquidity proxy เป็น provider-specific; ไม่เทียบเท่า market-wide turnover หรือ order-book liquidity
- TradingView Scanner เป็น endpoint ที่ไม่รับรองความคงที่ของ schema; เมื่อเรียกไม่สำเร็จให้ตรวจข้อมูลและลองภายหลัง
- ติดตามการแจ้งเตือน 1H Trigger จากช่องทาง [TimeFrame GOLD Notify](https://t.me/TimeFrameGOLDnotify); repository นี้ไม่ได้ส่ง Telegram notification
- CLI ตรวจความครบถ้วนของ snapshot แต่ไม่ได้สั่งให้ Apps Script อัปเดต และไม่ได้ประเมินความสดของ `UPDATED`
- ห้ามใส่ API key, session cookie, Telegram token หรือข้อมูลบัญชีใน source code, `.env.example` หรือ Git
- ผลการคำนวณไม่รับรองผลลัพธ์ในอนาคต และไม่แทนการจัดการความเสี่ยง

## 📚 เอกสารที่เกี่ยวข้อง

- [GOOGLE-SHEETS-SETUP.md](./GOOGLE-SHEETS-SETUP.md) — การตั้งค่า snapshot และ symbol mapping
- [TimeFrame-OS-guidelines-and-model-vCFD-XAU.md](./TimeFrame-OS-guidelines-and-model-vCFD-XAU.md) — workflow, schema, MPTM และ Liquidity contract
