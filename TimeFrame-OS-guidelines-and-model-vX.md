# 🐋 สรุปแนวทางการทำงานเชิงระบบและหลักการตัดสินใจ (Systematic Workflow & MPTM Architecture)

## Part 1: แนวทางการทำงานเชิงระบบและสถาปัตยกรรมกระบวนการ (System Workflow & Guidelines)

### 0. การตั้งค่าเริ่มต้น (Initial Setup)

#### ตั้งค่า Reference Sheet (REF Sheet) URL
ก่อนเริ่มใช้งาน ต้องตั้งค่า `REF_SHEET_URL` ในไฟล์ `.env`:

```bash
# แก้ไขไฟล์ ../Projects/TFOSvX/.env
REF_SHEET_URL=<Reference Sheet URL ของคุณ>
```

**การทำงานของระบบ:**
- script `update.sh` จะโหลดค่า `REF_SHEET_URL` จาก `.env` อัตโนมัติ
- ดึง Sheet ID จาก URL (extract จาก pattern `/d/[SHEET_ID]`)
- ใช้ Sheet ID นี้ในการดาวน์โหลดข้อมูลจาก Reference Sheet (REF Sheet)
- หากไม่ได้ตั้งค่า `REF_SHEET_URL` คำสั่ง `UPDATE` จะแสดงข้อความให้ตั้งค่าและหยุดทำงานด้วยรหัสข้อผิดพลาด โดยไม่ดาวน์โหลดชีตหรือประมวลผลรายงาน
- คำสั่ง `PORTFOLIO` ทำงานต่อได้ โดยแสดง Tier เป็น `N/A` เมื่อไม่มี `REF_SHEET_URL` หรืออ่าน/จับคู่ Tier จาก REF Sheet ไม่ได้; คำสั่ง `TARGET` จะแจ้งว่าอ่าน Tier ไม่ได้และไม่แสดง Target Price หรือคำสั่งขายแนะนำ

**โครงสร้างไฟล์:**
```
MPTM/
├── .env                    ← เก็บ REF_SHEET_URL, BITKUB_API_KEY, BITKUB_API_SECRET
├── update.sh               ← โหลด .env → ดึง Sheet ID → ดาวน์โหลดข้อมูล
├── trade.sh                ← โหลด .env → ใช้ API Key ส่งคำสั่งซื้อขาย
├── portfolio.sh            ← script แสดง Portfolio + ราคาซื้อเฉลี่ย + P/L + Remark (Broker Coin* / No OH*)
└── TimeFrame-OS-guidelines-and-model-vX.md  ← เอกสารแนวทางนี้
```

#### การทำงานของระบบแบบภาพรวม (Workflow Overview)

```
┌─────────────────────────────────────────────────────────┐
│ 1. เริ่มต้นด้วย UPDATE                               │
│    ./update.sh                                         │
│    → โหลด .env → ดึง REF_SHEET_URL → ดาวน์โหลด   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 2. ประมวลผล MPTM                                      │
│    → อ่านข้อมูลจาก Reference Sheet (REF Sheet)        │
│    → คัดกรองตาม PRE-ENTRY-Like Pattern (6 เกณฑ์)   │
│    → จัดกลุ่ม: BUY CONFIRMED / EARLY/WATCH / PULLBACK │
│    → สร้าง Excel output 3 ชีท                         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 3. ตรวจสอบ Liquidity                                    │
│    → เรียก Bitkub API v3 ticker                        │
│    → คำนวณ Vol24h, Spread%                             │
│    → จัดกลุ่ม: HIGH / MEDIUM / LOW                    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 4. แสดงผลและวิเคราะห์                               │
│    → แสดง BUY CONFIRMED (ถ้ามี)                      │
│    → แสดง EARLY/WATCH TOP 10                          │
│    → แสดง PULLBACK ZONE (W/4H/1H=UP, RSI 1H < 50)      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 5. คำสั่งเพิ่มเติม                                    │
│    MONEY → ตรวจยอดเงิน                               │
│    TARGET/COIN → คำนวณ Target Price จาก Portfolio    │
│    PORTFOLIO → แสดง Portfolio + ราคาซื้อเฉลี่ย + P/L + Remark                         │
│    CANDIDATE → แสดง PRE-ENTRY-Like Pattern CANDIDATE   │
│    REVIEW → อ่าน guideline อีกครั้ง                  │
│    BUY/SELL → ส่งคำสั่งซื้อขาย                       │
└─────────────────────────────────────────────────────────┘
```

#### คำสั่งหลักที่ใช้งาน

| คำสั่ง | การใช้งาน | ผลลัพธ์ |
|:---|:---|:---|
| `START` | พิมพ์ในแชท | เริ่มต้นการทำงาน → REVIEW guideline → รอคำสั่งถัดไป |
| `UPDATE` | รัน `./update.sh` | ดาวน์โหลดข้อมูลล่าสุด + ประมวลผล MPTM + ตรวจ Liquidity |
| `MONEY` | รัน `./trade.sh "MONEY"` | ตรวจยอดเงินบาทคงเหลือ |
| `TARGET/COIN` | รัน `./trade.sh "TARGET/BTC"` | ตรวจยอดเหรียญ คำนวณ Target Price ตาม TIER และเสนอคำสั่ง SELL (ไม่ส่งคำสั่งจริง) |
| `PORTFOLIO` | รัน `./portfolio.sh` | แสดง Portfolio + ราคาซื้อเฉลี่ย + กำไร/ขาดทุน + %P/L พร้อมราคาและปริมาณคำสั่งขาย Limit ที่ยังเปิดอยู่ |
| `CANDIDATE` | ค้นหาใน Excel | แสดงเหรียญที่ผ่าน PRE-ENTRY-Like Pattern (6 เกณฑ์) |
| `REVIEW` | พิมพ์ในแชท | อ่าน guideline อีกครั้งและพร้อมรับคำสั่งใหม่ |
| `BUY/COIN/L=AMT` | รัน `./trade.sh "BUY/..."` | ส่งคำสั่งซื้อเหรียญ |
| `SELL/COIN/L=PCT%` | รัน `./trade.sh "SELL/..."` | ส่งคำสั่งขายเหรียญ |

#### คำสั่งเริ่มต้น (START Command)

เมื่อเปิดไฟล์นี้และพิมพ์คำสั่ง **"START"** ระบบจะดำเนินการดังนี้:

1. **REVIEW Guideline**: อ่านและทบทวนเนื้อหาใน `TimeFrame-OS-guidelines-and-model-vX.md`
2. **ตรวจสอบสถานะระบบ**: ยืนยันว่าไฟล์ `.env` ได้รับการตั้งค่าเรียบร้อย
3. **พร้อมรับคำสั่ง**: รอรับคำสั่งถัดไปจากผู้ใช้ เช่น `UPDATE`, `MONEY`, `PORTFOLIO`, `CANDIDATE`, หรือคำสั่งซื้อขาย

**ตัวอย่างการใช้งาน**:
```
ผู้ใช้: START
ระบบ: กำลังทบทวน TimeFrame-OS-guidelines-and-model-vX.md...
ระบบ: ✅ พร้อมรับคำสั่ง (UPDATE / MONEY / PORTFOLIO / CANDIDATE / TARGET / BUY / SELL)
```

### 1. ปรัชญาและหลักการวิเคราะห์คัดกรอง (Core Decision Framework)
* **การคัดกรองตามลำดับขั้น**: ระบบไม่จัดอันดับว่าเหรียญไหนดีที่สุดตั้งแต่แรก แต่คัดกรองตามลำดับโครงสร้างไทม์เฟรม **W → D → 4H → 1H**
* **กฎจุดเข้าซื้อ (Action Trigger Rule)**: แม้โครงสร้างภาพใหญ่ (W/D) จะทรงสวยเพียงใด ระบบจะไม่ส่งคำสั่งซื้อจนกว่าจะเกิดสัญญาณ **`ENTRY_TRIGGER(1H)` = 🟢 ENTRY / 🟢 TRIGGER** ยืนยันในไทม์เฟรม 1H เพื่อป้องกันการเข้าซื้อในจังหวะที่ราคายังพักฐานไม่เสร็จ

