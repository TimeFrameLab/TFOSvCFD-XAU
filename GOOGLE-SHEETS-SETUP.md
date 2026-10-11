# คู่มือสร้าง Google Sheet และ Apps Script สำหรับใช้งานเอง

เอกสารนี้อธิบายการเตรียมชีตข้อมูลเหรียญและการตั้งค่า URL สำหรับ `REF_SHEET_URL` ใน TFOSvX รวมถึง Apps Script ต้นแบบสำหรับนำไปปรับใช้

> **ข้อควรระวังด้านความเป็นส่วนตัว:** `update.sh` ดาวน์โหลด Google Sheet ผ่าน XLSX export โดยไม่เข้าสู่ระบบ Google ชีตที่ใช้เป็น `REF_SHEET_URL` จึงต้องเปิดให้ผู้มีลิงก์ดูได้ อย่าเปิดชีตที่มีข้อมูลส่วนตัว เช่น `COST`, `QUANTITY`, `PROFIT` หรือ `NET` ให้สาธารณะ ให้แยกชีต REF สำหรับเผยแพร่ ซึ่งมีเฉพาะข้อมูลตลาดและคอลัมน์ที่จำเป็นต่อรายงาน

## สิ่งที่ต้องเตรียม

- บัญชี Google สำหรับสร้าง Spreadsheet และ Apps Script
- ชื่อแท็บข้อมูล `All-Bitkub-BATCH`
- รายการหัวคอลัมน์ตามสคีมาด้านล่าง
- [Apps Script ต้นแบบ](./examples/All-Bitkub-BATCH-starter.gs) สำหรับเตรียมชีต
- [สคริปต์ MTFS ฉบับเต็ม](./examples/All-Bitkub-MTFS.gs) สำหรับดึงข้อมูลและอัปเดตอัตโนมัติ
- URL ของชีต REF ที่เปิดสิทธิ์ Viewer ด้วยลิงก์

## ขั้นตอนสร้างชีต

1. สร้าง Google Spreadsheet สำหรับงานของคุณ ตั้งชื่อไฟล์ได้ตามต้องการ เช่น `🐋 All-Bitkub`
2. เปลี่ยนชื่อแท็บแรกเป็น `All-Bitkub-BATCH` ให้ตรงตามตัวพิมพ์และเครื่องหมาย
3. ในชีตส่วนตัว ให้คงสิทธิ์การแชร์แบบ Restricted ตามปกติ แล้วเปิด **Extensions → Apps Script**
4. นำโค้ดจาก `examples/All-Bitkub-BATCH-starter.gs` ไปวางในโปรเจกต์ Apps Script แล้วบันทึก
5. เลือกฟังก์ชัน `setupAllBitkubBatchSheet` จากตัวเลือกฟังก์ชัน แล้วกด **Run** และอนุญาตสิทธิ์เมื่อ Google แสดงคำขอ
   - ฟังก์ชันนี้สร้างหัวตารางเมื่อชีตยังว่างเท่านั้น
   - หากชีตมีข้อมูลอยู่แล้ว ฟังก์ชันจะไม่เขียนทับ แต่จะแจ้งข้อผิดพลาดให้ตรวจสอบแท็บและหัวตาราง
6. เพิ่มแถวข้อมูลเหรียญ โดยกรอกสัญลักษณ์ใน `AKA` ให้ตรงกับสินทรัพย์ที่ต้องการอัปเดต
7. หากต้องการตัวช่วยเขียนค่าจำลอง/ข้อมูลจากโค้ดของคุณ ให้ใช้ `writeAllBitkubAnalysisUpdates()` ใน starter; หากต้องการดึงข้อมูลและคำนวณ MTFS จริง ให้เพิ่มโค้ดจาก `examples/All-Bitkub-MTFS.gs` เป็นไฟล์ `.gs` อีกไฟล์ใน Apps Script โปรเจกต์เดียวกัน
8. ทดสอบการอัปเดตด้วยตนเองก่อน จากนั้นจึงตั้ง Trigger ตามหัวข้อถัดไป และตรวจผลในสำเนาชีตก่อนใช้งานจริง

