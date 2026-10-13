# TimeFrame OS vS — แนวทางสำหรับตลาดหุ้นไทย (SET)

## สถานะและขอบเขต

TFOSvS อยู่ระหว่างพัฒนาและยังไม่ใช่ระบบแนะนำการลงทุนหรือส่งคำสั่งซื้อขาย คำสั่ง `UPDATE` และ `CANDIDATE` ดาวน์โหลด snapshot XLSX ล่าสุดจาก `SET_DATA_URL` แล้วตรวจ/แสดง signals ที่มีในชีต โดยไม่คำนวณ OHLCV; สามารถเปิดใช้ Settrade read-only market data สำหรับ Liquidity ได้ตาม credentials ที่กำหนด

ยังไม่มีการดึง OHLCV จาก API ตลาดหรือคำสั่งซื้อขาย; Settrade (ถ้าตั้งค่า) ใช้เฉพาะ public market-data feeds ไม่เรียก API บัญชีหรือคำสั่ง

## การตั้งค่า

สร้าง `.env` จาก `.env.example` แล้วกำหนด URL ของ Google Sheets และชื่อแท็บ:

```dotenv
SET_DATA_URL=https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit
SET_DATA_SHEET=All-SET-MTFS
```

เก็บ `.env` ไว้ในเครื่องเท่านั้น ไฟล์ XLSX ที่ดาวน์โหลดถูกเก็บใน `downloads/` และไม่ถูกเพิ่มใน Git การดาวน์โหลดต้องใช้ชีตที่อ่านได้โดยไม่ลงชื่อเข้าใช้; อย่าเปิดเผย workbook ที่มีข้อมูลส่วนตัว ใช้สำเนาที่ไม่มีข้อมูลส่วนตัว ดูวิธีใช้ที่ [คู่มือคำสั่ง](./GOOGLE-SHEETS-SETUP.md)

การดึง Liquidity จาก Settrade เป็นตัวเลือกเสริม ให้กำหนด `SETTRADE_APP_ID`, `SETTRADE_APP_SECRET`, `SETTRADE_BROKER_ID` และ `SETTRADE_APP_CODE` ใน `.env` โดยใช้ App credentials ที่ได้รับอนุญาตเท่านั้น ห้ามบันทึก PIN หรือเลขบัญชี ระบบไม่เรียก endpoint ของ account, portfolio, order หรือ trade หากไม่มี credentials หรือ feed ใช้งานไม่ได้ ช่อง Liquidity จะแสดง `⚫ N/A` และรายงานสาเหตุ

## รูปแบบข้อมูล

แท็บ `All-SET-MTFS` ต้องมี `AKA`, `GROUP`, `PRICE`, `ACTION`, TREND/RSI และ Relative Strength ของ W/D/4H/1H, `MACD_HIST_DELTA(W)` และคอลัมน์สำหรับ Candidate ตาม [คู่มือคำสั่ง](./GOOGLE-SHEETS-SETUP.md) ใช้ `GROUP` จากชีตแทน `TIER` และไม่ตีความ/แปลงค่าของ `GROUP` เอง

## ตรวจ signals ที่มีอยู่

คำสั่ง `UPDATE` ดึง workbook ใหม่ทุกครั้งและเก็บ snapshot ไว้ที่ `downloads/All-SET-MTFS.xlsx`:

```bash
./update.sh
./update.sh UPDATE/PTT-AOT-CPALL
```

โปรแกรมตรวจ:

- พบแท็บและคอลัมน์ที่จำเป็น
- `AKA` มีรูปแบบที่ยอมรับได้และไม่ซ้ำกัน
- `GROUP`, trend และ relative-strength fields ไม่ว่าง
- `PRICE` เป็นตัวเลขที่มากกว่า 0; ค่า RSI เป็นตัวเลขระหว่าง 0 ถึง 100; ค่า MACD delta เป็นตัวเลข finite

เมื่อผ่านการตรวจ ตัวตรวจจะแสดงตารางหุ้นตาม `GROUP`, ราคา, TREND/RSI, ACTION และลิงก์ Finnomena หากมีข้อผิดพลาดจะรายงานตำแหน่งแถวและหยุด

## UPDATE และ CANDIDATE