### 2. สภาพแวดล้อมและการจัดการข้อมูล Excel (`All-Bitkub-Batch-Log-vX.xlsx`)
ทุกครั้งที่มีการร้องขอคำสั่งอัปเดต ระบบจะดึงข้อมูลสดใหม่จากแหล่งข้อมูล `🐋 All-Bitkub - All-Bitkub-BATCH` และสร้าง/อัปเดตไฟล์ Excel เวอร์ชันใหม่ โดยมีโครงสร้าง 3 ชีทดังนี้:
* **ชีทที่ 1: `Latest Snapshot` (วางไว้หน้าแรกสุด)**: สรุปเฉพาะสัญญาณรอบล่าสุดเพียงอย่างเดียว พร้อมคอลัมน์คำแนะนำ จุดเข้าซื้อ และลิงก์กราฟ TradingView / Bitkub; ชื่อเหรียญคลิกเพื่อเปิดกราฟ TradingView ได้
* **ชีทที่ 2: `Master Signal Log`**: บันทึกประวัติสะสมทั้งหมดแบบ Append-Only (รักษาประวัติรอบก่อนหน้าทั้งหมด + นำสัญญาณรอบล่าสุดมาบันทึกต่อท้าย); ชื่อเหรียญของรายการใหม่คลิกเพื่อเปิดกราฟ TradingView ได้
* **ชีทที่ 3: `REF.`**: เก็บรักษาสภาพลิงก์อ้างอิง Reference Sheet (REF Sheet) ต้นทางตามโครงสร้างเดิม

ชื่อเหรียญในทุกรายการสถานะของ Terminal คลิกเพื่อเปิดกราฟ TradingView ได้เมื่อใช้ Terminal ที่รองรับ OSC 8 hyperlinks เช่น VS Code Terminal รุ่นที่รองรับ โดยรวมถึงรายการ `OVEREXTENDED` และ `WAIT/RETEST`

### 3. กรอบการตัดสินใจและการจำแนกสถานะ (Action Classification)
ระบบจำแนกสถานะเหรียญใน Snapshot ออกเป็น 3 กลุ่มหลัก:
1. **🟢 พร้อมเข้าซื้อ (Trigger 1H Active)**: ผ่านเกณฑ์ MPTM และเกิดสัญญาณซื้อยืนยันในไทม์เฟรม 1H เรียบร้อยแล้ว
2. **🟢/🟡 เฝ้าระวังในโซน MPTM (Early / Confirmed Candidates)**: โครงสร้าง W/D แข็งแกร่ง อยู่ในโซนสะสม 4H (`HH/HL` หรือ `RANGE`) หรือมีอัตราเร่งแรงส่งสูง แต่ยังต้องรอสัญญาณ 1H Trigger ยืนยัน
3. **🟡 เฝ้าระวัง/รอสร้างฐาน**: เหรียญที่ย่อตัวลงมาพักฐานหนักหรือหลุดแนวรับสั้น ต้องรอให้ราคาตั้งทรงสร้างฐานใหม่ก่อน

---

## Part 2: สเปกตรัมระบบจับสัญญาณ Early Entry และการเปลี่ยนผ่าน Momentum (MPTM Specification)

# 🧠 Momentum Phase Transition Model (MPTM): สเปกตรัมระบบจับสัญญาณ Early Entry และการเปลี่ยนผ่าน Momentum

## 1. ปรัชญาและแกนความคิดหลักของระบบ (Core Philosophy)

**Momentum Phase Transition Model (MPTM)** คือโมเดลสถาปัตยกรรมระบบที่ถูกออกแบบมาเพื่อวิเคราะห์และค้นหา **"พฤติกรรมก่อนการระเบิดตัวของราคา" (Pre-Run Behavior)** โดยมุ่งเน้นการตรวจจับจังหวะที่สินทรัพย์ดิจิทัลกำลังเปลี่ยนผ่านจากสภาวะแนวโน้มปกติ (Trend) ไปสู่ความเร่งของแรงซื้อ (Momentum Acceleration) ก่อนที่ราคาจะเข้าสู่ช่วงการวิ่งขึ้นเต็มตัว (Full Run)

หลักการสำคัญของ MPTM คือการไม่ยึดติดกับชื่อเหรียญหรือผลการดำเนินงานในอดีต แต่เน้นการถอดรหัสพฤติกรรมโครงสร้างราคา อัตราเร่งของตัวชี้วัด และปริมาณการซื้อขายผ่านลำดับขั้นการคัดกรองที่เข้มงวด เพื่อขจัดอคติ (Bias) และเพิ่มความแม่นยำในการเข้าซื้อที่จุด **Early Entry Zone**

> **ลำดับการเปลี่ยนผ่านสภาวะของ MPTM**:
> 
> **[1. Direction Filter: W → D]** $\rightarrow$ **[2. Momentum Acceleration: Delta ↑]** $\rightarrow$ **[3. Volume Confirmation: Vol ↑]** $\rightarrow$ **[4. Structure Shift: Reversal/Breakout]** $\rightarrow$ **[5. Relative Strength & Liquidity Check]** $\rightarrow$ **🟢 ENTRY DECISION**

---

## 2. ลำดับขั้นการตรวจสอบเชิงระบบ (Sequential Evaluation Hierarchy)

ระบบ MPTM กำหนดให้การประมวลผลข้อมูลต้องทำตามลำดับขั้นตอนที่เคร่งครัด ห้ามสลับลำดับ เพื่อให้มั่นใจว่าการพิจารณาทิศทางภาพใหญ่เกิดขึ้นก่อนการประเมินสัญญาณซื้อขายระยะสั้น:

| ลำดับขั้นตอน | ตัวชี้วัด / มิติการตรวจวัด | วัตถุประสงค์และเกณฑ์การพิจารณา |
| :--- | :--- | :--- |
| **1. TREND** | Trend Direction (W/D) | กำหนดทิศทางภาพใหญ่ โดยสังเกตโครงสร้างราคาและแนวโน้มหลัก (ต้องเป็น UP เท่านั้น) |
| **2. EMA** | EMA9 vs EMA21 | ยืนยันการเรียงตัวของเส้นค่าเฉลี่ยเคลื่อนที่แบบสมบูรณ์ ($EMA9 > EMA21$) |
| **3. RSI W** | Weekly RSI | ตรวจสอบแรงส่งระดับสัปดาห์ ต้องยืนเหนือระดับสมดุล ($RSI(W) > 50$) |
| **4. RSI D** | Daily RSI | ควบคุมพื้นที่การเติบโตของราคา ไม่เข้าซื้อในโซนความร้อนสูง ($RSI(D) < 70$) |
| **5. MACD** | MACD Histogram | ยืนยันแรงส่งของทิศทางปัจจุบันให้เป็นบวก ($MACD\text{ Hist} > 0$) |
| **6. Acceleration** | MACD Hist Delta ($\Delta$) | **แกนหลักสำคัญที่สุด**: ตรวจวัดอัตราเร่งโมเมนตัม ($\Delta > 0$) |
| **7. VOLUME** | Volume Expansion | ปริมาณการซื้อขายต้องเพิ่มขึ้นเพื่อยืนยันการเข้ามาของสภาพคล่องจริง |
| **8. PRICE STRUCTURE** | Structure Status | พฤติกรรมราคาต้องเปลี่ยนผ่านจาก `REVERSAL` $\rightarrow$ `BREAKOUT` $\rightarrow$ `UP` |
| **9. RELATIVE STRENGTH** | Performance vs BTC | เปรียบเทียบความแข็งแกร่งเทียบกับ Benchmark ตลาดเพื่อเลือกตัวนำ |
| **10. LIQUIDITY** | Market Depth / Vol | ตรวจสอบความสามารถในการเข้า-ออกออเดอร์โดยไม่เกิด Slippage สูง |

---

## 3. เงื่อนไขเชิงคณิตศาสตร์และตัวชี้วัดของ PRE-ENTRY-Like Pattern(CANDIDATE)

การเข้าสู่สภาวะ **Momentum Transition** สมบูรณ์แบบตาม MPTM ต้องผ่านเกณฑ์การคำนวณทางเทคนิคทั้งหมดดังต่อไปนี้:

$$\text{MPTM Condition} = \begin{cases} 
\text{TREND}(W) = \text{UP} \\
EMA9 > EMA21 \\
RSI(W) > 50 \\
RSI(D) < 70 \\
\text{MACD Histogram} > 0 \\
\Delta \text{MACD Histogram} > 0 \\
\text{Volume} > \text{Average Volume}
\end{cases}$$

### ความหมายเชิงลึกของแต่ละเกณฑ์:
* **$EMA9 > EMA21$**: ยืนยันว่าราคาในระยะสั้นมีความเร่งเหนือกราฟระยะกลาง
* **$RSI(W) > 50$**: แสดงถึงสภาวะตลาดฝั่งแรงซื้อควบคุมภาพใหญ่ระดับสัปดาห์
* **$RSI(D) < 70$**: เป็นการจำกัดความเสี่ยง เพื่อป้องกันการเข้าซื้อ ณ จุดยอดการไล่ราคา (Overbought)
* **$\Delta \text{MACD Histogram} > 0$**: บ่งชี้ว่าค่า Histogram ของวันนี้สูงกว่าค่าวานนี้ ($\text{Hist}_{t} - \text{Hist}_{t-1} > 0$) ซึ่งหมายถึงการเร่งตัวของแรงซื้อที่กำลังเพิ่มกำลังอย่างรวดเร็ว

