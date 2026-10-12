# TFOSvX (TimeFrame Operation System vX)
ระบบปฎิบัติการเชิงระบบและหลักการตัดสินใจ (Operation Systematic Workflow & MPTM Architecture)

# 🔔 การเริ่มต้นใช้งาน
1. ติดตั้ง [Devin](https://devin.ai/download) และสร้างโฟลเดอร์ใน root ของโปรเจกต์ และดาวน์โหลดไฟล์ [TFOSvX](https://github.com/TimeFrameLab/TFOSvX/archive/refs/heads/main.zip) แล้วแตกไฟล์ออกเป็นโฟลเดอร์ ใส่ในโฟลเดอร์นั้น
2. เปิด TFOSvX.code-workspace → README.md
3. เริ่มต้นการทำงานด้วยการพิมพ์ `START @README.md` ใน Agent Chat ของ Devin ที่อยู่ในโฟลเดอร์โปรเจกต์ ระบบต้องอ่านและ REVIEW `@TimeFrame-OS-guidelines-and-model-vX.md` ให้ครบก่อนตอบรับและรอคำสั่งถัดไป

# 🐋 TimeFrame OS (vX)

ระบบวิเคราะห์สัญญาณซื้อขายคริปโตเคอร์เรนซีด้วย **Momentum Phase Transition Model (MPTM)** — โมเดลสถาปัตยกรรมระบบที่ออกแบบมาเพื่อวิเคราะห์และค้นหา "พฤติกรรมก่อนการระเบิดตัวของราคา" (Pre-Run Behavior) ด้วยการคัดกรองตามโครงสร้างไทม์เฟรม W → D → 4H → 1H

## 📋 ภาพรวม

TimeFrame OS (vX) เป็นระบบอัตโนมัติสำหรับ:
- ดาวน์โหลดข้อมูลตลาดจาก Reference Sheet (Google Sheets)
- ประมวลผลสัญญาณตามหลัก MPTM
- คัดกรองเหรียญตามเกณฑ์ทางเทคนิคที่เข้มงวด
- สร้างรายงาน Excel แบบ 3 ชีท
- ตรวจสอบสภาพคล่อง (Liquidity) จาก Bitkub API
- ส่งคำสั่งซื้อขายอัตโนมัติผ่าน Bitkub API

## ✨ คุณสมบัติหลัก

### 🔍 ระบบคัดกรอง MPTM
- **Direction Filter**: ตรวจสอบทิศทางภาพใหญ่ (W → D)
- **Momentum Acceleration**: ตรวจวัดอัตราเร่งโมเมนตัม (MACD Histogram Delta)
- **Volume Confirmation**: ยืนยันด้วยปริมาณการซื้อขาย
- **Structure Shift**: ตรวจสอบการเปลี่ยนผ่านโครงสร้างราคา (Reversal → Breakout)
- **Relative Strength**: เปรียบเทียบความแข็งแกร่งเทียบกับ BTC
- **Liquidity Guard**: ตัวกรองสภาพคล่องก่อนส่งคำสั่งซื้อขาย

### 📊 รายงาน Excel 3 ชีท
1. **Latest Snapshot**: สรุปสัญญาณรอบล่าสุดพร้อมคำแนะนำ
2. **Master Signal Log**: บันทึกประวัติสัญญาณรายรอบ (Append-Only)
3. **REF.**: เก็บลิงก์ Reference Sheet ต้นทาง

### 🎯 การจำแนกสถานะ
- 🟢 **BUY CONFIRMED**: ผ่าน MPTM ครบ + 1H Trigger ยืนยัน
- 🟡 **EARLY/WATCH**: ผ่าน MPTM แต่รอ 1H Trigger
- 🟠 **PULLBACK ZONE**: W/4H/1H=UP แต่ RSI(1H) < 50 (กำลังพักฐาน)
- 🔴 **OVEREXTENDED**: RSI(D) ≥ 70 (ห้ามไล่ราคา)
- ⚪ **WAIT/RETEST**: โครงสร้างยังไม่พร้อม

เมื่อแสดงรายงานผลในแชท ให้แสดงเหรียญในสถานะ `BUY CONFIRMED`, `EARLY/WATCH`, `PULLBACK ZONE` และ `OVEREXTENDED` เป็นตาราง โดยชื่อเหรียญเป็นลิงก์ TradingView ส่วน `WAIT/RETEST` ให้แสดงเฉพาะหัวข้อและจำนวนเหรียญ เช่น `⚪ WAIT/RETEST — 315 เหรียญ` ไม่ต้องแสดงรายชื่อหรือตาราง

**หมายเหตุ:** ผลการจัดกลุ่มนี้อ้างอิงจากข้อมูล MPTM ที่อัปเดตล่าสุด ไม่ถือเป็นคำสั่งซื้อขายอัตโนมัติ โดยให้รอ 1H Trigger ตามเงื่อนไขในคู่มือก่อนพิจารณาเข้าซื้อ ทั้งนี้ สามารถติดตามการแจ้งเตือน 1H Trigger ได้ทาง Telegram: [TimeFrame CRYPTO Notify](https://t.me/TimeFrameCRYPTOnotify)

### รูปแบบผลลัพธ์คำสั่ง CANDIDATE

แสดงหัวข้อ `ผลการค้นหา CANDIDATE (PRE-ENTRY-Like Pattern) — n เหรียญ` ตามด้วยคำอธิบาย `ผ่านเกณฑ์ MPTM 6 ข้อ เรียงตาม MACD Delta (W) สูงสุด — รอ 1H Trigger ยืนยัน` แล้วแสดง Markdown table ไม่เกิน 20 อันดับ เรียง MACD Delta (W) จากมากไปน้อยและใช้คอลัมน์ตามลำดับนี้:

`# | เหรียญ | Tier | ราคา (THB) | MACD Δ(W) | Entry Zone (4H) | 1H Trigger | Liquidity`

`n` คือจำนวนเหรียญทั้งหมดที่ผ่านเกณฑ์ก่อนจำกัดการแสดงผล ชื่อเหรียญต้องเป็นลิงก์ TradingView ส่วน `Liquidity` ต้องตรวจจาก Bitkub API ล่าสุดและแสดงเป็น `🟢 HIGH`, `🟡 MEDIUM`, `🔴 LOW` หรือ `⚫ N/A` ตามวิธีใน `update.sh`; ห้ามคาดเดาค่า

## 🚀 การติดตั้งและตั้งค่าเริ่มต้น

### 1. ข้อกำหนดเบื้องต้น (Prerequisites)
- **ระบบปฏิบัติการ**
  - macOS หรือ Linux
  - Windows ใช้งานได้ผ่าน **WSL2 (แนะนำ Ubuntu)** โดยต้องรันสคริปต์ในเทอร์มินัล Ubuntu; ไม่รองรับการรันไฟล์ `.sh` โดยตรงใน Command Prompt หรือ PowerShell
- **Git** สำหรับโคลนโครงการจาก GitHub
- **Python 3** และไลบรารีที่จำเป็น:
  ```bash
  pip3 install openpyxl requests
  ```
- **curl** สำหรับดาวน์โหลดข้อมูล และ **openssl** สำหรับลงลายเซ็น API request
- **Bitkub API Key** และ **API Secret** สำหรับฟีเจอร์ตรวจสอบพอร์ตหรือส่งคำสั่งซื้อขาย
- สามารถใช้ AI ช่วยแนะนำการติดตั้งเครื่องมือ ตั้งค่า `.env` และแก้ปัญหาเบื้องต้นได้ โดยให้รันคำสั่งใน Terminal ที่รองรับ (บน Windows ให้ใช้ WSL2) และกรอก API Key/Secret ด้วยตนเอง **อย่าส่งข้อมูลลับให้ AI หรือเผยแพร่ในแชท**

### 2. โคลนโครงการ
```bash
git clone https://github.com/TimeFrameLab/TFOSvX.git
cd TFOSvX
```

### 3. ตั้งค่า Environment Variables
สร้างไฟล์ `.env` ในโฟลเดอร์โครงการ:

```bash
# Reference Sheet URL (Google Sheets)
REF_SHEET_URL=https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit?usp=sharing

# Bitkub API Credentials (สำหรับฟีเจอร์การซื้อขาย)
BITKUB_API_KEY=your_api_key_here
BITKUB_API_SECRET=your_api_secret_here
```

**หมายเหตุ**: หากไม่ได้ตั้งค่า `REF_SHEET_URL` คำสั่ง `UPDATE` จะแจ้งให้ตั้งค่าและหยุดทำงานด้วยรหัสข้อผิดพลาด โดยไม่ดาวน์โหลดชีตหรือประมวลผลรายงาน ส่วน `PORTFOLIO` ทำงานต่อได้ โดยแสดง Tier เป็น `N/A` เมื่อไม่มี `REF_SHEET_URL` หรืออ่าน/จับคู่ Tier จาก REF Sheet ไม่ได้; `TARGET` จะแจ้งว่าอ่าน Tier ไม่ได้และไม่แสดง Target Price หรือคำสั่งขายแนะนำ

หากต้องการสร้าง Google Sheet และ Apps Script เพื่ออัปเดตข้อมูลเหรียญสำหรับใช้งานเอง ดู [คู่มือการตั้งค่า Google Sheets](./GOOGLE-SHEETS-SETUP.md), [Apps Script ต้นแบบสำหรับเริ่มต้น](./examples/All-Bitkub-BATCH-starter.gs) หรือ [สคริปต์ MTFS ฉบับเต็มพร้อม Trigger รายชั่วโมง](./examples/All-Bitkub-MTFS.gs)

### 4. ตั้งค่า Script Permissions
```bash
chmod +x update.sh trade.sh portfolio.sh cancel.sh
```

## 📖 วิธีการใช้งาน

### เริ่มต้นการทำงาน (START Command)

เมื่อเปิดไฟล์โปรเจกต์นี้ ให้พิมพ์คำสั่ง **`START @README.md`** เพื่อเริ่มต้นการทำงาน:

```
START @README.md
```

**สิ่งที่เกิดขึ้น**:
1. อ่านและ REVIEW เนื้อหาใน `README.md` และ `TimeFrame-OS-guidelines-and-model-vX.md` ให้ครบ โดยเฉพาะกฎการทำงานและ Required Answer Format
2. ใช้ guideline เป็นมาตรฐานหลักสำหรับการวิเคราะห์และรูปแบบการแสดงผลทุกคำสั่งที่เกี่ยวข้อง ห้ามละหัวข้อ บรรทัดบังคับ ลำดับข้อมูล หัวคอลัมน์ หรือลิงก์ตามที่กำหนด และห้ามแทนข้อมูลจริงด้วยการคาดเดา
3. ตรวจสอบสถานะระบบและการตั้งค่า `.env` ตามที่จำเป็น โดยไม่เปิดเผยค่าความลับ
4. ตอบรับว่า REVIEW แล้วเมื่ออ่านไฟล์ครบจริง จากนั้นพร้อมรับคำสั่งถัดไป เช่น `UPDATE`, `UPDATE/BTC-ETH-SOL`, `MONEY`, `PORTFOLIO`, `CANDIDATE`, `TARGET`, `CANCEL`, หรือคำสั่งซื้อขาย หากอ่านไฟล์ไม่ได้ ต้องแจ้งข้อจำกัดและห้ามอ้างว่า REVIEW ครบแล้ว

**ข้อบังคับหลัง START:** ทุกคำตอบหลังจากนั้นต้องใช้รูปแบบใน `TimeFrame-OS-guidelines-and-model-vX.md` อย่างเคร่งครัดในส่วนที่เกี่ยวข้องกับคำสั่งนั้น โดยยึด Required Answer Format และ schema ของแต่ละคำสั่งเป็นหลัก หากข้อมูลที่ guideline บังคับต้องใช้ไม่มีหรือดึงไม่ได้ ให้แจ้งสถานะข้อมูลตามคู่มือแทนการละรูปแบบหรือแต่งข้อมูลขึ้นเอง

### คำสั่งหลักที่ใช้งาน

| คำสั่ง | การใช้งาน | ผลลัพธ์ |
|:---|:---|:---|
| `START @README.md` | พิมพ์ในแชท | อ่าน README และ REVIEW guideline ให้ครบ ยึดรูปแบบแสดงผลตาม guideline อย่างเคร่งครัด แล้วรอคำสั่งถัดไป |
| `UPDATE` | รัน `./update.sh` | ดาวน์โหลดข้อมูลล่าสุด + ประมวลผล MPTM + ตรวจ Liquidity |
| `UPDATE/<AKA>-<AKA>-...` | เช่น `./update.sh UPDATE/BTC-ETH-SOL` | อัปเดตข้อมูลและ Workbook ตามปกติ แต่แสดงเฉพาะเหรียญที่ระบุในตาราง `🔵 SPECIFIED COIN` |
| `MONEY` | รัน `./trade.sh "MONEY"` | ตรวจยอดเงินบาทคงเหลือ |
| `TARGET/COIN` | รัน `./trade.sh "TARGET/BTC"` | ตรวจยอดเหรียญ คำนวณ Target Price ตาม TIER และเสนอคำสั่ง Limit Sell (ไม่ส่งคำสั่งขาย) |
| `CANCEL/COIN` | รัน `./cancel.sh "CANCEL/BTC"` | อ่าน Open Orders และแสดง BUY/SELL ที่ยังเปิด พร้อมคำสั่งยกเลิกราย Order ID โดยไม่ส่งคำขอยกเลิก |
| `CANCEL/COIN/SELL/ID=<ORDER_ID>` หรือ `CANCEL/COIN/BUY/ID=<ORDER_ID>` | รัน `./cancel.sh "CANCEL/BTC/SELL/ID=<ORDER_ID>"` | ตรวจยืนยัน Order ID/ฝั่งที่ยังเปิดก่อนยกเลิก แล้วอ่าน Open Orders ซ้ำ |
| `PORTFOLIO` | รัน `./portfolio.sh` | แสดง Portfolio + ราคาซื้อเฉลี่ย + กำไร/ขาดทุน + %P/L พร้อมราคาและปริมาณคำสั่งขาย Limit ที่ยังเปิดอยู่ |
| `CANDIDATE` | ค้นหาใน Excel | แสดงเหรียญที่ผ่าน PRE-ENTRY-Like Pattern (6 เกณฑ์) |
| `REVIEW` | พิมพ์ในแชท | อ่าน guideline อีกครั้งและพร้อมรับคำสั่งใหม่ |
| `BUY/COIN/L=AMT` | รัน `./trade.sh "BUY/..."` | ส่งคำสั่งซื้อเหรียญ |
| `SELL/COIN/L=PCT%` | รัน `./trade.sh "SELL/..."` | ส่งคำสั่งขายเหรียญ |

### อัปเดตข้อมูลและประมวลผลสัญญาณ
คำสั่งนี้จะดาวน์โหลดข้อมูลล่าสุด ประมวลผล MPTM และสร้างรายงาน Excel:

```bash
./update.sh
```

แสดงรายงานเฉพาะเหรียญที่ต้องการได้โดยระบุ AKA คั่นด้วย `-`:

```bash
./update.sh UPDATE/BTC-ETH-SOL
```

**สิ่งที่เกิดขึ้น**:
1. โหลดค่าจาก `.env`
2. ดึง Sheet ID จาก `REF_SHEET_URL`
3. ดาวน์โหลดข้อมูลจาก Google Sheets
4. ประมวลผลตามเกณฑ์ MPTM
5. จัดกลุ่มเหรียญตามสถานะ
6. ตรวจสอบ Liquidity จาก Bitkub API
7. สร้างไฟล์ Excel 3 ชีทที่ `downloads/All-Bitkub-Batch-Log-vX_output.xlsx`
8. คำสั่ง `UPDATE` ปกติแสดงผลสรุปใน Terminal พร้อม LAST_CANDLE, UPDATED, Source ของเหรียญที่กำหนด ในรูปแบบ:
   ```
   AKA         : <ชื่อเหรียญ> 🚀
   LAST_CANDLE : <timestamp ของ candle ล่าสุด>
   UPDATED     : <timestamp ที่ข้อมูลอัปเดตล่าสุด>
   Source      : <แหล่งข้อมูลที่ใช้ เช่น exchange, broker, export>
   ```
   ชื่อเหรียญในทุกรายการสถานะใน Terminal และคอลัมน์ชื่อเหรียญใน `Latest Snapshot` / `Master Signal Log` คลิกเพื่อเปิดกราฟ TradingView ได้ (Terminal ต้องรองรับ OSC 8 hyperlinks) เมื่อแสดงรายงานบนแชท ให้ใช้ชื่อเหรียญเป็น Markdown link ไปยังกราฟ TradingView ทุกหมวดและทุกตาราง

เมื่อใช้ `UPDATE/<AKA>-<AKA>-...` ระบบยังอัปเดต Workbook สำหรับข้อมูลทั้งหมด แต่รายงานใน Terminal แสดงเฉพาะเหรียญที่ระบุในหัวข้อ `🔵 SPECIFIED COIN` โดยใช้คอลัมน์และคะแนน VOL/TREND/CMB แบบเดียวกับ `PULLBACK ZONE` และเรียง CMB จากมากไปน้อย เหรียญซ้ำจะแสดงครั้งเดียว; เหรียญที่ไม่พบจะแจ้งแยกจากตาราง ส่วน AKA, LAST_CANDLE, UPDATED และ Source แสดงแยกตามเหรียญที่พบ รูปแบบรายละเอียดและกรณีไม่พบให้ยึดตาม guideline

### ตรวจยอดเงิน
ตรวจสอบยอดเงินบาทคงเหลือในพอร์ต:

```bash
./trade.sh "MONEY"
```

### ส่งคำสั่งซื้อ (BUY)
รูปแบบคำสั่งคือ `./trade.sh "BUY/COIN/L=PRICE/AMOUNT"` โดย `PRICE` ใช้ `M` สำหรับ Market Order หรือระบุราคา Limit และ `AMOUNT` คือจำนวนเงินบาทที่ใช้ซื้อ

**Market Order**:
```bash
./trade.sh "BUY/BTC/L=M/1000"
```
*ซื้อ BTC มูลค่า 1,000 THB ในราคาตลาด*

**Limit Order**:
```bash
./trade.sh "BUY/BTC/L=2000000/1000"
```
*ซื้อ BTC ในราคา 2,000,000 THB มูลค่า 1,000 THB*

**⚠️ การแจ้งเตือนและยืนยันก่อนส่งคำสั่งซื้อ:**
- ทุกคำสั่ง BUY จะเรียก `/api/v3/market/symbols` และแสดง `Broker Coin` หรือ `Exchange Coin`; ถ้าดึงหรืออ่าน source ไม่สำเร็จ สคริปต์ใช้ `exchange` เป็นค่าเริ่มต้น
- ถ้า source เป็น Broker จะเตือนข้อจำกัดและขอยืนยัน (y/n) ก่อน
- ถ้ามีไฟล์ `downloads/All-Bitkub-Batch-Log-vX_output.xlsx` สคริปต์จะอ่านสถานะใน `Latest Snapshot`: ทุกสถานะจะมีการแจ้งให้ทราบและขอยืนยันก่อนซื้อ โดย `BUY_CONFIRMED` จะแสดงว่าเหรียญผ่าน MPTM; สถานะอื่น เช่น `EARLY/WATCH`, `PULLBACK ZONE`, `OVEREXTENDED`, `WAIT/RETEST` หรือ `UNKNOWN` จะแสดงคำเตือนว่าไม่ใช่ `BUY_CONFIRMED`
- ถ้าไม่พบไฟล์ Excel, หาเหรียญไม่พบในไฟล์ (`NOT_FOUND`) หรืออ่านไฟล์/ชีทไม่ได้ (`ERROR`) สคริปต์จะแจ้งเตือนว่าไม่สามารถตรวจสอบ MPTM ได้ และถามยืนยันก่อนซื้อ
- เมื่อต้องยืนยันแล้วผู้ใช้ตอบอย่างอื่นนอกจาก `y` หรือ `Y` สคริปต์จะยกเลิกคำสั่ง; กรณี Broker Coin และสถานะ MPTM ที่ต้องยืนยัน อาจมีคำถามยืนยันสองครั้ง

**หลังจาก BUY สำเร็จ:**
- เมื่อ Bitkub รับคำสั่งและส่ง Order ID กลับมา สคริปต์จะค้นหารายการซื้อที่จับคู่แล้วของ Order ID นั้นจาก `GET /api/v3/market/my-order-history` และใช้ค่าจากทุก fill ที่พบ
- อ่าน `TIER` ของเหรียญจากแถว `AKA` ที่ตรงกันใน REF Sheet ที่กำหนดด้วย `REF_SHEET_URL` และใช้ `Source` จาก Bitkub symbols; คำนวณต้นทุนเฉลี่ยต่อเหรียญรวมค่าธรรมเนียมที่จ่ายจริง แล้วคำนวณ `Target Price = ต้นทุนเฉลี่ย × (1 + %TIER)`
- อัตราเป้าหมายคือ `T1=8.25%`, `T2=7.25%`, `T3=6.75%`, `T4=5.75%` และจะแสดงคำสั่ง Limit Sell `SELL/<COIN>/L=<Target Price>/100%` ตาม TIER ของเหรียญ
- ถ้าไม่พบ fill สคริปต์ตรวจ `GET /api/v3/market/my-open-orders` ด้วย Order ID เพื่อแยกคำสั่งที่ยังรอจับคู่ หากยังเปิดอยู่จะแจ้งสถานะและไม่เสนอคำสั่งขาย
- ถ้า Order History ไม่มีรายการหรือส่ง error code (เช่น Broker Coin ที่ตอบ error 61) แต่ BUY API ตอบ `error=0` และมี `amt`, `fee`, `cre`, `rec` ที่ยืนยันยอดซื้อจริงครบ สคริปต์คำนวณต้นทุนจากผลตอบกลับ BUY (`(amt + fee - cre) / rec`) และเสนอคำสั่งขายตาม TIER พร้อมแสดง error code ที่ได้รับ
- หาก BUY API ตอบ error ที่ไม่ใช่ 0 จะแจ้งว่าคำสั่งซื้อไม่สำเร็จพร้อม HTTP status code และ Bitkub error code; หาก API รับคำสั่งแต่ไม่มี fill และไม่มีข้อมูลผลซื้อจริงครบ จะไม่สร้าง Target Price/คำสั่งขายจากข้อมูลที่เดา
- อ้างอิง error handling: [Bitkub API Error Handling](https://api.bitkub.com/docs/errors) และ [REST v3](https://github.com/bitkub/bitkub-official-api-docs/blob/master/rest-v3.md)

### ส่งคำสั่งขาย (SELL)
รูปแบบคำสั่งคือ `./trade.sh "SELL/COIN/L=PRICE/PERCENT"` โดย `PERCENT` คือเปอร์เซ็นต์ของยอดเหรียญที่พร้อมใช้งานใน wallet

**Market Order**:
```bash
./trade.sh "SELL/BTC/L=M/100%"
```
*ขาย BTC 100% ของยอดที่พร้อมใช้งานในราคาตลาด*

**Limit Order**:
```bash
./trade.sh "SELL/BTC/L=2000000/100%"
```
*ขาย BTC 100% ของยอดที่พร้อมใช้งาน ในราคา 2,000,000 THB*

**ความละเอียดราคา Limit:** ห้ามกำหนดจำนวนตำแหน่งทศนิยมเดียวให้ทุกคู่เทรด ให้ตรวจ `price_scale` และ `price_step` ของคู่ `<COIN>_THB` จาก [Bitkub Symbols API](https://api.bitkub.com/api/v3/market/symbols) แล้วใช้ราคาให้ตรงขั้นราคาที่ API ระบุ เช่น `CVC_THB` ใช้ 4 ตำแหน่ง (`0.0001`) ส่วนคู่เหรียญอื่นอาจใช้จำนวนตำแหน่งต่างกัน (ข้อมูล API ปัจจุบันมีตั้งแต่ 1 ถึง 13 ตำแหน่ง) หาก Target Price ที่คำนวณได้มีเศษเกินขั้นราคา สคริปต์จะปัดขึ้นไปยังขั้นราคาถัดไปก่อนแนะนำคำสั่ง Limit Sell; ราคา Limit ที่ผู้ใช้ป้อนสำหรับ BUY/SELL จะถูกตรวจตามขั้นราคา และปฏิเสธหากไม่ตรงโดยไม่ปัดราคาให้เงียบ ๆ

### คำนวณราคาเป้าหมายจากเหรียญในพอร์ต (TARGET)
```bash
./trade.sh "TARGET/BTC"
```

### ตรวจและยกเลิกคำสั่งที่ยังเปิดอยู่ (CANCEL)

`CANCEL/COIN` อ่าน `GET /api/v3/market/my-open-orders?sym=<coin>_thb` และแสดงเฉพาะ BUY/SELL ที่ Bitkub ส่งกลับใน Open Orders ของ `<COIN>_THB` (ไม่รวมคำสั่งที่จับคู่เสร็จ ยกเลิกแล้ว หรือไม่ปรากฏในผลตรวจ) ทั้ง Limit และ Market ที่ API ส่งกลับ โดยแสดง Order ID, ประเภท, ราคา, ปริมาณ และคำสั่งยกเลิกแยกตาม ID คำสั่ง Market แสดงราคาเป็น `Market` โหมดนี้เป็นการตรวจสอบอย่างเดียวและไม่ส่งคำขอยกเลิก:

```bash
./cancel.sh "CANCEL/BTC"
```

หากต้องการยกเลิก ให้ระบุฝั่งและ Order ID ที่ต้องการอย่างชัดเจน เช่น `./cancel.sh "CANCEL/BTC/SELL/ID=<ORDER_ID>"` หรือ `./cancel.sh "CANCEL/BTC/BUY/ID=<ORDER_ID>"` โดยแทน `<ORDER_ID>` ด้วย ID จริงตามที่แสดงทุกตัวอักษร/ตัวเลขและตัวพิมพ์ สคริปต์อ่าน Open Orders ล่าสุดและยืนยันว่า ID กับฝั่งตรงกันก่อนส่ง `POST /api/v3/market/cancel-order` โดยใช้ `sym=<coin>_thb`, `id=<order_id>`, `sd=sell|buy` จากนั้นอ่าน Open Orders ซ้ำและรายงานว่า ID ยังเปิดอยู่หรือไม่พบแล้ว การระบุ ID ครั้งเดียวจะยกเลิกได้เพียงรายการเดียว

หากอ่าน Open Orders ไม่สำเร็จ, Bitkub ตอบ error, response ผิดรูปแบบ หรือมีข้อมูลรายการไม่ครบ สคริปต์หยุดก่อนส่งคำขอยกเลิก; หากไม่พบ ID/ฝั่งที่ระบุในผลล่าสุดก็จะไม่ส่งคำขอเช่นกัน หากการอ่าน Open Orders หลังส่งคำขอล้มเหลว สคริปต์จะแจ้งว่าตรวจสอบผลซ้ำไม่ได้ โดยคำขอยกเลิกได้ถูกส่งไปแล้ว
ตรวจยอด BTC พร้อมขายจาก Bitkub v4 `wallet/balances`, อ่าน `TIER` จากแถว `AKA` ที่ตรงกันใน REF Sheet ที่กำหนดด้วย `REF_SHEET_URL`, และคำนวณต้นทุนเฉลี่ยรวมค่าธรรมเนียมจากประวัติคำสั่งซื้อ Bitkub v3 ก่อนเสนอคำสั่ง Limit Sell รูปแบบ `SELL/BTC/L=<Target Price>/100%` โดย **ไม่ส่งคำสั่งขายอัตโนมัติ**

Target Price ต้องสอดคล้องกับ `price_scale`/`price_step` ของคู่เทรดจาก Symbols API และปัดขึ้นตามขั้นราคาก่อนใช้ส่งคำสั่ง เช่น Target ของ CVC ที่คำนวณได้ `1.130357...` ให้ใช้ `1.1304 THB` (`CVC_THB`: `price_scale=4`, `price_step=0.0001`) ทั้งนี้ค่าความละเอียดขึ้นกับแต่ละคู่และอาจเปลี่ยนตามข้อมูลปัจจุบันจาก Bitkub; อย่าสมมติว่าทุกคู่ใช้ 4 หรือ 8 ตำแหน่ง

- ถ้าไม่พบยอด หรือยอดคงเหลือเป็นศูนย์ จะแจ้งว่าอาจไม่มีเหรียญในพอร์ต; ถ้ามียอดแต่ถูก reserve ไว้ทั้งหมด จะแสดงยอด reserve และไม่เสนอคำสั่งขาย
- หาก API ล้มเหลว จะแสดง HTTP status code และ Bitkub error code เพื่อแยกจากกรณีไม่มีเหรียญ
- ถ้ามีเหรียญแต่ไม่มี Order History/ข้อมูลต้นทุนที่เชื่อถือได้ เช่น Broker Coin (error 61) หรือเหรียญโอนเข้า จะไม่เดา Target Price; แนะนำตรวจต้นทุนจากแหล่งที่มาแล้วใช้ `SELL/COIN/L=PRICE/100%` ระบุราคาเอง

ผล `PORTFOLIO` แสดงคอลัมน์ `Currency | Source | Tier | Total | ราคาซื้อเฉลี่ย (รวมค่าธรรมเนียม) | ราคาล่าสุด | มูลค่า (THB) | กำไร/ขาดทุน (หักค่าธรรมเนียม) | %P/L | ราคา Limit (THB) | ปริมาณในคำสั่ง | Remark` และเรียงเหรียญตามมูลค่าพอร์ตจากมากไปน้อย. ค่า `Source` และ `Tier` อ่านจากคอลัมน์ `SOURCE` และ `TIER` ของแถว `AKA` เดียวกันในชีต `All-Bitkub-BATCH` จาก REF Sheet ที่กำหนดด้วย `REF_SHEET_URL`; หากอ่านหรือจับคู่ไม่ได้ให้แสดง `N/A`. ราคาและปริมาณมาจากคำสั่งขาย Limit ที่ยังเปิดอยู่ใน Bitkub `my-open-orders`; หากมีหลายคำสั่งให้แสดงแต่ละรายการแยกบรรทัดในลำดับเดียวกัน, หากไม่มีคำสั่งให้แสดง `—`, และหาก request ล้มเหลว, HTTP status ไม่สำเร็จ, Bitkub error code ไม่ใช่ 0 หรือ response ผิดรูปแบบ ให้แสดง `N/A` พร้อม `Open Orders N/A` และรายละเอียด status/error ใน `Remark`. แถว THB แสดง `—` ในคอลัมน์ Source, Tier, ราคา Limit และปริมาณในคำสั่ง.

ราคาซื้อเฉลี่ยใน PORTFOLIO คำนวณจาก matched Order History ตามเวลาแบบถัวเฉลี่ยเคลื่อนที่: สำหรับ BUY ใน `my-order-history`, `amount` เป็นยอด THB รวมค่าธรรมเนียม, จำนวนเหรียญสุทธิต่อ fill คือ `(amount - fee + credit) / rate` และต้นทุน THB คือ `amount` (ห้ามบวก fee ซ้ำ); จำนวนที่รับปัดลงตาม `base_asset_scale`. SELL ลดจำนวนและต้นทุนตามค่าเฉลี่ย ณ เวลาขาย. เมื่อไม่มี SELL หลัง BUY ที่บันทึกไว้ ใช้ `wallet total` เป็นจำนวนรับจริงสำหรับหารต้นทุน; เมื่อมี SELL ใช้ ledger หลังหัก SELL แล้วปรับต้นทุนคงเหลือด้วย `wallet total`.

การ reconcile ใช้ tolerance จาก dust ตาม `base_asset_scale` รวมกับความคลาดสูงสุดจาก precision ของ `amount`, `fee`, `credit` ในแต่ละ BUY fill (ครึ่งหน่วยความละเอียดของแต่ละค่า หารด้วย rate). ระหว่างประมวลผล SELL หากจำนวนขายเกิน ledger ที่ทราบ จะยอมรับเฉพาะส่วนเกินสะสมที่ยังอยู่ภายใน tolerance ซึ่งคำนวณจาก BUY fills ก่อนหน้า SELL นั้น; ส่วนเกินดังกล่าวถือว่ายอด ledger คงเหลือเป็นศูนย์ ไม่อนุญาตให้กลายเป็นยอดติดลบ. SELL ก่อน BUY แรกในช่วงประวัติถือเป็นการขาย inventory ที่มาก่อนช่วงประวัติ และข้ามได้เฉพาะเมื่อยอดปลายทางยัง reconcile กับ Wallet. หาก Order History ล้มเหลว/ผิดรูปแบบ, ไม่เหลือจำนวนจาก BUY, ส่วนเกิน SELL เกิน tolerance หรือยอดปลายทางต่างจาก Wallet เกิน tolerance ให้แสดงราคาซื้อเฉลี่ยและ P/L เป็น `N/A` แทนการเดาต้นทุน.

## 📉 ร่างแนวทาง: Bitkub Portfolio Monitor

- ชื่อฟีเจอร์: **Bitkub Portfolio Monitor**
- ไฟล์ตัวอย่าง: `examples/BitkubPortfolio.gs`
- ตัวอย่าง: [examples/BitkubPortfolio.gs](./examples/BitkubPortfolio.gs)
- สถานะ: **มีตัวอย่าง Apps Script สำหรับทดลองและปรับใช้; ต้องตรวจสอบและตั้งค่าก่อนใช้งานจริง**

ตัวอย่าง Google Apps Script นี้อัปเดตข้อมูล Portfolio ลงชีท `BitkubPortfolio` โดยมีคอลัมน์ `%P/L(Monitor)` และ `%STOPLOSS(SET)` เพิ่มจากข้อมูล Portfolio ปกติ:

`Currency | Source | Tier | Total | ราคาซื้อเฉลี่ย (รวมค่าธรรมเนียม) | ราคาล่าสุด | มูลค่า (THB) | กำไร/ขาดทุน (หักค่าธรรมเนียม) | %P/L(Monitor) | %STOPLOSS(SET) | ราคา Limit (THB) | ปริมาณในคำสั่ง | Remark`

- ค่าเริ่มต้นของ `%STOPLOSS(SET)` คือเลข `35` ในทุกแถว หมายถึงยอมขาดทุนได้ถึง `-35%`; แสดงเป็นเปอร์เซ็นต์ในชีทได้ และผู้ใช้ปรับแยกเป็นรายเหรียญได้
- เมื่ออัปเดต ให้รักษาค่า Stop Loss ที่ผู้ใช้ตั้งไว้โดยจับคู่ตาม `Currency`; กำหนด `35` ให้แถวใหม่หรือแถวที่ยังไม่มีค่าตั้งไว้
- คำนวณ `%P/L(Monitor)` ตามต้นทุนและ P/L ที่เชื่อถือได้เท่านั้น หากข้อมูลราคา, ต้นทุน หรือ P/L ขาดหาย/ผิดพลาด ให้บันทึกสถานะใน `Remark` และห้ามใช้แถวนั้นเป็นเหตุส่งคำสั่ง
- ทุกครั้งที่อัปเดต ให้ตรวจแต่ละแถวที่มีข้อมูลครบ: เมื่อ `%P/L(Monitor) < -%STOPLOSS(SET)` ให้เริ่มกระบวนการ Stop Loss เช่น ค่า Stop Loss `35` จะเริ่มเมื่อ P/L ต่ำกว่า `-35%` (`-36%` เข้าเงื่อนไข แต่ `-35%` พอดียังไม่เข้า)
- สำหรับเหรียญที่เข้าเงื่อนไข ให้ดึง Open Orders ของคู่ `<COIN>_THB` และยกเลิกคำสั่ง BUY/SELL ที่ยังเปิดอยู่ทั้งหมด โดยใช้รูปแบบ Bitkub API และการตรวจสอบจาก `cancel.sh`; ต้องตรวจผลและอ่าน Open Orders ซ้ำเพื่อยืนยันว่าไม่มีคำสั่งค้าง
- เมื่อยืนยันการยกเลิกครบแล้ว ให้อ่านยอด Wallet ที่พร้อมขาย (`available`) ใหม่ และส่ง **Market Sell 100% ของจำนวนที่ขายได้** โดยใช้แนวทางส่งคำสั่งจาก `trade.sh` หากมีข้อผิดพลาดหรือยังยืนยันการยกเลิกไม่ได้ ให้หยุดโดยไม่ส่งคำสั่งขาย และบันทึกรายละเอียดใน `Remark`
- ป้องกัน Trigger ทำงานซ้อนและป้องกันส่ง Stop Loss ซ้ำสำหรับเหรียญเดียวกัน; บันทึกผลการยกเลิก/ขาย เวลา และ Order ID หรือรายละเอียดข้อผิดพลาด เพื่อให้ตรวจสอบย้อนหลังได้

เมนูในชีทที่วางแผนไว้: `อัพเดท Portfolio`, `ตั้งค่า Triger 5 นาที`, `ตั้งค่า Triger 15 นาที`, `ตั้งค่า Triger 30 นาที`, `ตั้งค่า Triger 45 นาที`, `ตั้งค่า Triger 60 นาที` และ `ล้างการตั้งค่า Triger`. Apps Script ไม่มี Trigger 45 นาทีโดยตรง จึงต้องใช้ Trigger ทุก 15 นาทีร่วมกับการตรวจเวลารอบล่าสุดเพื่อจำลองช่วง 45 นาที; Trigger อาจทำงานคลาดจากเวลาที่กำหนดได้.

เก็บ `REF_SHEET_URL`, `BITKUB_API_KEY` และ `BITKUB_API_SECRET` ใน Apps Script Properties ไม่ฝังค่า Secret ในซอร์สโค้ด. เนื่องจากฟีเจอร์นี้ส่งคำสั่งขายอัตโนมัติ API Key ต้องมีสิทธิ์เทรดตามที่ Bitkub กำหนดและผู้ใช้ต้องยอมรับความเสี่ยงจากการส่งคำสั่งจริง; ไม่ควรเปิดสิทธิ์ถอนเงิน. `examples/BitkubPortfolio.gs` เรียก Bitkub API โดยตรง ไม่สามารถเรียกไฟล์ `.sh` บนเครื่องจาก Apps Script ได้.

ตัวอย่างใน `examples/BitkubPortfolio.gs` ตั้ง `BITKUB_ENABLE_LIVE_STOPLOSS` เป็นปิดโดยปริยาย: การตรวจพบ Stop Loss จะแสดง `DRY RUN` และไม่ยกเลิกหรือส่งคำสั่งซื้อขาย. หากจะทดสอบหรือเปิดใช้งานจริง ต้องตรวจโค้ดและ Script Properties ก่อน; ตั้ง `BITKUB_ENABLE_LIVE_STOPLOSS=true` จึงอนุญาตให้ยกเลิกคำสั่งและส่ง Market Sell. ตัวอย่างบันทึกสถานะหลังส่งหรือผลส่งไม่แน่ชัดเพื่อป้องกันคำสั่งซ้ำ; การแก้สถานะดังกล่าวต้องตรวจสอบ Open Orders และ Wallet ด้วยตนเองก่อน.

Wallet ใช้ `GET /api/v4/wallet/balances` ซึ่งตอบ success ด้วย `code: "0"` และรายการยอดใน `data`; ไม่ใช่รูปแบบ V3 `error/result` และไม่รับ `symbol` query parameter. ตัวอย่างรองรับทั้งรหัสตอบกลับ V3 (`error`) และ V4 (`code`).

การคำนวณต้นทุนในตัวอย่าง Apps Script และ `portfolio.sh` ใช้กติกา reconcile เดียวกัน รวมถึงยอมรับเฉพาะส่วนเกิน SELL ที่อยู่ภายใน precision tolerance จาก BUY ก่อนหน้า. กรณี KAVA ที่แสดง SELL รวม `386.35397751` KAVA และ BUY วันที่ 12 ต.ค. รวม `393.07334118` KAVA จึงไม่ควรปฏิเสธเพียงเพราะเศษจำนวนจากการปัด; ต้องตรวจยอดจาก Order History เต็มและ Wallet หลังรันโค้ดฉบับแก้เพื่อยืนยันราคาซื้อเฉลี่ยที่แสดงจริง. `N/A` พร้อม `wallet/history mismatch` หมายถึงยอดประวัติกับ Wallet ยัง reconcile ไม่ได้; `sell exceeds known holdings` หมายถึงส่วนเกิน SELL สะสมเกิน tolerance; `No Order History` หรือ API error หมายถึงยังไม่มีข้อมูลพอคำนวณต้นทุน. หากยังคำนวณต้นทุนที่เชื่อถือไม่ได้ จะไม่คำนวณ `%P/L(Monitor)` และจะไม่ใช้แถวนั้นเป็นเหตุส่งคำสั่ง Stop Loss.

**เริ่มต้นใช้ตัวอย่าง:** เปิด Google Sheet ที่จะใช้ → Extensions → Apps Script → วางโค้ดจาก `examples/BitkubPortfolio.gs` → บันทึกและรัน `setupBitkubPortfolioSheet()` → ตั้ง `REF_SHEET_URL`, `BITKUB_API_KEY` และ `BITKUB_API_SECRET` ใน Project Settings → Script Properties → กลับไปโหลดชีตใหม่ แล้วเลือกเมนู `Bitkub Portfolio`. เริ่มจาก `อัพเดท Portfolio` และตรวจผลในโหมด DRY RUN ก่อน; ตั้ง Trigger ได้จากเมนูตามรอบที่ต้องการ. Apps Script ต้องได้รับสิทธิ์เข้าถึงชีตอ้างอิง และสิทธิ์เรียก URL ภายนอก. การเปิด `BITKUB_ENABLE_LIVE_STOPLOSS=true` เป็นการยินยอมให้โค้ดยกเลิกคำสั่งและส่ง Market Sell ด้วย API Key จริง.

## 📁 โครงสร้างโครงการ

```
TFOSvX/
├── .env.example                              ← แม่แบบตัวแปรสภาพแวดล้อม
├── .env                                      ← ค่าของผู้ใช้ในเครื่อง (ไม่ติดตามโดย Git)
├── .gitignore                                ← กฎละเว้นไฟล์และโฟลเดอร์
├── update.sh                                 ← ดาวน์โหลดข้อมูลและประมวลผลรายงาน
├── trade.sh                                  ← ตรวจยอดเงินและส่งคำสั่งซื้อขาย
├── cancel.sh                                 ← ตรวจ Open Orders และยกเลิกตาม Order ID ที่ระบุ
├── portfolio.sh                              ← แสดง Portfolio และ P/L
├── README.md                                 ← คู่มือหลักของโครงการ
├── GOOGLE-SHEETS-SETUP.md                   ← คู่มือตั้งค่า Google Sheets
├── TimeFrame-OS-guidelines-and-model-vX.md   ← แนวทาง MPTM แบบละเอียด
├── TFOSvX.code-workspace                    ← การตั้งค่า VS Code Workspace
├── LICENSE                                   ← สัญญาอนุญาต
├── examples/
│   ├── All-Bitkub-BATCH-starter.gs           ← ตัวช่วยสร้างหัวตารางและเขียนข้อมูล
│   ├── All-Bitkub-MTFS.gs                    ← สคริปต์ MTFS เต็ม: ดึงข้อมูลและอัปเดตทุก 1 ชั่วโมง
│   └── BitkubPortfolio.gs                    ← ตัวอย่าง Portfolio Monitor และ Stop Loss (DRY RUN เริ่มต้น)
└── downloads/                                ← โฟลเดอร์ผลลัพธ์ (Git เก็บเฉพาะ .gitkeep เพื่อคงโฟลเดอร์ว่างหลัง clone)
    └── .gitkeep                              ← placeholder เปล่า; ไฟล์ข้อมูลที่สร้างระหว่างใช้งานไม่ติดตามโดย Git
```

## 🧠 เกณฑ์ MPTM (สรุป)

เหรียญจะถูกจัดเป็น **EARLY/WATCH** หากผ่านเกณฑ์ทั้ง 6 ข้อนี้:

1. ✅ `TREND(W) = UP` — ทิศทางสัปดาห์เป็นขาขึ้น
2. ✅ `RSI(W) > 50` — แรงส่งระดับสัปดาห์เหนือระดับสมดุล
3. ✅ `MACD_HIST_DELTA(W) > 0` — อัตราเร่งโมเมนตัมเพิ่มขึ้น
4. ✅ `RSI(D) < 70` — ไม่อยู่ในโซนความร้อนสูง
5. ✅ `EMA9(W) > EMA21(W)` — เส้นค่าเฉลี่ยเคลื่อนที่เรียงตัว
6. ✅ `SIGNAL_VOLUME ≥ 1 TF = BUY` — มี Volume ยืนยันในอย่างน้อย 1 ไทม์เฟรม

เหรียญจะถูกจัดเป็น **BUY CONFIRMED** หาก:
- ผ่านเกณฑ์ทั้ง 6 ข้อข้างต้น
- และเกิด `ENTRY_TRIGGER(1H) = ENTRY/TRIGGER` ยืนยัน

## 🔐 การจัดการความปลอดภัย

- **ห้าม commit** ไฟล์ `.env` ไปยัง Git repository
- ไฟล์ `.env` อยู่ใน `.gitignore` โดย default
- ควรใช้ Environment Variables แยกสำหรับ Production/Staging
- API Key และ Secret ควรถูกเก็บรักษาอย่างปลอดภัยและไม่แชร์ให้ผู้อื่น

## 📝 เอกสารเพิ่มเติม

สำหรับรายละเอียดเชิงลึกเกี่ยวกับ:
- แนวทางการทำงานเชิงระบบ (System Workflow)
- สถาปัตยกรรม MPTM แบบละเอียด
- สเปกตรัมระบบจับสัญญาณ Early Entry
- กรอบการตัดสินใจ Dual-Stage Entry
- ตัวอย่างการใช้งานและ Template Prompt
- รูปแบบคำตอบที่บังคับ (Required Answer Format)
- ขั้นตอนการเรียกใช้ระบบต่อไป (Reusable Follow-Up Prompt Flow)

ดูได้ที่: [TimeFrame-OS-guidelines-and-model-vX.md](TimeFrame-OS-guidelines-and-model-vX.md)

### สรุป Workflow การทำงาน

```
1. START @README.md → REVIEW README และ guideline ให้ครบ → ยึดรูปแบบคำตอบตาม guideline → พร้อมรับคำสั่ง
              ↓
2. UPDATE → ดาวน์โหลดข้อมูล → ประมวลผล MPTM → สร้าง Excel 3 ชีท
              ↓
3. ตรวจสอบสถานะ → BUY CONFIRMED / EARLY/WATCH / PULLBACK / WAIT
              ↓
4. ดำเนินการ → MONEY / PORTFOLIO / CANDIDATE / TARGET / BUY / SELL
              ↓
5. REVIEW → ทบทวน guideline และเริ่มรอบใหม่
```

## 🐛 การแก้ไขปัญหา

### ข้อผิดพลาด: `❌ กรุณาตั้งค่า BITKUB_API_KEY และ BITKUB_API_SECRET ใน .env`
**วิธีแก้**: ตรวจสอบว่าไฟล์ `.env` มีค่า `BITKUB_API_KEY` และ `BITKUB_API_SECRET` ที่ถูกต้อง

### ข้อผิดพลาด: Python module not found
**วิธีแก้**: ติดตั้ง library ที่จำเป็น:
```bash
pip3 install openpyxl requests
```

### ข้อผิดพลาด: Permission denied สำหรับ script
**วิธีแก้**: ตั้งค่า execute permission:
```bash
chmod +x update.sh trade.sh portfolio.sh cancel.sh
```

### ข้อผิดพลาด: Sheet ID ไม่ถูกต้อง
**วิธีแก้**: ตรวจสอบ `REF_SHEET_URL` ใน `.env` ว่าอยู่ในรูปแบบที่ถูกต้อง:
```
https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit?usp=sharing
```

## 📄 License

โครงการนี้เป็นส่วนตัวสำหรับการใช้งานส่วนบุคคล

## 🤝 การสนับสนุน

หากพบปัญหาหรือมีข้อสงสัย โปรดตรวจสอบ:
1. เอกสารแนวทาง MPTM แบบละเอียด
2. การตั้งค่า Environment Variables
3. Log output จาก script สำหรับข้อผิดพลาดเฉพาะ

---

**เวอร์ชัน**: vX  
**อัปเดตล่าสุด**: 11/10/2026
**สร้างด้วย ❤️ สำหรับการวิเคราะห์คริปโตเคอร์เรนซีที่มีวินัย**