- `UPDATE` ใช้ `./update.sh`; `UPDATE/<AKA>-<AKA>-...` ส่งเป็น argument เช่น `./update.sh UPDATE/PTT-AOT-CPALL`
- ทุกครั้งจะดาวน์โหลด XLSX จาก `SET_DATA_URL` แล้วอ่านเฉพาะ workbook snapshot
- `CANDIDATE` ใช้ `./candidate.sh`; เลือกหุ้นที่ผ่านครบทุกเงื่อนไข:
  1. `TREND(W) = UP`
  2. `TREND(D) = UP`
  3. `RSI(W) > 50`
  4. `MACD_HIST_DELTA(W) > 0`
  5. `RSI(D) < 70`
  6. `EMA9(W) > EMA21(W)`
  7. `SIGNAL_VOLUME` เป็น `BUY` อย่างน้อยหนึ่ง timeframe ใน W/D/4H/1H
- ทั้งสองคำสั่งแสดงผลใน Terminal ไม่แก้ workbook ต้นทาง ไม่คำนวณ signals ใหม่ และไม่ส่งคำสั่งซื้อขาย

### รูปแบบรายงาน

- `UPDATE` แสดงกลุ่ม `🟢 BUY CONFIRMED`, `🟡 EARLY/WATCH`, `🟠 PULLBACK ZONE`, `🔴 OVEREXTENDED` และ `⚪ WAIT/RETEST` ตาม signals ใน snapshot; `EARLY/WATCH` เรียงตาม `MACD_HIST_DELTA(W)` มากไปน้อย และ `PULLBACK ZONE` เรียงตาม Combined Score มากไปน้อย
- ตารางใช้ `GROUP` แทน `TIER`; หุ้นทุกแถวและรายชื่อ OVEREXTENDED เป็น Markdown link ไปยัง Finnomena ตามรูปแบบ `https://www.finnomena.com/stock/<AKA>/advance`
- `CANDIDATE` แสดงหัวข้อ `ผลการค้นหา CANDIDATE (PRE-ENTRY-Like Pattern) — n หุ้น` ตารางแสดงไม่เกิน 20 รายการ เรียง `MACD_HIST_DELTA(W)` มากไปน้อย และคงลำดับคอลัมน์ `# | หุ้น | GROUP | ราคา (THB) | MACD Δ(W) | Entry Zone (4H) | 1H Trigger | Liquidity`
- เมื่อมี Settrade credentials ระบบสมัคร feed read-only สำหรับมูลค่าซื้อขายสะสมวันนี้ (`InfoV3.total_value`) และ bid/ask 10 ระดับ (`BidOfferV3`); แสดง turnover, ราคา bid/ask ระดับแรก, spread และผลรวมปริมาณ bid/ask 10 ระดับเป็นตัวเลขดิบเท่านั้น ไม่จัดระดับ HIGH/MEDIUM/LOW
- หากไม่มี credentials, feed ไม่ตอบกลับ หรือข้อมูลบางส่วนไม่ครบ ระบบแสดง `⚫ N/A` เฉพาะค่าที่ไม่มีและเตือนสาเหตุ; ไม่ใช้ snapshot หรือ cache เก่ามาแทน
- `UPDATE/<AKA>-<AKA>-...` แสดงเฉพาะหุ้นที่ระบุในรายงานแบบจัดกลุ่มเดียวกัน; AKA ที่ไม่พบต้องแจ้งแยกและไม่แทนด้วยข้อมูลเก่า

### แหล่งข้อมูล Liquidity

แหล่งข้อมูลที่พิจารณาได้คือบริการข้อมูลตลาดจาก SET ที่ได้รับอนุญาต, ผู้ให้บริการข้อมูลตลาดหรือ API ของโบรกเกอร์ที่รองรับหลักทรัพย์ SET, หรือคอลัมน์ Liquidity ใน Reference Sheet ที่มีที่มาและเวลาอ้างอิงชัดเจน ควรเลือกแหล่งที่เปิดเผยสิทธิ์การใช้งานและมีฟิลด์เพียงพอกับสูตรที่กำหนด เช่น มูลค่าซื้อขายย้อนหลังและ bid/ask พร้อมปริมาณ หากข้อมูลมี