---

## 4. 3 หัวใจหลักในการจับสัญญาณ Early Momentum

หากต้องคัดสรรสัญญาณที่มีค่าน้ำหนักสูงที่สุด 3 อันดับแรกในการค้นหาเหรียญต้นรอบก่อนเกิดการวิ่งขึ้นขนาดใหญ่ (Run) MPTM ให้ความสำคัญกับปัจจัยต่อไปนี้:

### 1️⃣ MACD Histogram Delta ($\Delta > 0$) — อัตราเร่งของแรงส่ง
ระบบไม่มองเพียงแค่ว่า MACD เป็นบวก แต่ต้องตรวจจับ **"อัตราการเปลี่ยนแปลงของความเร่ง"** เพราะความแตกต่างระหว่างการมีแรงส่งทั่วไป กับการที่แรงส่งกำลังเพิ่มกำลังทวีคูณ คือจุดแบ่งแยกเหรียญที่กำลังจะเริ่มรันเทรนด์

### 2️⃣ Volume Confirmation (Volume ↑) — การยืนยันด้วยเม็ดเงินจริง
อัตราเร่งของโมเมนตัมที่มีคุณภาพจำเป็นต้องซัพพอร์ตด้วยปริมาณการซื้อขายที่เพิ่มขึ้นมากกว่าค่าเฉลี่ย สัญญาณ $\text{MACD Delta} \uparrow + \text{Volume} \uparrow$ มีนัยสำคัญสูงกว่าสัญญาณ MACD Buy เพียงอย่างเดียวหลายเท่า

### 3️⃣ Price Structure Transition (Reversal $\rightarrow$ Breakout) — โครงสร้างราคาเปลี่ยนผ่าน
ระบบให้ความสนใจเป็นพิเศษในโซน **Early Momentum** นั่นคือช่วงที่โครงสร้างราคาเปลี่ยนจากสภาวะการกลับตัว (`REVERSAL`) ไปสู่การทะลุกรอบ (`BREAKOUT`) เนื่องจากหากรอจนกว่าโครงสร้างเปลี่ยนเป็น `UP` เต็มตัว ราคาอาจปรับตัวขึ้นไปไกลเกินกว่าโซนเข้าซื้อที่ปลอดภัย

---

## 5. กรอบการตัดสินใจและระดับจุดเข้าซื้อ (Dual-Stage Entry Framework)

MPTM แบ่งสเตจการเข้าซื้อออกเป็น 3 ระดับตามระดับความเสี่ยงและอัตราผลตอบแทน (Risk/Reward Ratio):

> **สรุปสเตจการเข้าซื้อตามลำดับ**:
>
> * **[Early Stage]**: REVERSAL + MACD Delta ↑ + Volume ↑ + RS ↑
>   * *แอ็กชัน*: 🟢 **เตรียมเข้าซื้อ (Entry Candidate / High R/R)**
> * **[Confirmed Stage]**: EMA Alignment + RSI W > 50 + Hist Delta ↑ + Breakout / Structure UP
>   * *แอ็กชัน*: 🟢 **สัญญาณซื้อยืนยัน (Confirmed BUY)**
> * **[Late Stage]**: RSI D ≥ 70 + ราคาห่าง EMA9 + Volume พุ่งปลายคลื่น
>   * *แอ็กชัน*: 🟡 **ห้ามไล่ราคา (Overextended Zone)**

### รายละเอียดตารางการตัดสินใจ (Decision Matrix):

| สเตจการเข้าซื้อ | ชุดสัญญาณสะสม | แอ็กชัน / การตัดสินใจ | ระดับความเสี่ยง / อัตราแม่นยำ |
| :--- | :--- | :--- | :--- |
| **1. Early Entry** | `PRICE STRUCTURE` = REVERSAL<br>$\Delta \text{MACD Hist} > 0$<br>$\text{Volume} \uparrow$<br>$\text{Relative Strength} = \text{BUY}$ | 🟢 **เตรียมเข้าซื้อ / เฝ้าระวังชิดขอบ**<br>(สะสมไม้แรกในโซนย่อตัว) | **Risk/Reward สูงมาก**<br>แต่ต้องใช้การจำกัดความเสี่ยงด้วย Stop Loss |
| **2. Confirmed Entry** | $EMA9 > EMA21$<br>$RSI(W) > 50$<br>$\text{MACD Hist} > 0$ และ $\Delta > 0$<br>$\text{Volume} > \text{Avg Vol}$<br>Structure = BREAKOUT / UP | 🟢 **ซื้อยืนยันตามระบบ (BUY)**<br>(ส่งคำสั่งซื้อเต็มอัตราส่วนตามแผน) | **ความน่าจำเป็นสูง (High Win Rate)**<br>โมเมนตัมและทรงราคายืนยันพร้อมกัน |
| **3. Late / Overextended** | $RSI(D) \ge 70$<br>ราคาขยับห่างจากเส้น EMA9 มากเกินไป<br>Volume พุ่งสูงหลังจากราคา Run ไปแล้วหลายแท่ง | 🟡 **งดส่งคำสั่งซื้อ / ห้ามไล่ราคา**<br>(รอการย่อตัวสร้างฐานใหม่) | **ความเสี่ยงสูง (High Risk)**<br>เสี่ยงต่อการโดนพักฐานแรง |

---

## 6. ตัวกรองความแข็งแกร่งเทียบตลาด และสภาพคล่อง Execution

### Relative Strength (RS) — การคัดเลือกเหรียญที่ตลาดเลือก
* ระบบประเมินการเคลื่อนไหวของเหรียญเทียบกับ Bitcoin (BTC) หรือ Index ตลาด
* หากเหรียญมีอัตราการปรับตัวขึ้นสูงกว่า Benchmark ตลาด จะได้สถานะ $\text{Relative Strength} = \text{BUY}$
* **บทบาทในระบบ**: ใช้เป็นตัวเสริมความมั่นใจ (Conviction Booster) เพื่อคัดเลือกตัวที่ดีที่สุดในกลุ่ม แต่ไม่นำมาใช้เป็น Trigger ซื้อหลักเนื่องจาก RS มักจะปรากฏหลังจากราคาเริ่มเคลื่อนไหวไปแล้วระดับหนึ่ง

### Liquidity Guard — ตัวกรองการทำรายการจริง
* ประเมินจากปริมาณการซื้อขายออเดอร์และ Market Depth
* **เกณฑ์การอนุมัติ**:
  * $\text{LIQUIDITY} = \text{LOW} \rightarrow$ **🔴 ปฏิเสธการเข้าซื้อทันที** แม้สัญญาณเทคนิคและโมเมนตัมจะสมบูรณ์แบบ
  * $\text{LIQUIDITY} \ge \text{MEDIUM} \rightarrow$ **🟢 ผ่านตัวกรองการทำรายการ** สามารถส่งคำสั่งซื้อขายได้จริงโดยไม่เกิด Slippage สูง

---

## 7. สรุปเช็กลิสต์สถาปัตยกรรม MPTM (System Summary Checklist)

เพื่อนำโมเดล MPTM ไปปรับใช้ในเชิงปฏิบัติ ระบบต้องดำเนินการตรวจสอบตาม Checklist สรุปนี้:

1. **Direction**: TREND(W) และ TREND(D) มีสถานะเป็น UP หรือตั้งทรงขาขึ้น
2. **Alignment**: เส้น $EMA9 > EMA21$ ในโครงสร้างไทม์เฟรมหลัก
3. **Momentum Base**: $RSI(W) > 50$ และ $RSI(D) < 70$
4. **Acceleration**: $\Delta \text{MACD Histogram} > 0$ (Histogram วันนี้เร่งตัวขึ้นกว่าวานนี้)
5. **Volume**: Volume ยืนยันการเข้ามาของแรงซื้อ
6. **Structure**: โครงสร้างราคาอยู่ในช่วง `REVERSAL` หรือกำลัง `BREAKOUT`
7. **Relative Strength**: แข็งแกร่งกว่าตลาด ($\text{RS} = \text{BUY}$)
8. **Liquidity**: สภาพคล่องระดับ MEDIUM ขึ้นไป สามารถทำรายการได้จริง

