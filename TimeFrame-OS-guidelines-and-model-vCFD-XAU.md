# TimeFrame OS — CFD Gold Guidelines

## 📋 สถานะและขอบเขต

TFOSvCFD-XAU เป็น read-only workflow สำหรับอ่าน snapshot สัญญาณ CFD Gold จาก Google Sheets แล้วรายงาน MPTM พร้อม price-volume activity proxies

- Google Sheets เป็นแหล่ง snapshot ของ MPTM signals
- TradingView CFD Scanner ให้ current-week close/volume
- TradingView CFD Scanner ให้ค่าเฉลี่ย traded value 30D จาก `AvgValue.Traded_30d`
- ไม่ใช้ Pine CSV หรือ OANDA API สำหรับ activity proxy
- `update.sh` ไม่เรียก Apps Script และไม่ refresh สัญญาณในชีต
- ไม่มีการเขียนกลับ Google Sheets หรือส่งคำสั่งซื้อขาย

## 🔔 Runtime และคำสั่ง

Implementation อยู่ใน [cfd-xau_update.sh](./cfd-xau_update.sh) ซึ่งเป็น Bash entrypoint ที่รัน Python inline โดยใช้ `requests` และ `openpyxl` จาก `requirements.txt`.

| คำสั่ง | หน้าที่ |
|---|---|
| `./update.sh` | ดาวน์โหลด snapshot ใหม่ รายงานทุก AKA และสร้าง Excel report |
| `./update.sh UPDATE/XAU` | รายงาน AKA ที่ระบุและสร้าง Excel report |
| `./update.sh UPDATE/XAU-XAG` | รายงานหลาย AKA ตามลำดับที่ระบุ |
| `./candidate.sh` | คัด Pre-entry ตามสถานะ MPTM W→D→4H→1H |

ทุกคำสั่งดาวน์โหลด XLSX ใหม่ก่อนทำงาน หากดาวน์โหลดหรืออ่าน workbook ไม่สำเร็จให้หยุด ไม่ใช้ snapshot เก่าทดแทน

## 🔄 Data flow

1. อ่าน `.env` ในเครื่องโดยไม่พิมพ์ค่า config หรือ URL ออกในรายงาน
2. ดาวน์โหลด XLSX จาก Google Sheets export endpoint
3. ตรวจว่ามีชีตและหัวคอลัมน์ MPTM ที่จำเป็นภายใน 10 แถวแรก
4. ตรวจ `AKA` ว่าไม่ซ้ำ และเลือกแถวตามคำสั่ง
5. ใช้ `ACTION`, `BIAS(W)`, `SETUP(D)`, `ENTRY_ZONE(4H)` และ `ENTRY_TRIGGER(1H)` จาก snapshot โดยไม่คำนวณ signal ซ้ำ
6. ขอค่า `close|1W`, `volume|1W` และ `AvgValue.Traded_30d` จาก TradingView CFD Scanner
7. รายงานค่า 30D ตรงตาม field จาก TradingView โดยไม่คำนวณหรือหารด้วย 20
8. `UPDATE` และ `UPDATE/<AKA>` สร้าง snapshot/report workbook; `CANDIDATE` แสดงตารางใน Terminal เท่านั้น

## 📐 Schema ของ snapshot

ชื่อชีตค่าเริ่มต้นคือ `All-CFD-MTFS`; เปลี่ยนได้ด้วย `SET_DATA_SHEET`. Header row ต้องอยู่ใน 10 แถวแรก และต้องมีคอลัมน์:

`AKA`, `ACTION`, `BIAS(W)`, `SETUP(D)`, `ENTRY_ZONE(4H)`,
`ENTRY_TRIGGER(1H)`, `PRICE`, `RSI(W)`, `RSI(D)`, `RSI(1H)`,
`MACD_HIST_DELTA(W)`, `LAST_CANDLE`, `UPDATED`

ค่า `AKA` ต้องไม่ซ้ำ `LAST_CANDLE` และ `UPDATED` แสดงตามค่าที่ producer เขียนไว้ ไม่ได้รับการตรวจความสดจาก CLI

## 🎯 กติกา MPTM และ CANDIDATE

การจัดชั้นสัญญาณมาจาก producer ตามลำดับ:

1. `BIAS(W)` — บริบททิศทางภาพใหญ่
2. `SETUP(D)` — ความพร้อมรายวัน
3. `ENTRY_ZONE(4H)` — โซนโครงสร้าง
4. `ENTRY_TRIGGER(1H)` — trigger ระยะสั้น
5. `ACTION` — ผลรวมที่ producer ระบุ