ยังไม่มีการกำหนด threshold การจัดระดับ จึงห้ามจัดประเภท Liquidity; ห้ามอนุมานจาก `SIGNAL_VOLUME` หรือแสดงว่าเป็นผลตรวจจริงจนกว่าจะได้ข้อมูลจากแหล่งที่เลือกและตรวจยืนยันได้

ข้อมูล turnover เป็นมูลค่าซื้อขายสะสมของวันปัจจุบัน ไม่ใช่ค่าเฉลี่ยย้อนหลัง; order-book depth เป็นผลรวมปริมาณจากสิบระดับของ feed ณ เวลาที่ได้รับ ส่วน spread คำนวณจาก ask/bid ระดับแรก และอาจไม่มีค่าระหว่าง auction หรือเมื่อราคาเสนอซื้อ/ขายเป็นศูนย์

Settrade ระบุว่า Sandbox จำกัดการเข้าถึงจาก IP ในประเทศไทยตั้งแต่ 16 กันยายน 2026; สภาพแวดล้อมที่อยู่นอกประเทศอาจเชื่อมต่อ Sandbox ไม่ได้

## ข้อมูลสำคัญ

หลังได้รับคำสั่ง `START @README.md` ให้ยึดรูปแบบคำสั่งในเอกสารนี้อย่างเคร่งครัด: `UPDATE` ใช้ `./update.sh`, `UPDATE/<AKA>-<AKA>-...` ใช้ `./update.sh UPDATE/<AKA>-<AKA>-...` และ `CANDIDATE` ใช้ `./candidate.sh` ห้ามเปลี่ยนรูปแบบคำสั่งหรือแทนที่ด้วยวิธีอื่นโดยพลการ รายงานผลต้องรักษาลำดับข้อมูล รูปแบบตาราง ลิงก์ และข้อความเตือนตามที่กำหนดไว้ ห้ามคาดเดาผลลัพธ์หรืออ้างว่าดาวน์โหลด ตรวจสอบ หรือทำงานสำเร็จ หากไม่มีผลการทำงานและข้อมูลยืนยันจริง; เมื่อเกิดข้อผิดพลาดให้รายงานตามที่พบโดยไม่แสดงผลสำเร็จแทน

## ข้อจำกัดที่ยังไม่ได้ยืนยัน

ข้อมูล/โค้ดปัจจุบันยังไม่ยืนยันสิ่งต่อไปนี้ จึงห้ามอ้างว่าระบบได้ตรวจหรือจัดการแล้ว:

- แหล่งที่มา/สิทธิ์ใช้งานและความสดของ indicators ใน workbook
- timestamp/timezone และวิธีคำนวณ timeframe ให้ตรง session ตลาด SET
- การปรับ indicators สำหรับ corporate actions และ symbol changes
- benchmark และความหมายของ `RELATIVE_STRENGTH`
- ปฏิทินและ session ซื้อขายของ SET รวมถึงวันหยุดหรือการหยุดซื้อขาย
- corporate actions, การเปลี่ยน ticker และการปรับข้อมูลย้อนหลัง
- tick size, board lot, trading unit และข้อจำกัดของหลักทรัพย์แต่ละประเภท
- การคำนวณ MPTM จาก OHLCV, การจัดสถานะ/คำแนะนำ และการเชื่อมต่อโบรกเกอร์

การแสดงค่าจากชีตไม่ได้รับรองความถูกต้อง ความครบถ้วน หรือความทันเวลาของข้อมูล และไม่ใช่คำแนะนำซื้อขาย

## ขอบเขตความปลอดภัย

- `UPDATE`/`CANDIDATE` อ่าน snapshot จาก Google Sheets เท่านั้น; ไม่มีการเชื่อมต่อโบรกเกอร์หรือคำสั่งซื้อขาย
- ก่อนพัฒนาการวิเคราะห์หรือซื้อขายจริง ต้องยืนยันแหล่งข้อมูล/สิทธิ์ใช้งาน freshness, benchmark, ปฏิทินตลาด, corporate actions และกฎหลักทรัพย์ พร้อมทดสอบกับข้อมูลที่ตรวจสอบย้อนกลับได้

## ทดสอบ

รันทดสอบ unit tests ของตัวตรวจ:

```bash
python3 -m unittest -v test_set_update.py
```