> **ข้อคิดระบบ**: MPTM ไม่ได้เรียนรู้เพื่อไล่ตามเหรียญที่วิ่งไปแล้ว แต่เรียนรู้พฤติกรรมทางสถิติของการเปลี่ยนผ่านจาก **Trend $\rightarrow$ Momentum $\rightarrow$ Acceleration $\rightarrow$ Volume $\rightarrow$ Breakout** เพื่อให้ระบบสามารถเข้าซื้อ ณ จุดเริ่มต้นของสภาวะ Run ได้อย่างมีวินัยและยั่งยืน

---

## Part 8: ขั้นตอนการเรียกใช้ระบบต่อไป (Reusable Follow-Up Prompt Flow)

เพื่อให้การสืบค้นและการสอบถามข้อมูลจากไฟล์/Reference Sheet (REF Sheet) เป็นไปตามแนวทางเดียวกัน จึงสามารถใช้ขั้นตอนต่อไปนี้เป็น Template สำหรับการเรียกตรวจสอบใหม่ทุกครั้ง:

### 1. เริ่มจากการโหลดข้อมูลล่าสุด
(บังคับ: ดาวน์โหลดข้อมูลใหม่ทุกครั้งจากลิงค์อ้างอิง https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit?usp=sharing ก่อนเริ่มประเมินหรือแยกสัญญาณใด ๆ; ถ้าไม่มีการดาวน์โหลดใหม่ ให้หยุดทันทีและทำใหม่ก่อน)
* เปิดไฟล์ Excel / Workbook ที่มีข้อมูลล่าสุดจาก `All-Bitkub-BATCH`
* ตรวจสอบว่าเป็น Snapshot ล่าสุดหรือยัง
* หากยังไม่ได้อัปเดต ให้ดึงข้อมูลใหม่ก่อนโดยทันที
* ห้ามใช้ข้อมูลเก่า / cache / snapshot ที่ไม่ใช่เวอร์ชันล่าสุด
* ต้องดาวน์โหลดก่อนทุกครั้งก่อนดำเนินการวิเคราะห์ต่อไป
* ต้องมีการโหลดข้อมูลปัจจุบันก่อนจึงจะยอมเริ่มประเมินหรือคัดกรองเหรียญ

#### วิธีดึงข้อมูลโดยไม่ต้องใช้ API Key (Public Sheet Export)

**วิธีที่ 1: รัน update.sh จาก Terminal (แนะนำ)**

```bash
cd ../Projects/TFOSvX && ./update.sh
```

* script จะดาวน์โหลด → ประมวลผล MPTM → สร้าง Excel output ครบในคำสั่งเดียว
* ไฟล์ script อยู่ที่: `../Projects/TFOSvX/update.sh`

**🔧 การกำหนดเหรียญที่แสดงในหัวข้อ (TARGET_COIN):**
- แก้บรรทัด `TARGET_COIN = 'BTC'` ใน `update.sh` (บรรทัดที่ 56)
- เปลี่ยนเป็นเหรียญที่ต้องการ (เช่น `'AAVE'`, `'ATOM'`, `'QNT'`)
- ระบบจะแสดง LAST_CANDLE, UPDATED, Source ของเหรียญที่กำหนดเท่านั้น
- ถ้าไม่พบเหรียญที่กำหนด จะใช้แถวแรกสุดแทน

**วิธีที่ 2: ดาวน์โหลดด้วย curl โดยตรง**
เนื่องจาก Reference Sheet (REF Sheet) ต้นทางเป็น Public สามารถดาวน์โหลดโดยตรงผ่าน `curl` ได้เลยโดยไม่ต้องใช้ credentials:

```bash
curl -L "https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/export?format=xlsx" \
  -o ../Projects/TFOSvX/downloads/All-Bitkub-Batch-Log-vX.xlsx
```

* ไฟล์ที่ดาวน์โหลดจะมีชีทเดียวชื่อ `All-Bitkub-BATCH` พร้อมข้อมูลครบทุกคอลัมน์
* ค่าในแต่ละเซลล์จะถูก export เป็น `COMPUTED_VALUE` (ค่าที่คำนวณแล้ว) ไม่ใช่สูตร ให้ parse ด้วย regex: `,([^,]+)\)$`
* ไฟล์ output บันทึกที่: `../Projects/TFOSvX/downloads/All-Bitkub-Batch-Log-vX_output.xlsx`

### 2. ตรวจโครงสร้างข้อมูลและคอลัมน์สำคัญ
* ค้นหาเฉพาะคอลัมน์ที่เกี่ยวข้อง เช่น `AKA`, `TIER`, `Source`, `PRICE`, `TREND(W)`, `RSI(W)`, `RSI(D)`, `MACD_HIST(W)`, `MACD_HIST_DELTA(W)`, `EMA9(W)`, `EMA21(W)`, `PRICE_STRUCTURE(W)`, `ENTRY_TRIGGER(1H)`, `ACTION(1H)`, `SIGNAL_VOLUME(W)`, `SIGNAL_VOLUME(D)`, `SIGNAL_VOLUME(4H)`, `SIGNAL_VOLUME(1H)`
* ยืนยันว่าค่าของแต่ละคอลัมน์มีความถูกต้องก่อนประเมิน

### 3. ปรับใช้หลัก PRE-ENTRY-Like Pattern(CANDIDATE)
* ตรวจว่าเหรียญนั้นผ่านเงื่อนไข MPTM หรือยัง เช่น:
  * `TREND(W) = UP`
  * `EMA9 > EMA21`
  * `RSI(W) > 50`
  * `RSI(D) < 70`
  * `MACD Hist > 0`
  * `MACD Hist Delta > 0`
* ถ้าไม่ผ่าน ต้องจัดเป็น `WAIT` / `RETEST` / `EARLY CANDIDATE` มากกว่าการบอกว่า BUY ทันที

### 4. แยกสถานะตาม Level ของแรงขับเคลื่อน
* **BUY CONFIRMED**: ผ่านทั้งหมด และเกิด `ENTRY_TRIGGER(1H)`
* **EARLY / WATCH**: ผ่านเงื่อนไขครบ 6 ข้อ แต่ยังรอ 1H trigger:
  1. `TREND(W) = UP`
  2. `RSI(W) > 50`
  3. `MACD_HIST_DELTA(W) > 0`
  4. `RSI(D) < 70`
  5. `EMA9(W) > EMA21(W)`
  6. `SIGNAL_VOLUME ≥ 1 TF = BUY`
* **🟠 PULLBACK ZONE**: `TREND(W)=UP` + `TREND(4H)=UP` + `TREND(1H)=UP` แต่ `RSI(1H) < 50` — โครงสร้างภาพใหญ่ยังดี กำลังพักฐานชั่วคราวใน 1H **เรียงตาม Combined Score สูงสุดก่อน** แสดงผลแยก 3 บรรทัด:
  * `VOL   W/D/4H/1H` — 🟢=BUY / ⚪=HOLD พร้อมคะแนน (x/4)
  * `TREND W/D/4H/1H` — 🟢=UP / 🔴=DOWN พร้อมคะแนน (x/4)
  * `CMB   W/D/4H/1H` — ✅=VOL🟢+TREND🟢 พร้อมกันใน TF เดียวกัน / ❌=ไม่ผ่าน พร้อมคะแนน (x/4)
* **WAIT / RETEST**: ไม่นิ่งแต่ยังไม่ผ่าน threshold ครบ
* **OVEREXTENDED**: RSI สูงเกิน, ราคาไกล EMA, Volume พุ่งปลายคลื่น

### 5. จัดอันดับเหรียญแบบเคร่งครัด
* เรียงตามความสอดคล้องกับ TAO-like มากที่สุดก่อน
* ให้ความสำคัญกับ:
  1. อัตราเร่ง MACD Delta
  2. ปริมาณ Volume (SIGNAL_VOLUME W/D/4H/1H — นับ BUY score x/4)
  3. โครงสร้างราคา `REVERSAL → BREAKOUT`
  4. Relative Strength
  5. Liquidity
* **PULLBACK ZONE**: เรียงตาม **Combined Score** สูงสุดก่อน — Combined = TF ที่ทั้ง VOL=🟢 **และ** TREND=🟢 พร้อมกันใน TF เดียวกัน (max 4/4)

### 6. สรุปผลแบบกระชับและจับประเด็น
* ระบุว่า “เหรียญไหนใกล้ที่สุด”
* ระบุว่า “เหรียญไหนควรเฝ้าระวัง”
* ระบุว่า “เหรียญไหนยังไม่พร้อมเพราะวิตกเรื่อง structure / RSI / liquidity”

### 7. ตัวอย่างคำถามที่ใช้เรียกต่อไป