## อัปเดตข้อมูล MTFS และตั้ง Trigger ทุก 1 ชั่วโมง

สคริปต์ [All-Bitkub-MTFS.gs](./examples/All-Bitkub-MTFS.gs) เป็นตัวอย่างฉบับเต็มจาก Apps Script ที่ผู้ใช้จัดเตรียมไว้ โดยปรับชื่อแท็บเป็น `All-Bitkub-BATCH` และนำ Telegram credentials ออกจาก source code แล้ว สคริปต์ดึงข้อมูลสาธารณะจาก Bitkub `/tradingview/history` สำหรับทุกเหรียญที่มี `AKA` แล้วคำนวณ `W`, `D`, `4H` และ `1H` ก่อนอัปเดตคอลัมน์สัญญาณ ราคา และเวลาที่เกี่ยวข้อง

### วิธีเปิดใช้

1. ใช้แท็บส่วนตัว `All-Bitkub-BATCH` ที่มีหัวตารางครบตามสคีมาและกรอกรายชื่อใน `AKA`; ห้ามใช้แท็บ REF ที่แชร์สาธารณะสำหรับรันสคริปต์นี้
2. ในโปรเจกต์ Apps Script เดียวกับ starter ให้เพิ่มไฟล์ `.gs` แล้ววางเนื้อหาจาก `examples/All-Bitkub-MTFS.gs`
3. เลือก `updateAllBitkub` แล้วกด **Run** เพื่อทดสอบการดึงและเขียนข้อมูลครั้งแรก อนุญาตสิทธิ์ที่ Google ขอ
4. ตรวจคอลัมน์สัญญาณ `ACTION(1H)`, `UPDATED`, `LAST_CANDLE` และหน้า **Apps Script → Executions** ว่าการทำงานสำเร็จ
5. เมื่อทดสอบผ่านแล้ว เลือก `createHourlyTrigger` แล้วกด **Run** เพื่อสร้าง Trigger หลักที่อัปเดตทุก 1 ชั่วโมง
6. ตรวจหน้า **Apps Script → Triggers** ให้มี Trigger หลัก `updateAllBitkub` เพียงรายการเดียว; ตรวจ **Executions** เป็นระยะเพื่อดูข้อผิดพลาด

การดึงข้อมูลครอบคลุมทุกเหรียญในชีต ไม่ใช่เฉพาะแถวที่เลือก สคริปต์แบ่งงานเป็น batch และใช้ continuation/safety trigger ภายในเมื่อข้อมูลมีจำนวนมาก; trigger ทำต่อเหล่านี้เป็นกลไกให้รอบอัปเดตชุดเดิมเสร็จ ไม่ใช่ Trigger หลักที่ตั้งให้รันถี่กว่า 1 ชั่วโมง

Trigger ของ Apps Script อาจเริ่มใกล้เวลาที่ตั้ง ไม่รับประกันนาทีแน่นอน ตัวอย่างนี้ตั้งให้ทำงานประมาณนาทีที่ 2 หลังเปลี่ยนชั่วโมง และมีการกรองแท่งที่ยังไม่ปิดเพื่อให้ค่า `1H` ใช้แท่งที่ปิดแล้ว ควรตรวจ `LAST_CANDLE` เพื่อยืนยันเวลาของแท่งที่ใช้คำนวณ

สคริปต์อาจอัปเดตข้อมูลวิเคราะห์และคอลัมน์ราคาหรือ P/L ในชีต จึงควรรันกับไฟล์ส่วนตัวเท่านั้น ไม่ใช่ชีตสาธารณะ และไม่ส่งคำสั่งซื้อขายอัตโนมัติ

## สคีมาคอลัมน์

ใช้ชื่อคอลัมน์ตามลำดับต่อไปนี้ เพื่อให้ตรงกับข้อมูลที่ TFOSvX คาดหวัง หัวคอลัมน์ที่ซ้ำ เช่น `ENTRY_ZONE(4H)` และ `ENTRY_TRIGGER(1H)` มีซ้ำสองตำแหน่งโดยตั้งใจ:

```text
FLAG	TIER	IMAGE	TV	IMAGEurl	CDN	PNG	AKA	TREND(W)	RSI(W)	MACD_HIST(W)	MACD_HIST_PREV(W)	MACD_HIST_DELTA(W)	MACD(W)	MACD_SIGNAL(W)	EMA9(W)	EMA21(W)	EMA_GAP(W)	SIGNAL_RSI(W)	SIGNAL_MACD(W)	SIGNAL_EMA9X21(W)	SIGNAL_VOLUME(W)	PRICE_STRUCTURE(W)	RELATIVE_STRENGTH(W)	ACTION(W)	RSI(D)	MACD_HIST(D)	MACD_HIST_PREV(D)	MACD(D)	MACD_SIGNAL(D)	EMA9(D)	EMA21(D)	EMA_GAP(D)	SIGNAL_RSI(D)	SIGNAL_MACD(D)	SIGNAL_EMA9X21(D)	SIGNAL_VOLUME(D)	PRICE_STRUCTURE(D)	RELATIVE_STRENGTH(D)	ACTION(D)	TREND(4H)	RSI(4H)	MACD_HIST(4H)	MACD_HIST_PREV(4H)	MACD_HIST_DELTA(4H)	MACD(4H)	MACD_SIGNAL(4H)	EMA9(4H)	EMA21(4H)	EMA_GAP(4H)	SIGNAL_RSI(4H)	SIGNAL_MACD(4H)	SIGNAL_EMA9X21(4H)	SIGNAL_VOLUME(4H)	PRICE_STRUCTURE(4H)	RELATIVE_STRENGTH(4H)	ENTRY_ZONE(4H)	ACTION(4H)	TREND(1H)	RSI(1H)	MACD_HIST(1H)	MACD_HIST_PREV(1H)	MACD_HIST_DELTA(1H)	MACD(1H)	MACD_SIGNAL(1H)	EMA9(1H)	EMA21(1H)	EMA_GAP(1H)	SIGNAL_RSI(1H)	SIGNAL_MACD(1H)	SIGNAL_EMA9X21(1H)	SIGNAL_VOLUME(1H)	PRICE_STRUCTURE(1H)	RELATIVE_STRENGTH(1H)	ENTRY_TRIGGER(1H)	ACTION(1H)	BIAS(W)	SETUP(D)	ENTRY_ZONE(4H)	ENTRY_TRIGGER(1H)	ACTION	COST	QUANTITY	PRICE	PROFIT	NET	URL	LAST_CANDLE	UPDATED	Source
```

อย่าลบหรือสลับตำแหน่งคอลัมน์โดยไม่ตรวจสอบโค้ดที่อ่านชีต เพราะบางสคริปต์อ้างอิงหัวคอลัมน์ที่ซ้ำตามลำดับการปรากฏ

## สร้างชีต REF สำหรับ `update.sh`

1. สร้าง Spreadsheet แยกอีกไฟล์สำหรับเผยแพร่ โดยสร้างแท็บชื่อ `All-Bitkub-BATCH`
2. คัดลอกเฉพาะแถวหัวตารางและข้อมูลตลาดที่จำเป็นจากชีตส่วนตัว โดยอย่างน้อยควรมี `AKA`, `TIER`, `TREND(W)`, `TREND(D)`, `TREND(4H)`, `TREND(1H)`, `RSI(W)`, `RSI(D)`, `RSI(1H)`, `MACD_HIST(W)`, `MACD_HIST_DELTA(W)`, `EMA9(W)`, `EMA21(W)`, `PRICE_STRUCTURE(W)`, `ENTRY_ZONE(4H)`, `ENTRY_TRIGGER(1H)` และ `ACTION(1H)` เพื่อให้รายงานจัดกลุ่มได้ครบ
3. **ไม่คัดลอกข้อมูลส่วนตัวหรือข้อมูลพอร์ต** โดยเฉพาะ `COST`, `QUANTITY`, `PROFIT` และ `NET` รวมถึงสูตร/ลิงก์ที่เปิดเผยข้อมูลดังกล่าว หากคอลัมน์เหล่านี้ไม่จำเป็นต่อรายงาน ให้ตัดออกจากชีต REF ได้
4. แชร์เฉพาะชีต REF โดยตั้งค่า **General access → Anyone with the link → Viewer**
5. ทดสอบเปิด URL ในหน้าต่างส่วนตัว/ไม่ลงชื่อเข้าใช้ แล้วตรวจว่าเปิดและดาวน์โหลดข้อมูลได้
6. ใช้ URL ของ Spreadsheet นี้เป็น `REF_SHEET_URL` ใน `.env` ของเครื่องที่รัน TFOSvX:

```bash
REF_SHEET_URL=https://docs.google.com/spreadsheets/d/YOUR_PUBLIC_REF_SHEET_ID/edit
```

ห้ามใส่ URL ของชีตส่วนตัวลงในที่สาธารณะหรือ commit ค่าใน `.env` ขึ้น Git

## การตั้งค่า Telegram สำหรับผู้ที่ต้องการใช้

ทั้ง starter และสคริปต์ MTFS ไม่มี Telegram token หรือ Chat ID ฝังอยู่ในโค้ด Starter มี `sendTelegramMessage(text)` / `testTelegramMessage()` เป็นตัวช่วยส่งและทดสอบ ส่วน MTFS จะส่งแจ้งเตือนเมื่อสถานะ `ACTION` เปลี่ยนเป็น BUY เมื่อผู้ใช้ตั้งค่า credentials ใน Script Properties และเปิดใช้สคริปต์ MTFS

### ขอ Bot Token และหา Chat ID

1. เปิด Telegram แล้วค้นหา `@BotFather` ซึ่งเป็นบัญชีทางการสำหรับจัดการบอต
2. ส่งคำสั่ง `/newbot` แล้วทำตามขั้นตอนเพื่อกำหนดชื่อและ username ให้บอต
3. BotFather จะแสดง bot token สำหรับบอตใหม่ ให้เก็บเป็นความลับ ห้ามส่งในแชทสาธารณะหรือใส่ในไฟล์ `.gs`
4. เปิดแชตกับบอตที่สร้าง แล้วกด **Start** หรือส่ง `/start`
5. หา Chat ID ของแชตโดยใช้ Telegram Bot API `getUpdates` หลังส่งข้อความให้บอต แล้วอ่านค่า `message.chat.id` จากผลตอบกลับ หากเป็นกลุ่ม ให้เพิ่มบอตเข้ากลุ่มและส่งข้อความในกลุ่มก่อน; group chat ID มักเป็นเลขติดลบ
   - ทำขั้นตอนนี้ในสภาพแวดล้อมส่วนตัวเท่านั้น URL ของ Bot API มี token อยู่ใน URL ห้ามแชร์ URL หรือผลตอบกลับที่มีข้อมูลส่วนตัว
6. ใน Apps Script เปิด **Project Settings → Script Properties → Add script property** แล้วเพิ่ม:

| Property | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | token ที่ได้จาก BotFather |
| `TELEGRAM_CHAT_ID` | Chat ID ที่ต้องการให้บอตส่งข้อความไป |

7. กลับหน้า Editor เลือก `testTelegramMessage` (starter) หรือ `testMtfsTelegramMessage` (MTFS) แล้วกด **Run** อนุญาตสิทธิ์ UrlFetch เมื่อระบบร้องขอ จากนั้นตรวจข้อความในแชตและผลการทำงานที่ **Executions**

ตัวอย่างเรียกจากโค้ดของคุณ:

```javascript
sendTelegramMessage("ข้อความทดสอบ");
```

โค้ดจะอ่านค่าจาก Script Properties ไม่มี token หรือ Chat ID ฝังอยู่ในไฟล์ หาก MTFS ยังไม่ได้ตั้งค่า Telegram การดึงและอัปเดตชีตยังทำงานได้ แต่จะไม่มีการส่งข้อความ

> **หาก token เคยถูกวางในโค้ด แชร์ หรือส่งในแชทแล้ว ให้ถือว่ารั่วไหล:** ใช้ `@BotFather` เพิกถอน/สร้าง token ใหม่ทันที แล้วแทนค่า `TELEGRAM_BOT_TOKEN` ใน Script Properties อย่าใช้ token เดิมต่อ และตรวจว่าไม่มี token อยู่ใน commit หรือไฟล์ที่เผยแพร่