`CANDIDATE` เป็น Pre-entry เมื่อเงื่อนไขทั้งหมดเป็นจริง:

- `BIAS(W)` มีสถานะ `BULLISH`
- `SETUP(D)` มีสถานะ `READY`, `RECOVERY` หรือ `PULLBACK`
- `ENTRY_ZONE(4H)` ขึ้นต้นด้วยสถานะสีเขียว
- `ENTRY_TRIGGER(1H)` ขึ้นต้นด้วยสถานะสีเหลือง เพื่อรอ trigger

เรียงตาม `MACD_HIST_DELTA(W)` จากมากไปน้อย แสดงจำนวนผู้ผ่านทั้งหมดและไม่เกิน 25 แถว หากข้อมูลขาดหรือไม่มีแถวผ่าน ให้แสดงข้อเท็จจริงตาม snapshot; ห้ามเติม signal หรือคาดเดาค่าที่หายไป

## 💧 Liquidity proxy

แสดงค่า price-volume activity 2 ชนิดแยกกันต่อ symbol:

```text
Current week activity proxy = current 1W close × current 1W volume
30D average traded value = TradingView AvgValue.Traded_30d
```

ค่า current-week คำนวณจาก Scanner และแท่งอาจยังไม่ปิด; ค่า `AvgValue.Traded_30d` อ่านตรงจาก Scanner โดยไม่ทำสูตรแปลงเพิ่ม. Workflow ไม่อ่าน Pine CSV หรือเรียก OANDA API.

ค่าเหล่านี้ขึ้นกับ provider และนิยามของ TradingView; ไม่รับรองว่าเท่ากับมูลค่าซื้อขายจาก broker หรือ market-wide turnover และไม่ใช่ bid/ask depth. ไม่จัดระดับ `HIGH/MEDIUM/LOW` โดยไม่มีเกณฑ์ที่ยืนยันแล้ว.

TradingView Scanner endpoint ไม่ได้ประกาศเป็น public API อย่างเป็นทางการ จึงอาจเปลี่ยน schema, จำกัด request หรือหยุดให้บริการได้

## 📊 Output contract

- แสดง timestamp ที่ดาวน์โหลด snapshot และแสดงค่า `LAST_CANDLE`/`UPDATED` จากแถวต้นทาง
- ตารางใช้ข้อมูล MPTM จาก snapshot และเพิ่ม `TRADINGVIEW_SYMBOL`, `CURRENT_PRICE_VOLUME_ACTIVITY_PROXY` กับ `AVG_VALUE_TRADED_30D`
- `CANDIDATE` ใช้ schema แยกและไม่แสดงสถานะ BUY/EXIT ที่ไม่ได้ผ่านตัวกรอง Pre-entry
- `UPDATE` เขียน `downloads/All-CFD-MTFS.xlsx` และ `downloads/All-CFD-MTFS_output.xlsx`; ไฟล์ใน `downloads/` ไม่ถูกติดตามโดย Git
- Workbook output มี `Latest Snapshot`, `Master Signal Log` และ `REF.`; หาก schema ประวัติเดิมไม่ตรงให้หยุดแทนการเขียนทับอย่างเงียบ ๆ
- Warning ของ activity proxy ต้องระบุ AKA ที่ไม่มี mapping หรือข้อมูล Scanner ไม่ครบ
- ห้ามแสดงค่าเก่าทดแทนข้อมูลใหม่ที่ดึงไม่ได้

## ⚠️ ข้อจำกัดและความปลอดภัย

- รายงานใช้ MPTM จาก snapshot ที่ดาวน์โหลด แต่ไม่ได้สั่ง refresh Google Apps Script; ให้ตรวจ timestamp และสถานะข้อมูลต้นทาง
- ราคาหรือ volume จาก TradingView อาจต่างจาก CFD broker ที่ใช้งาน
- Scanner call ไม่ใช้ session cookies; ห้ามเพิ่ม cookie, API key, Telegram token หรือ credential ลง source code
- `.env` ใช้เฉพาะในเครื่องและต้องไม่ commit; `.env.example` มีเพียง placeholder และค่าตัวอย่างที่ไม่เป็นความลับ
- CFD และ leverage มีความเสี่ยงสูง สถานะในรายงานไม่ใช่คำสั่งซื้อขายหรือคำแนะนำการลงทุน

เอกสารใช้งานและติดตั้งอยู่ใน [README.md](./README.md) และ [GOOGLE-SHEETS-SETUP.md](./GOOGLE-SHEETS-SETUP.md).