#### ตัวอย่าง 1: คัดเหรียญใกล้ PRE-ENTRY-Like Pattern(CANDIDATE) มากที่สุด
> ให้เช็กข้อมูลจาก `All-Bitkub-BATCH` แล้วคัดเหรียญที่มี `TREND(W)=UP`, `EMA9 > EMA21`, `RSI(W)>50`, `RSI(D)<70`, `MACD_HIST>0`, `MACD_HIST_DELTA>0` มากที่สุดและจัดอันดับจากใกล้สุดถึงไกลสุด

#### ตัวอย่าง 2: หาเหรียญที่พร้อม BUY จริง
> ให้ค้นหาเหรียญที่มี `ENTRY_TRIGGER(1H)` เป็น BUY หรือ TRIGGER พร้อมทั้งผ่าน `TFOSvX` และมี `Liquidity ≥ MEDIUM` แล้วให้แสดงแค่ top 5

#### ตัวอย่าง 3: ตรวจสถานะเฝ้าระวัง
> ให้ดูเหรียญที่ยังไม่ BUY แต่มีแรงเร่งและโครงสร้างดี ควรจัดอยู่ใน `EARLY / WATCH` หรือ `WAIT / RETEST` อย่างไร

#### ตัวอย่าง 4: ตรวจโซนเสี่ยง
> ให้ระบุเหรียญที่ `RSI(D) >= 70`, ราคาไกล EMA9, หรือปริมาณพุ่งหลัง Run แล้ว ซึ่งควรจัดเป็น `Late/Overextended` และไม่ควรเข้าซื้อ

### 8. กติกาในการเรียกต่อไป
* ขอข้อมูลจาก Spreadsheet ให้เป็นข้อมูลล่าสุดก่อนทุกครั้ง
* ไม่คาดเดาเหรียญจากความรู้สึก แต่ต้องอ้างอิงคอลัมน์ที่มีอยู่จริง
* ใช้ลำดับ MPTM เป็นหลักในการตัดสินใจ
* ระบุสถานะชัดเจน: `ENTRY`, `WATCH`, `WAIT`, `OVEREXTENDED`

> **สรุปสั้น**: วิธีการถามของระบบที่ใช้ซ้ำได้คือ “ตรวจข้อมูลล่าสุด → ปรับใช้ MPTM → คัดกรองตามลำดับ → จัดอันดับตามแรงส่งและโครงสร้าง → สรุปสถานะและตัวเลือกที่ใกล้ BUY มากที่สุด”

---

## Part 9: รูปแบบคำตอบต่อเหรียญทุกครั้ง (Required Answer Format)

ทุกครั้งที่สอบถามหรือวิเคราะห์เกี่ยวกับเหรียญ ให้ตอบในรูปแบบที่บังคับดังนี้เสมอ:

```
AKA         : <ชื่อเหรียญ> 🚀
LAST_CANDLE : <timestamp ของ candle ล่าสุด>
UPDATED     : <timestamp ที่ข้อมูลอัปเดตล่าสุด>
Source      : <แหล่งข้อมูลที่ใช้ เช่น exchange, broker, export>
```