จำกัดสิทธิ์ผู้แก้ไขโปรเจกต์ Apps Script เพราะผู้แก้ไขอาจเปลี่ยนโค้ดเพื่ออ่าน Script Properties ได้ อย่าแชร์ token, Chat ID ที่เป็นข้อมูลส่วนตัว, `.env` หรือสำเนาชีตที่มีข้อมูลพอร์ต

## ขอบเขตของไฟล์ต้นแบบ

ไฟล์ `All-Bitkub-BATCH-starter.gs` เป็นตัวช่วยสร้างแท็บ/หัวคอลัมน์ เขียนค่าฟิลด์วิเคราะห์ให้กับเหรียญที่มีอยู่แล้ว และส่ง/ทดสอบ Telegram ส่วน `All-Bitkub-MTFS.gs` เป็นตัวอย่างฉบับเต็มสำหรับดึงข้อมูล Bitkub คำนวณ MTFS อัปเดตทุก 1 ชั่วโมง ต่อ batch เมื่อจำเป็น และส่ง Telegram เมื่อสถานะ BUY เปลี่ยน

ตัวช่วยเขียนข้อมูลใน starter คาดหวังแท็บส่วนตัวที่มีหัวคอลัมน์ครบทั้ง 90 ช่องตามสคีมาด้านบน ส่วน MTFS ก็ต้องมีชื่อคอลัมน์ที่สอดคล้องกับสคีมา อย่าใช้สคริปต์อัปเดตกับชีต REF ที่ตัดคอลัมน์ออกหรือแชร์สาธารณะ

Starter ตั้งใจ **ไม่** รวมสูตรคำนวณ MTFS, การดึงประวัติราคา, หรือการตั้ง Trigger; ให้ใช้ไฟล์ MTFS ฉบับเต็มเมื่อยอมรับเกณฑ์และพฤติกรรมตัวอย่างในสคริปต์แล้ว ทั้งสองไฟล์เป็นตัวอย่างให้ตรวจสอบและปรับใช้ ต้องทดสอบกับสำเนาชีตก่อนใช้งานจริง

ตัวช่วยเขียนข้อมูลไม่อนุญาตให้อัปเดต `AKA`, `COST`, `QUANTITY`, `PROFIT` หรือ `NET` และไม่เพิ่มแถวเหรียญใหม่โดยอัตโนมัติ หากพบชื่อหัวคอลัมน์ซ้ำ ให้ระบุตำแหน่งด้วยรูปแบบ `ชื่อหัวคอลัมน์#ลำดับ` เช่น `ENTRY_ZONE(4H)#2`

ตัวอย่างการเรียกจากฟังก์ชันอัปเดตที่คุณเขียนเพิ่มเติม:

```javascript
writeAllBitkubAnalysisUpdates([{
  symbol: "L3",
  values: {
    "RSI(1H)": 54.2,
    "ENTRY_ZONE(4H)#2": "ตัวอย่างข้อมูล"
  }
}]);
```

## วิธีตรวจสอบก่อนใช้งานจริง

- ทดลองกับสำเนาชีตและข้อมูลจำลองก่อน
- ตรวจว่าชื่อแท็บเป็น `All-Bitkub-BATCH` และหัวคอลัมน์สะกดตรงกับสคีมา
- ยืนยันว่าข้อมูลส่วนตัวไม่อยู่ในชีต REF ที่แชร์ด้วยลิงก์
- ตรวจว่าตั้ง Trigger หลักเพียง `updateAllBitkub` ทุก 1 ชั่วโมง และเข้าใจว่า continuation trigger ภายในใช้ทำงาน batch ที่ค้างให้เสร็จ
- ตรวจประวัติการทำงานใน Apps Script **Executions** เมื่อมีข้อผิดพลาด
- หลังตั้งค่า `REF_SHEET_URL` ให้รัน `./update.sh` แล้วตรวจผลลัพธ์ก่อนใช้งานต่อ
