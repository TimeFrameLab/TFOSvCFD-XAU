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
| `UPDATE` | `./update.sh` | ดาวน์โหลด snapshot, รายงาน MPTM ทุกสัญลักษณ์ และแสดง weekly activity กับค่าเฉลี่ย traded value 30D จาก TradingView |
| `UPDATE/<AKA>-<AKA>-...` | `./update.sh UPDATE/XAU` | รายงานเฉพาะสัญลักษณ์ที่ระบุ เช่น `UPDATE/XAU-GOLD` |
| `CANDIDATE` | `./candidate.sh` | คัดรายการที่ W/D/4H พร้อมแล้วและรอ 1H Trigger |
| `REVIEW` | พิมพ์ในแชต | ทบทวนแนวทางและข้อจำกัด |

## 📌 ข้อมูลสำคัญ

ทุกรอบจะดาวน์โหลด XLSX ใหม่จาก Google Sheets ก่อนประมวลผลและบันทึก snapshot ที่ `downloads/All-CFD-MTFS.xlsx` หากดาวน์โหลดหรืออ่านไฟล์ไม่สำเร็จ คำสั่งจะหยุด ไม่ใช้ snapshot เก่าแทน

MPTM ในรายงานอ่านจาก snapshot เท่านั้น รายละเอียด schema, เกณฑ์คัดกรอง และรูปแบบผลลัพธ์อยู่ในหัวข้อ [📊 รูปแบบรายงานและเกณฑ์](#-รูปแบบรายงานและเกณฑ์)

## 📊 รูปแบบรายงานและเกณฑ์

ทุกคำสั่งยึด snapshot MPTM ที่ดาวน์โหลดสำเร็จในรอบปัจจุบัน และแสดง timestamp จากต้นทางตามจริง ไม่คาดเดาค่าที่ขาด รายงานไม่ refresh Apps Script, ไม่เขียนกลับ Google Sheets และไม่ส่งคำสั่งซื้อขาย

### `UPDATE`

`./update.sh` แสดงจำนวนสัญลักษณ์ทั้งหมดและตารางเดียวตามลำดับคอลัมน์:

`AKA | TRADINGVIEW_SYMBOL | MPTM_STATUS | ACTION | BIAS(W) | SETUP(D) | ENTRY_ZONE(4H) | ENTRY_TRIGGER(1H) | PRICE | RSI(W) | RSI(D) | RSI(1H) | MACD_HIST_DELTA(W) | CURRENT_PRICE_VOLUME_ACTIVITY_PROXY | AVG_VALUE_TRADED_30D`

ไม่แบ่งกลุ่ม ไม่ตัดเหลือ TOP N และไม่ซ่อน `WAIT/RETEST`; แสดงข้อมูลทุกสัญลักษณ์ใน snapshot

### `UPDATE/<AKA>-<AKA>-...`

`./update.sh UPDATE/XAU` แสดงเฉพาะสัญลักษณ์ที่ระบุ คงลำดับตามคำขอ และใช้ตาราง:

`AKA | TRADINGVIEW_SYMBOL | MPTM_STATUS | ACTION | BIAS(W) | SETUP(D) | ENTRY_ZONE(4H) | ENTRY_TRIGGER(1H) | PRICE | RSI(W) | RSI(D) | RSI(1H) | MACD_HIST_DELTA(W) | CURRENT_PRICE_VOLUME_ACTIVITY_PROXY | AVG_VALUE_TRADED_30D | LAST_CANDLE | UPDATED`

AKA ที่ไม่อยู่ใน snapshot ทำให้รายงานข้อผิดพลาดและคำสั่งจบด้วย error status

### `CANDIDATE`

`./candidate.sh` คัดกรองสัญญาณ Pre-entry ตามเงื่อนไขทั้งหมด:

1. `BIAS(W)` มีสถานะ `BULLISH`
2. `SETUP(D)` มีสถานะ `READY`, `RECOVERY` หรือ `PULLBACK`
3. `ENTRY_ZONE(4H)` เป็นสถานะสีเขียว
4. `ENTRY_TRIGGER(1H)` เป็นสถานะสีเหลืองเพื่อรอ 1H Trigger

รายงานจำนวนผู้ผ่านทั้งหมด เรียง `MACD_HIST_DELTA(W)` จากมากไปน้อย และแสดงไม่เกิน 25 รายการด้วยคอลัมน์:

`# | AKA | TRADINGVIEW_SYMBOL | PRICE | MACD_HIST_DELTA(W) | BIAS(W) | SETUP(D) | ENTRY_ZONE(4H) | ENTRY_TRIGGER(1H) | LAST_CANDLE | UPDATED | CURRENT_PRICE_VOLUME_ACTIVITY_PROXY | AVG_VALUE_TRADED_30D`

หากไม่มีรายการผ่าน จะแสดงจำนวน 0 และแถว placeholder `—`; คำสั่งนี้แสดงผลใน Terminal และไม่เขียน Excel report

### สถานะ MPTM ที่รายงาน

สถานะจัดจากค่าที่มีอยู่ใน snapshot ตามลำดับความสำคัญต่อไปนี้:

- 🟢 `BUY CONFIRMED`: `ACTION` มีคำว่า `BUY`
- 🔵 `EXIT`: `ACTION` มีคำว่า `EXIT` หรือ `SELL`
- 🔴 `OVEREXTENDED`: `SETUP(D)` มีคำว่า `EXTENDED`
- 🟡 `PRE-ENTRY — WAIT 1H`: ผ่านเงื่อนไข `CANDIDATE`
- ⚪ `WAIT/RETEST`: ไม่เข้าเงื่อนไขข้างต้น

ลำดับนี้หมายถึง `BUY` จะถูกจัดก่อน `EXIT`, `OVEREXTENDED` และ `PRE-ENTRY`. สถานะเป็นการจัดรูปแบบ snapshot ไม่ใช่การยืนยัน signal หรือคำสั่งซื้อขาย

### ค่ากิจกรรมและข้อจำกัด

- `CURRENT_PRICE_VOLUME_ACTIVITY_PROXY` = `close|1W × volume|1W` จาก TradingView CFD Scanner เป็น proxy ของแท่งสัปดาห์ปัจจุบัน ซึ่งอาจยังไม่ปิด
- `AVG_VALUE_TRADED_30D` = `AvgValue.Traded_30d` จาก TradingView CFD Scanner โดยตรง ไม่คำนวณจากแท่งเดือน ไม่คูณ `close × volume` ซ้ำ และไม่หารด้วย 20
- ค่า 30D และ volume ขึ้นกับนิยาม/ข้อมูลของผู้ให้บริการ CFD ไม่รับรองว่าเท่ากับยอดของโบรกเกอร์รายใดรายหนึ่งหรือ turnover ทั้งตลาด และไม่ใช่ bid/ask depth ห้ามใช้ proxy จัดระดับ `HIGH/MEDIUM/LOW` โดยไม่มีเกณฑ์ที่ยืนยัน
- หาก Scanner ไม่มีข้อมูลที่ใช้ได้ ให้แสดง `⚫ N/A` พร้อมคำเตือน และไม่แทนด้วยค่ารอบก่อน ระบบไม่ใช้ Pine CSV หรือ OANDA API
- ใช้ TradingView CFD Scanner endpoint ซึ่งไม่ได้ประกาศเป็น public API อย่างเป็นทางการและอาจเปลี่ยนแปลงหรือหยุดให้บริการ

### Excel report และรูปแบบในแชต

`UPDATE` และ `UPDATE/<AKA>` สร้าง/อัปเดต `downloads/All-CFD-MTFS_output.xlsx` มีชีต `Latest Snapshot`, `Master Signal Log` และ `REF.`; `Master Signal Log` เก็บประวัติ และ schema รุ่นเก่าที่รองรับจะถูกย้ายไปชีต legacy แทนการแปลงเป็นค่า 30D ใหม่ `CANDIDATE` ไม่เขียน workbook

เมื่อนำผลไปสรุปในแชต ให้ใช้ Markdown ที่ render ได้จริงและรักษาคอลัมน์ ลำดับ จำนวน คำเตือน และข้อมูลตามผลจริง อาจทำ `AKA` เป็นลิงก์ TradingView โดยใช้ ticker จาก `TRADINGVIEW_SYMBOL` เช่น [XAU](https://www.tradingview.com/chart/?symbol=OANDA%3AXAUUSD); ห้ามสร้าง GROUP, Finnomena link, VOL/TREND/CMB score หรือเกณฑ์ที่ไม่มีในระบบ รายงานไม่ใช่ Telegram notification

## 🛡️ ขอบเขตและข้อควรระวัง

- ระบบนี้ไม่มีราคา CFD จาก broker account และไม่ส่งคำสั่งซื้อขาย
- ติดตามการแจ้งเตือน 1H Trigger จากช่องทาง [TimeFrame GOLD Notify](https://t.me/TimeFrameGOLDnotify); repository นี้ไม่ได้ส่ง Telegram notification
- ห้ามใส่ API key, session cookie, Telegram token หรือข้อมูลบัญชีใน source code, `.env.example` หรือ Git
- ผลการคำนวณไม่รับรองผลลัพธ์ในอนาคต และไม่แทนการจัดการความเสี่ยง

## 📚 เอกสารที่เกี่ยวข้อง

- [GOOGLE-SHEETS-SETUP.md](./GOOGLE-SHEETS-SETUP.md) — การตั้งค่า snapshot และ symbol mapping
- [TimeFrame-OS-guidelines-and-model-vCFD-XAU.md](./TimeFrame-OS-guidelines-and-model-vCFD-XAU.md) — workflow, schema, MPTM และ Liquidity contract