### กฎการตอบ:
* ต้องระบุข้อมูล 4 อย่างนี้เป็นบรรทัดแรกสุดของสรุปทุกครั้ง
* ต้องยึดตามข้อมูลจริงจาก Sheet / Workbook ที่เพิ่งดาวน์โหลดมาใหม่ล่าสุด
* ไม่ใช้ข้อมูลเก่าหรือแคชจากรอบก่อน
* ถ้าไม่สามารถระบุค่าจริงได้ ให้ระบุว่า “ข้อมูลไม่พร้อม / ไม่พบใน Snapshot” และหยุดก่อนวิเคราะห์ต่อ
* เมื่อแสดงรายงานเหรียญในแชท ให้ชื่อเหรียญในทุกหมวดและทุกตารางเป็น Markdown link ไปยัง `https://www.tradingview.com/chart/?symbol=<AKA>THB` เช่น `[L3](https://www.tradingview.com/chart/?symbol=L3THB)`
* รูปแบบคอลัมน์ของผล `UPDATE`, `PORTFOLIO` และ `CANDIDATE` ให้ใช้ตามข้อกำหนดในหัวข้อ [คอลัมน์ผลลัพธ์คำสั่ง](#คอลัมน์ผลลัพธ์คำสั่ง-update-portfolio-และ-candidate) โดยแสดงตาราง Markdown เพื่อให้ทั้งผู้ใช้และ AI อ่านหัวคอลัมน์กับข้อมูลในแต่ละแถวได้ชัดเจน
* สำหรับ `OVEREXTENDED` ให้แสดงจำนวนเหรียญและรายชื่อเป็น TradingView links; สำหรับ `WAIT/RETEST` ให้แสดงเฉพาะหัวข้อกับจำนวน ไม่ต้องแสดงรายชื่อหรือตาราง
* ท้ายรายงานผลการจัดกลุ่ม ให้แสดงหมายเหตุว่า “ผลการจัดกลุ่มนี้อ้างอิงจากข้อมูล MPTM ที่อัปเดตล่าสุด ไม่ถือเป็นคำสั่งซื้อขายอัตโนมัติ โดยให้รอ 1H Trigger ตามเงื่อนไขในคู่มือก่อนพิจารณาเข้าซื้อ ทั้งนี้ สามารถติดตามการแจ้งเตือน 1H Trigger ได้ทาง Telegram: [TimeFrame CRYPTO Notify](https://t.me/TimeFrameCRYPTOnotify)”

### คอลัมน์ผลลัพธ์คำสั่ง UPDATE, PORTFOLIO และ CANDIDATE

ทุกหัวข้อและคอลัมน์ด้านล่างเป็นรูปแบบมาตรฐานที่ต้องคงชื่อและลำดับไว้ ห้ามรวมหลายคอลัมน์ไว้ในบรรทัดเดียวหรือใช้ป้ายกำกับแทนหัวตาราง

#### คำสั่ง UPDATE

แสดง `AKA`, `LAST_CANDLE`, `UPDATED` และ `Source` ก่อนรายงานสถานะ จากนั้นแสดงแต่ละกลุ่มตามรูปแบบนี้:

1. `🟢 BUY CONFIRMED — n เหรียญ` — แสดงทุกเหรียญใน Markdown table โดยเรียงคอลัมน์: `เหรียญ | Tier | Source | RSI(W) | RSI(D) | MACD_D | ราคา | Liquidity`
2. `🟡 EARLY/WATCH — n เหรียญ (TOP 10)` — แสดงไม่เกิน 10 เหรียญ เรียงตาม MACD Delta (W) จากมากไปน้อย และใช้คอลัมน์: `เหรียญ | Tier | Source | RSI(W) | RSI(D) | MACD_D | ราคา | Liquidity`
3. `🟠 PULLBACK ZONE — n เหรียญ (TOP 10)` — แสดงไม่เกิน 10 เหรียญ เรียงตาม Combined Score จากมากไปน้อย และใช้คอลัมน์: `เหรียญ | Tier | RSI(W) | RSI(1H) | ราคา | VOL (x/4) | TREND (x/4) | CMB (x/4) | Liquidity`
4. `🔴 OVEREXTENDED — n เหรียญ` — แสดงชื่อเหรียญเป็น TradingView link
5. `⚪ WAIT/RETEST — n เหรียญ` — แสดงเฉพาะหัวข้อกับจำนวน ไม่ต้องแสดงรายชื่อหรือตาราง

ชื่อเหรียญในตารางและรายชื่อ `OVEREXTENDED` ต้องเป็น Markdown link ไปยัง TradingView ตัวอย่าง: `[BTC](https://www.tradingview.com/chart/?symbol=BTCTHB)`. ค่า Liquidity ต้องเป็นผลจากการตรวจตลาดล่าสุด และแสดงระดับ `🟢 HIGH`, `🟡 MEDIUM`, `🔴 LOW` หรือ `⚫ N/A`.

#### คำสั่ง PORTFOLIO

แสดงข้อมูล Portfolio เป็น Markdown table โดยใช้หัวคอลัมน์และลำดับดังนี้:

`Currency | Tier | Total | ราคาซื้อเฉลี่ย (รวมค่าธรรมเนียม) | ราคาล่าสุด | มูลค่า (THB) | กำไร/ขาดทุน (หักค่าธรรมเนียม) | %P/L | ราคา Limit (THB) | ปริมาณในคำสั่ง | Remark`

ค่า `Currency` ของเหรียญทุกแถวต้องเป็น Markdown link ไปยัง TradingView ตามรูปแบบ `<CURRENCY>THB` เช่น `[BTC](https://www.tradingview.com/chart/?symbol=BTCTHB)`. ค่า `Tier` อ่านจากคอลัมน์ `TIER` ของแถว `AKA` ที่ตรงกันในชีต `All-Bitkub-BATCH` จาก REF Sheet ที่กำหนดด้วย `REF_SHEET_URL`; หากอ่านหรือจับคู่ไม่ได้ให้แสดง `N/A`. เรียงเหรียญตามมูลค่าพอร์ตจากมากไปน้อย. แถว THB ไม่ใช่เหรียญและไม่ต้องทำเป็นลิงก์ โดยแสดง `—` ในคอลัมน์ Tier.

คอลัมน์ `ราคา Limit (THB)` และ `ปริมาณในคำสั่ง` แสดงเฉพาะคำสั่ง SELL แบบ Limit ที่ยังเปิดอยู่ โดยอ่านจาก `GET /api/v3/market/my-open-orders?sym=<coin>_thb`; ใช้ค่า `rate` และ `amount` ตามที่ API ส่งกลับ. หากมีหลายคำสั่งให้แสดงแยกรายการด้วย `<br>` โดยจับคู่ลำดับราคาและปริมาณ. หากไม่มีคำสั่งเปิดให้แสดง `—`; หาก request ล้มเหลว, HTTP status ไม่สำเร็จ, Bitkub JSON `error` ไม่ใช่ 0 หรือ response ผิดรูปแบบ ให้แสดง `N/A` และเติม `Open Orders N/A` พร้อมรายละเอียด HTTP status/Bitkub error ใน `Remark`. หากข้อมูล `rate` หรือ `amount` ของคำสั่งไม่ครบให้แสดง `N/A` ในเซลล์ที่เกี่ยวข้องและเพิ่ม `Open Orders data incomplete` ใน `Remark`. `Remark` ยังคงแสดงหมายเหตุอื่น เช่น `Broker Coin*` หรือ `No OH*` และเมื่อมีคำสั่งเปิดให้เพิ่ม `Limit Sell เปิด n คำสั่ง`. แถว THB แสดง `—` ในสองคอลัมน์นี้.

#### คำสั่ง CANDIDATE

แสดงหัวข้อ `ผลการค้นหา CANDIDATE (PRE-ENTRY-Like Pattern) — n เหรียญ` และบรรทัดอธิบาย `ผ่านเกณฑ์ MPTM 6 ข้อ เรียงตาม MACD Delta (W) สูงสุด — รอ 1H Trigger ยืนยัน` จากนั้นแสดง Markdown table ไม่เกิน 20 เหรียญ เรียง `MACD_HIST_DELTA(W)` จากมากไปน้อย โดยใช้หัวคอลัมน์และลำดับต่อไปนี้:

`# | เหรียญ | Tier | ราคา (THB) | MACD Δ(W) | Entry Zone (4H) | 1H Trigger | Liquidity`

`n` คือจำนวนผู้ผ่านเกณฑ์ทั้งหมดก่อนจำกัดตารางไว้ 20 แถว หมายเลข `#` เริ่มจาก 1 ตามลำดับ MACD Delta ชื่อเหรียญทุกแถวต้องเป็นลิงก์ TradingView ไปยัง `<AKA>THB`. ค่า `Liquidity` ต้องตรวจจาก Bitkub API ล่าสุด โดยใช้เกณฑ์เดียวกับ `check_liquidity()` ใน `update.sh` และแสดงเป็น `🟢 HIGH`, `🟡 MEDIUM`, `🔴 LOW` หรือ `⚫ N/A`; ห้ามใช้ข้อมูล Liquidity เก่าหรืออนุมานแทนผลตรวจจริง

### ตัวอย่างรูปแบบคำตอบ:
```
AKA         : ATOM 🚀
LAST_CANDLE : 07/10/2026 23:00
UPDATED     : 07/10/2026 23:07
Source      : exchange
```

สรุป: ATOM ยังไม่ผ่าน MPTM เนื่องจาก Trend(W)=DOWN, EMA9 < EMA21, MACD_HIST_DELTA < 0, ENTRY_TRIGGER(1H)=WAIT

### บทบาทของรูปแบบนี้:
* ทำให้ทุกคำตอบมี traceability และความชัดเจน
* ป้องกันการสรุปจากข้อมูลล้าหรือข้อมูลที่ไม่ใช่ snapshot ล่าสุด
* ช่วยให้กระบวนการตรวจสอบย้อนหลังเป็นไปตามหลัก MPTM อย่างโปร่งใส

---

### Version Note
* เอกสารนี้เป็นเวอร์ชันนำเสนอและสิ่งที่ถูกบันทึกไว้ที่นี่ใช้เป็น Standard Response Format สำหรับการวิเคราะห์เหรียญต่อเนื่อง
* Changelog สำหรับรูปแบบคำตอบล่าสุด: เพิ่มบังคับให้ทุกคำตอบใส่ `AKA`, `LAST_CANDLE`, `UPDATED`, `Source`

**09/10/2026 - เพิ่มคู่มือการทำงานและตั้งค่า .env**
- เพิ่ม Part 1.0: การตั้งค่าเริ่มต้น
- เพิ่มการตั้งค่า REF_SHEET_URL ใน .env
- เพิ่มคู่มือการทำงานแบบภาพรวม (Workflow Overview)
- เพิ่มตารางคำสั่งหลักที่ใช้งาน
- เพิ่มคำสั่ง REVIEW - อ่าน guideline อีกครั้งและพร้อมรับคำสั่งใหม่
- อัปเดต update.sh ให้โหลด .env และดึง Sheet ID อัตโนมัติ
- ย้าย Reference Sheet (REF Sheet) URL จาก guideline ไปเก็บใน .env

---

## Part 10: การเปิดแชทใหม่ (New Chat Initialization)

เมื่อเปิดแชทใหม่ทุกครั้ง ให้เริ่มต้นด้วยคำสั่งนี้:

```
START
```

**หมายเหตุสำคัญ:**
* คำสั่ง **"START"** จะอ่านไฟล์ guideline จากพาธ `.../TFOSvX/TimeFrame-OS-guidelines-and-model-vX.md` อัตโนมัติ
* **กรณีเครื่องใหม่**: ผู้ใช้ต้องสร้างโครงการ (โฟลเดอร์) ก่อน โดยตั้งชื่อโฟลเดอร์เป็น `MPTM` และวางไฟล์ `TimeFrame-OS-guidelines-and-model-vX.md` ไว้ในโฟลเดอร์นั้น
* หลังจากพิมพ์ **"START"** ระบบจะโหลดหลักการ MPTM, วิธีดึงข้อมูล, คำสั่ง update.sh และ format การตอบครบทันที
* จากนั้นพิมพ์ **"UPDATE"** ได้เลย — ระบบจะดึงข้อมูลล่าสุด, ประมวลผล MPTM และตรวจ **Liquidity ทุกเหรียญในทุกหมวด** (🟢 HIGH / 🟡 MEDIUM / 🔴 LOW) พร้อม Vol24h และ Spread% โดยอัตโนมัติ
* กรณีพิมพ์ **"CANDIDATE"** - ระบบจะแสดงเหรียญที่อยู่ในสถานะ PRE-ENTRY-Like Pattern(CANDIDATE) พร้อมข้อมูลที่จำเป็น
* กรณีพิมพ์ **"REVIEW"** - ระบบจะอ่านไฟล์ TimeFrame-OS-guidelines-and-model-vX.md อีกครั้งและพร้อมรับคำสั่งใหม่

---

## Part 11: คำสั่งซื้อขาย Bitkub (Trade Commands)

### โครงสร้างไฟล์

```
MPTM/
├── trade.sh      ← script ส่งคำสั่งซื้อขาย
├── .env          ← เก็บ API Key / Secret (ห้าม commit)
└── .gitignore    ← ป้องกัน .env ไม่ติด git
```

### ตั้งค่า API (ครั้งเดียว)

แก้ไขไฟล์ `../Projects/TFOSvX/.env`:
```
BITKUB_API_KEY=your_api_key_here
BITKUB_API_SECRET=your_api_secret_here
```

* trade.sh โหลด `.env` อัตโนมัติทุกครั้งที่รัน ไม่ต้อง `export` เอง
* API ใช้ Bitkub REST v3 (`place-bid` / `place-ask` / `my-order-history` / `my-open-orders`) + v4 (`wallet/balances`)
* Signature: HMAC SHA-256 format `{timestamp}{METHOD}{path}{body}`
* Error handling: ดู [Bitkub API Error Handling](https://api.bitkub.com/docs/errors); แสดง HTTP status code และ Bitkub JSON `error` code ที่ API ตอบกลับ โดยไม่แทนค่าหรือกลบข้อผิดพลาด

### คำสั่ง `trade.sh` ที่รองรับ

| คำสั่ง | ความหมาย |
| :--- | :--- |
| `./trade.sh "BUY/BTC/L=M/1000"` | ซื้อ BTC ราคาตลาด ใช้เงิน 1,000 บาท |
| `./trade.sh "BUY/BTC/L=2000000/1000"` | ซื้อ BTC ราคา Limit 2,000,000 ใช้เงิน 1,000 บาท |
| `./trade.sh "SELL/BTC/L=M/100%"` | ขาย BTC ราคาตลาด 100% ของยอดที่พร้อมใช้งานใน wallet |
| `./trade.sh "SELL/BTC/L=2000000/100%"` | ขาย BTC ราคา Limit 2,000,000 จำนวน 100% ของยอดที่พร้อมใช้งาน |
| `./trade.sh "MONEY"` | ตรวจยอดเงินบาทคงเหลือ (Available / Reserved / Total) |
| `./trade.sh "TARGET/BTC"` | ตรวจยอด BTC พร้อมขายและเสนอ Target Price/คำสั่ง Limit Sell ตาม TIER โดยไม่ส่งคำสั่งขาย |

Portfolio ใช้สคริปต์แยกต่างหาก: `./portfolio.sh`

### คำสั่ง TARGET — ราคาเป้าหมายจากเหรียญในพอร์ต

```bash
./trade.sh "TARGET/BTC"
```

คำสั่งนี้เป็นการอ่านข้อมูลเท่านั้น: ตรวจยอด BTC จาก `GET /api/v4/wallet/balances?symbol=BTC`, อ่าน `TIER` จากแถว `AKA` ที่ตรงกันใน REF Sheet ที่กำหนดโดย `REF_SHEET_URL` และอ่าน `Source` จาก Bitkub symbols จากนั้นดึง Order History แบบแบ่งหน้าเพื่อคำนวณต้นทุนเฉลี่ยรวมค่าธรรมเนียมจากรายการ BUY ที่จับคู่แล้วทั้งหมด ใช้สูตรและอัตรา TIER เดียวกับส่วน “หลังจากส่งคำสั่ง BUY สำเร็จ” ข้างต้น และแสดงยอดพร้อมขายกับคำสั่งแนะนำ `SELL/BTC/L=<Target Price>/100%` โดยไม่ส่งคำสั่งขาย

- ถ้า balance API สำเร็จแต่ไม่พบ BTC หรือยอดรวมเป็นศูนย์ จะแจ้งว่าอาจไม่มีเหรียญในพอร์ต พร้อม HTTP status และ Bitkub error code
- ถ้ายอดรวมมากกว่าศูนย์แต่ `available=0` จะแจ้งยอดที่ถูก reserve และไม่แนะนำคำสั่ง SELL จนกว่าจะมี available balance
- ถ้า balance/history API ผิดพลาด จะแสดง HTTP status code และ Bitkub error code; ห้ามตีความ API error ว่าไม่มีเหรียญ
- ถ้ามียอดพร้อมขายแต่ไม่มีประวัติ BUY ที่ตรวจสอบได้ เช่น Broker Coin/error 61 หรือเหรียญที่โอนเข้า จะไม่คาดเดาต้นทุนหรือ Target Price; แนะนำตรวจต้นทุนจากแหล่งที่มา แล้วส่ง `SELL/COIN/L=PRICE/100%` ด้วยราคาที่ผู้ใช้กำหนดเอง
- คำสั่ง TARGET ไม่วาง/ส่งคำสั่งขายอัตโนมัติ และ `100%` หมายถึง 100% ของยอด available ที่พร้อมขาย ไม่รวมยอด reserved

**Remark ในคอลัมน์ Portfolio:**
- **Broker Coin\*** — Broker coin ไม่มี Order History ใน Bitkub API (error 61)
- **No OH\*** — No Order History found; may be from Airdrop/Reward or external transfer
- *(ตรวจสอบแล้วทั้ง API v3 และ v4: `my-order-history`, `crypto/deposits`, `crypto/compensations`)*

### Logic สำคัญ

* **BUY** — `amt` = จำนวนบาทที่ต้องการใช้ซื้อ → ส่ง `POST /api/v3/market/place-bid`
* **SELL** — ดึง available balance จาก `GET /api/v4/wallet/balances` → คำนวณ qty ตาม % ของยอดพร้อมใช้ → ส่ง `POST /api/v3/market/place-ask`
* **L=M** → `typ=market, rat=0` | **L=ราคา** → `typ=limit, rat=ราคา`
* **Limit Sell** — ใช้สำหรับกำหนดเป้าหมายในราคาที่ต้องการขาย (Take Profit)
* ใช้ได้กับทุกเหรียญที่ Bitkub รองรับ เพียงเปลี่ยน `BTC` เป็นชื่อเหรียญที่ต้องการ

### หลังจากส่งคำสั่ง BUY สำเร็จ: Target Price ตาม TIER

เมื่อ `POST /api/v3/market/place-bid` ตอบกลับ `error=0` และมี Order ID แล้ว `trade.sh` แสดง error code และค้นหารายการ BUY ที่จับคู่แล้วของ Order ID ดังกล่าวจาก `GET /api/v3/market/my-order-history` โดยใช้ `sym=<COIN>_THB`, `p=1`, `lmt=100` และกรอง `order_id` ให้ตรงกับคำสั่งที่เพิ่งส่ง ไม่รวมรายการซื้ออื่นของเหรียญเดียวกัน

สำหรับแต่ละ fill ในประวัติ:

- มูลค่าที่ซื้อ (THB) = `amount`
- จำนวนเหรียญที่ได้รับก่อนค่าธรรมเนียม = `amount / rate`
- ค่าธรรมเนียมสุทธิ (THB) = `fee - credit`
- ต้นทุนเฉลี่ยต่อเหรียญรวมค่าธรรมเนียม = `ผลรวม(amount + fee - credit) / ผลรวม(amount / rate)`

ถ้าไม่พบ fill ให้ตรวจ `GET /api/v3/market/my-open-orders` ด้วย Order ID ก่อน หากยังเปิดอยู่ให้แจ้งว่ารอจับคู่และไม่เสนอคำสั่งขาย หาก Order History ให้ error code หรือไม่มีรายการ แต่ BUY API ยืนยัน `error=0` และมีข้อมูลผลซื้อจริงครบ (`amt`, `fee`, `cre`, `rec` โดย `rec > 0`) ให้ใช้ต้นทุนเฉลี่ย `(amt + fee - cre) / rec` แสดง HTTP status code และ Bitkub error code ที่เกี่ยวข้อง แล้วเสนอคำสั่งขายตาม TIER ได้ หากไม่มีข้อมูลครบหรือ API ตรวจพบว่า order ยังเปิดอยู่ ห้ามสร้างราคา/คำสั่งขายจากราคาเสนอหรือยอดคำสั่งที่ยังไม่จับคู่ ถ้า BUY API ตอบ error ที่ไม่ใช่ 0 ให้แจ้งว่าคำสั่งซื้อไม่สำเร็จพร้อม HTTP status code และ Bitkub error code และไม่เสนอคำสั่งขาย

`TIER` อ่านจากแถว `AKA` ของเหรียญใน REF Sheet ที่กำหนดด้วย `REF_SHEET_URL`; `Source` อ่านจาก Bitkub `/api/v3/market/symbols` และแสดงเป็น `Broker` หรือ `Exchange`. อัตราและสูตรราคาเป้าหมาย:

| TIER | %Target Price | สูตร |
|:---:|---:|---|
| T1 | 8.25% | ต้นทุนเฉลี่ยรวมค่าธรรมเนียม × 1.0825 |
| T2 | 7.25% | ต้นทุนเฉลี่ยรวมค่าธรรมเนียม × 1.0725 |
| T3 | 6.75% | ต้นทุนเฉลี่ยรวมค่าธรรมเนียม × 1.0675 |
| T4 | 5.75% | ต้นทุนเฉลี่ยรวมค่าธรรมเนียม × 1.0575 |

รูปแบบผลลัพธ์:

```text
AKA: BTC
TIER: 1
Source: Broker
%Target Price: T1=8.25%, T2=7.25%, T3=6.75%, T4=5.75%
ต้นทุนเฉลี่ยรวมค่าธรรมเนียม: <ราคา>/BTC
Target Price T1: <ราคา> THB
"SELL/BTC/L=<ราคา>/100%"
```

#### ความละเอียดราคา Limit ตามคู่เทรด

ไม่กำหนดจำนวนตำแหน่งทศนิยมเป็นมาตรฐานเดียวให้ทุกเหรียญ ก่อนใช้ราคา Limit ให้ตรวจ `price_scale` และ `price_step` ของคู่ `<COIN>_THB` จาก [Bitkub Symbols API](https://api.bitkub.com/api/v3/market/symbols); ใช้จำนวนตำแหน่งและขั้นราคาที่ API ระบุ สำหรับ Target Price ที่คำนวณได้ สคริปต์ปัดขึ้นเป็นขั้นราคาที่ถูกต้องถัดไปก่อนเสนอคำสั่ง SELL เพื่อให้ราคาไม่ต่ำกว่า Target ราคา Limit ที่ผู้ใช้ป้อนสำหรับ BUY/SELL จะถูกตรวจว่าอยู่ใน `price_scale` และตรง `price_step`; หากไม่ตรง สคริปต์จะปฏิเสธคำสั่งโดยไม่ปัดราคาให้เงียบ ๆ

ตัวอย่าง: `CVC_THB` มี `price_scale=4` และ `price_step=0.0001` ดังนั้น Target `1.130357...` ต้องใช้ `1.1304 THB`; ขณะที่คู่เหรียญอื่นอาจมีความละเอียดต่างกัน ข้อมูล Symbols API ปัจจุบันมี `price_scale` ตั้งแต่ 1 ถึง 13 ตำแหน่ง จึงไม่ควรตั้งเพดานหรือสมมติว่าทุกคู่ใช้ 4 หรือ 8 ตำแหน่ง ค่าปัจจุบันของแต่ละคู่ให้ยึดจาก API

การตอบรับคำสั่ง BUY (`error=0`) หมายถึง API รับคำสั่งแล้ว ไม่ได้ยืนยันว่าคำสั่งถูกจับคู่ ต้องตรวจ Open Orders และข้อมูลผลซื้อจริงก่อนเสนอคำสั่งขาย หากไม่มี fill ในประวัติและข้อมูลผลซื้อจริงจาก BUY API ไม่ครบ, order ยังเปิดอยู่ หรือไม่พบ TIER ที่ถูกต้องใน REF Sheet ให้แจ้งสาเหตุและไม่แสดง Target Price/คำสั่งขาย หาก API ตอบ error ที่ไม่ใช่ 0 ให้แสดง error code และแจ้งว่าคำสั่งซื้อไม่สำเร็จ ห้ามคำนวณจากราคาเสนอซื้อหรือยอดเงินที่ยังไม่ถูกจับคู่

### ⚠️ การแจ้งเตือนและยืนยันก่อนส่งคำสั่งซื้อ (BUY Warning & Confirmation)

ระบบ `trade.sh` ทำการตรวจสอบต่อไปนี้ในคำสั่ง BUY:

**ขั้นตอนการทำงาน:**
1. เรียก `GET /api/v3/market/symbols` และแสดง source ของเหรียญ; ถ้าเรียก API หรืออ่านข้อมูลไม่สำเร็จ สคริปต์ใช้ `exchange` เป็นค่าเริ่มต้น
2. ถ้าเป็น **Broker Coin** → แจ้งข้อจำกัดและขอยืนยัน (y/n)
3. ถ้ามีไฟล์ Excel output (`downloads/All-Bitkub-Batch-Log-vX_output.xlsx`) จะตรวจสถานะในชีท `Latest Snapshot`
4. ถ้าสถานะเป็น **BUY CONFIRMED** → แจ้งว่าเหรียญผ่านเกณฑ์ MPTM และขอยืนยันก่อนส่งคำสั่งซื้อ
5. ถ้าเป็นสถานะอื่น เช่น `EARLY/WATCH`, `PULLBACK ZONE`, `OVEREXTENDED`, `WAIT/RETEST` หรือ `UNKNOWN` → แจ้งเตือนว่าไม่ใช่ `BUY_CONFIRMED` และขอยืนยัน
6. ถ้าไม่มีไฟล์ Excel, ไม่พบเหรียญ (`NOT_FOUND`) หรืออ่านไฟล์/ชีทไม่ได้ (`ERROR`) → แจ้งว่าไม่สามารถตรวจสอบสถานะ MPTM ได้ และขอยืนยันก่อนซื้อ
7. เมื่อต้องยืนยัน หากผู้ใช้ตอบอย่างอื่นนอกจาก `y` หรือ `Y` คำสั่งจะถูกยกเลิก; Broker Coin ที่มีสถานะ MPTM อื่นซึ่งต้องยืนยันอาจถามสองครั้ง

**ตัวอย่างการแจ้งเตือน (Broker Coin):**
```
ℹ️  AVA เป็น Broker Coin (source: broker)
⚠️  Broker Coin อาจมีข้อจำกัดบางอย่าง เช่น ไม่มี Order History

คุณต้องการซื้อต่อไหม? (y/n)
```

**ตัวอย่างการแจ้งเตือน (Exchange Coin + EARLY/WATCH):**
```
ℹ️  ATOM เป็น Exchange Coin (source: exchange)

⚠️ คำเตือน: ATOM อยู่ในสถานะ EARLY_WATCH (ไม่ใช่ BUY CONFIRMED)
การซื้อละเมิดกฎ MPTM

ตามกฎ MPTM: ต้องมี 1H Trigger ยืนยันก่อนซื้อ
BUY CONFIRMED = ผ่าน MPTM 6 เกณฑ์ + 1H Trigger ยืนยัน

คุณต้องการซื้อต่อไหม? (y/n)
```

**กรณีไม่มีไฟล์ Excel / NOT_FOUND / ERROR:** สคริปต์แจ้งว่าไม่สามารถตรวจสอบสถานะ MPTM ได้และถามยืนยันก่อนดำเนินการ BUY ต่อ

**ประโยชน์:**
- แจ้งให้ทราบว่าเหรียญเป็น Broker หรือ Exchange ก่อนซื้อทุกครั้ง
- ป้องกันการซื้อ Broker Coin โดยไม่รู้ข้อจำกัด
- ป้องกันการซื้อโดยไม่รู้ตัวว่าละเมิดกฎ MPTM
- ป้องกันการซื้อเหรียญที่อยู่ในสถานะ OVEREXTENDED (ห้ามไล่ราคา)
### แหล่งข้อมูลอ้างอิง Bitkub API

สำหรับการแก้ไขปัญหาและอ้างอิง API ของ Bitkub:

- **REST v3**: https://github.com/bitkub/bitkub-official-api-docs/blob/master/rest-v3.md
- **REST v4**: https://github.com/bitkub/bitkub-official-api-docs/blob/master/rest-v4.md

### Stop Loss และ Take Profit

**Bitkub REST v3 ไม่รองรับ Stop-Loss Order โดยตรง**

จากเอกสาร API v3 มี endpoints ดังนี้:

| Endpoint | คำอธิบาย |
|:---|:---|
| `POST /api/v3/market/place-bid` | ส่งคำสั่งซื้อ (BUY) |
| `POST /api/v3/market/place-ask` | ส่งคำสั่งขาย (SELL) |
| `POST /api/v3/market/cancel-order` | ยกเลิกคำสั่ง |
| `GET /api/v3/market/my-open-orders` | ดูคำสั่งที่ยังไม่สำเร็จ |
| `GET /api/v3/market/my-order-history` | ดูประวัติคำสั่ง |

**ไม่ม endpoint สำหรับ:**
- Stop-Limit Order
- Stop-Market Order
- Trailing Stop Order

**วิธีทำ Stop Loss / Take Profit แบบอื่น:**

1. **ใช้ Limit Sell ที่ระดับที่ต้องการ (Take Profit/Stop Loss)**
1.1 Take Profit
   - ส่งคำสั่ง `SELL/COIN/L=ราคาเป้าหมาย/100%`
   - ข้อดี: ง่ายใช้ API ปัจจุบันรองรับ
   - ข้อเสีย: ต้องยกเลิกและส่งใหม่ทุกครั้งที่ราคาเปลี่ยน
1.2 Stop Loss
   - ส่งคำสั่ง `SELL/COIN/L=ราคาหยุดขาด/100%`
   - ข้อดี: ง่ายใช้ API ปัจจุบันรองรับ
   - ข้อเสีย: ต้องยกเลิกและส่งใหม่ทุกครั้งที่ราคาเปลี่ยน
2. **ใช้บริการอื่น**
   - ใช้ Trading Bot ที่เชื่อมต่อกับ Bitkub
   - ใช้ Service ที่มีฟีเจอร Stop Loss อัตโนมัติ

3. **จัดการ Manual ผ่าน MPTM**
   - ตรวจราคาสดในแต่ละ timeframe
   - เมื่อราคาแตะ Stop Loss → ส่งคำสั่ง SELL ผ่าน trade.sh

**หมายเหตุ:** ไม่แนะนำให้เพิ่ม STOP command ใน trade.sh เพราะ Bitkub API ไม่รองรับโดยตรง และต้องใช้ logic ซับซ้อนเพื่อจำลอง stop loss ซึ่งเสี่ยงต่อการไม่ทำงาน
