# TFOSvX (TimeFrame Operation System vX)
ระบบปฎิบัติการเชิงระบบและหลักการตัดสินใจ (Operation Systematic Workflow & MPTM Architecture)

# 🔔 การเริ่มต้นใช้งาน
1. ติดตั้ง [Devin](https://devin.ai/download) และสร้างโฟลเดอร์ใน root ของโปรเจกต์ และดาวน์โหลดไฟล์ [TFOSvX](https://github.com/TimeFrameLab/TFOSvX/archive/refs/heads/main.zip) แล้วแตกไฟล์ออกเป็นโฟลเดอร์ ใส่ในโฟลเดอร์นั้น
2. เปิด TFOSvX.code-workspace → README.md
3. เริ่มต้นการทำงานด้วยการพิมพ์ "START @README.md"(ระบบ → REVIEW @TimeFrame-OS-guidelines-and-model-vX.md → รอคำสั่งถัดไป) ใน Agent Chat ของ Devin ที่อยู่ในโปรเจกต์โฟลเดอร์

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

**หมายเหตุ**: หากไม่ได้ตั้งค่า `REF_SHEET_URL` ระบบจะแสดงข้อความให้ตั้งค่า `REF_SHEET_URL` จากนั้นหยุดทำงานด้วยรหัสข้อผิดพลาด โดยไม่ดาวน์โหลดชีตหรือประมวลผลรายงาน

หากต้องการสร้าง Google Sheet และ Apps Script เพื่ออัปเดตข้อมูลเหรียญสำหรับใช้งานเอง ดู [คู่มือการตั้งค่า Google Sheets](./GOOGLE-SHEETS-SETUP.md), [Apps Script ต้นแบบสำหรับเริ่มต้น](./examples/All-Bitkub-BATCH-starter.gs) หรือ [สคริปต์ MTFS ฉบับเต็มพร้อม Trigger รายชั่วโมง](./examples/All-Bitkub-MTFS.gs)

### 4. ตั้งค่า Script Permissions
```bash
chmod +x update.sh trade.sh portfolio.sh
```

## 📖 วิธีการใช้งาน

### เริ่มต้นการทำงาน (START Command)

เมื่อเปิดไฟล์โปรเจกต์นี้ ให้พิมพ์คำสั่ง **"START"** เพื่อเริ่มต้นการทำงาน:

```
START
```

**สิ่งที่เกิดขึ้น**:
1. ระบบจะทบทวนเนื้อหาใน `TimeFrame-OS-guidelines-and-model-vX.md`
2. ตรวจสอบสถานะระบบและการตั้งค่า `.env`
3. พร้อมรับคำสั่งถัดไป เช่น `UPDATE`, `MONEY`, `PORTFOLIO`, `CANDIDATE`, หรือคำสั่งซื้อขาย

### คำสั่งหลักที่ใช้งาน

| คำสั่ง | การใช้งาน | ผลลัพธ์ |
|:---|:---|:---|
| `START` | พิมพ์ในแชท | เริ่มต้นการทำงาน → REVIEW guideline → รอคำสั่งถัดไป |
| `UPDATE` | รัน `./update.sh` | ดาวน์โหลดข้อมูลล่าสุด + ประมวลผล MPTM + ตรวจ Liquidity |
| `MONEY` | รัน `./trade.sh "MONEY"` | ตรวจยอดเงินบาทคงเหลือ |
| `PORTFOLIO` | รัน `./portfolio.sh` | แสดง Portfolio + ราคาซื้อเฉลี่ย + กำไร/ขาดทุน + %P/L + Remark (Broker Coin* / No OH*) |
| `CANDIDATE` | ค้นหาใน Excel | แสดงเหรียญที่ผ่าน PRE-ENTRY-Like Pattern (6 เกณฑ์) |
| `REVIEW` | พิมพ์ในแชท | อ่าน guideline อีกครั้งและพร้อมรับคำสั่งใหม่ |
| `BUY/COIN/L=AMT` | รัน `./trade.sh "BUY/..."` | ส่งคำสั่งซื้อเหรียญ |
| `SELL/COIN/L=PCT%` | รัน `./trade.sh "SELL/..."` | ส่งคำสั่งขายเหรียญ |

### อัปเดตข้อมูลและประมวลผลสัญญาณ
คำสั่งนี้จะดาวน์โหลดข้อมูลล่าสุด ประมวลผล MPTM และสร้างรายงาน Excel:

```bash
./update.sh
```

**สิ่งที่เกิดขึ้น**:
1. โหลดค่าจาก `.env`
2. ดึง Sheet ID จาก `REF_SHEET_URL`
3. ดาวน์โหลดข้อมูลจาก Google Sheets
4. ประมวลผลตามเกณฑ์ MPTM
5. จัดกลุ่มเหรียญตามสถานะ
6. ตรวจสอบ Liquidity จาก Bitkub API
7. สร้างไฟล์ Excel 3 ชีทที่ `downloads/All-Bitkub-Batch-Log-vX_output.xlsx`
8. แสดงผลสรุปใน Terminal พร้อม LAST_CANDLE, UPDATED, Source ของเหรียญที่กำหนด ในรูปแบบ:
   ```
   AKA         : <ชื่อเหรียญ> 🚀
   LAST_CANDLE : <timestamp ของ candle ล่าสุด>
   UPDATED     : <timestamp ที่ข้อมูลอัปเดตล่าสุด>
   Source      : <แหล่งข้อมูลที่ใช้ เช่น exchange, broker, export>
   ```
   ชื่อเหรียญในทุกรายการสถานะใน Terminal และคอลัมน์ชื่อเหรียญใน `Latest Snapshot` / `Master Signal Log` คลิกเพื่อเปิดกราฟ TradingView ได้ (Terminal ต้องรองรับ OSC 8 hyperlinks) เมื่อแสดงรายงานบนแชท ให้ใช้ชื่อเหรียญเป็น Markdown link ไปยังกราฟ TradingView ทุกหมวดและทุกตาราง

**🔧 การกำหนดเหรียญที่แสดงในหัวข้อ:**
- แก้บรรทัด `TARGET_COIN = 'BTC'` ใน `update.sh` (บรรทัดที่ 56)
- เปลี่ยนเป็นเหรียญที่ต้องการ (เช่น `'AAVE'`, `'ATOM'`, `'QNT'`)
- ระบบจะแสดง AKA, LAST_CANDLE, UPDATED, Source ของเหรียญที่กำหนดเท่านั้น

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

## 📁 โครงสร้างโครงการ

```
TFOSvX/
├── .env.example                              ← แม่แบบตัวแปรสภาพแวดล้อม
├── .env                                      ← ค่าของผู้ใช้ในเครื่อง (ไม่ติดตามโดย Git)
├── .gitignore                                ← กฎละเว้นไฟล์และโฟลเดอร์
├── update.sh                                 ← ดาวน์โหลดข้อมูลและประมวลผลรายงาน
├── trade.sh                                  ← ตรวจยอดเงินและส่งคำสั่งซื้อขาย
├── portfolio.sh                              ← แสดง Portfolio และ P/L
├── README.md                                 ← คู่มือหลักของโครงการ
├── GOOGLE-SHEETS-SETUP.md                   ← คู่มือตั้งค่า Google Sheets
├── TimeFrame-OS-guidelines-and-model-vX.md   ← แนวทาง MPTM แบบละเอียด
├── TFOSvX.code-workspace                    ← การตั้งค่า VS Code Workspace
├── LICENSE                                   ← สัญญาอนุญาต
├── examples/
│   ├── All-Bitkub-BATCH-starter.gs           ← ตัวช่วยสร้างหัวตารางและเขียนข้อมูล
│   └── All-Bitkub-MTFS.gs                    ← สคริปต์ MTFS เต็ม: ดึงข้อมูลและอัปเดตทุก 1 ชั่วโมง
└── downloads/                                ← ไฟล์ที่สร้างระหว่างใช้งาน (ไม่ติดตามโดย Git)
    ├── All-Bitkub-Batch-Log-vX.xlsx          ← ข้อมูลที่ดาวน์โหลดจาก Reference Sheet
    └── All-Bitkub-Batch-Log-vX_output.xlsx   ← รายงาน Excel ที่ประมวลผลแล้ว
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
1. START → REVIEW guideline → พร้อมรับคำสั่ง
              ↓
2. UPDATE → ดาวน์โหลดข้อมูล → ประมวลผล MPTM → สร้าง Excel 3 ชีท
              ↓
3. ตรวจสอบสถานะ → BUY CONFIRMED / EARLY/WATCH / PULLBACK / WAIT
              ↓
4. ดำเนินการ → MONEY / PORTFOLIO / CANDIDATE / BUY / SELL
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
chmod +x update.sh trade.sh portfolio.sh
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
