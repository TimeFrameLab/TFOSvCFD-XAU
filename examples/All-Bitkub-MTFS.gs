// ====================================================
// 🟢 All-Bitkub-MTFS.gs  — MTFS (Multi-Timeframe Trend & Structure Signal Engine)
// ชีต "All-Bitkub-BATCH" — W → D → 4H → 1H  (Direction → Setup → Entry Zone → Entry Trigger → Action)
// แหล่งข้อมูล: Bitkub official API GET /tradingview/history
//   - resolution=1D  ย้อนหลัง HISTORY_DAYS_1D วัน  → resample เป็น WEEKLY และใช้ตรงเป็น DAILY
//   - resolution=60  ย้อนหลัง HISTORY_DAYS_1H วัน  → resample เป็น 4H     และใช้ตรงเป็น 1H
//
// 🧭 โครงสร้างต่อ Timeframe (ทุก TF มี "ACTION(TF)" = สรุป 3 สถานะของ TF นั้น เพื่อ debug ง่าย):
//   W  ├─ Indicators/Signal/PRICE_STRUCTURE(W)/RELATIVE_STRENGTH(W)  └─ ACTION(W)  = 🟢BULLISH/🟡NEUTRAL/🔴BEARISH
//   D  ├─ Indicators/Signal/PRICE_STRUCTURE(D)/RELATIVE_STRENGTH(D)  └─ ACTION(D)  = 🟢READY/🟡WATCH/🔴WEAK
//   4H ├─ ...RELATIVE_STRENGTH(4H) → ENTRY_ZONE(4H)(ละเอียด)         └─ ACTION(4H) = 🟢ZONE/🟡WAIT/🔴INVALID
//   1H ├─ ...RELATIVE_STRENGTH(1H) → ENTRY_TRIGGER(1H)(ละเอียด)      └─ ACTION(1H) = 🟢TRIGGER/🟡WAIT/🔴FAILED
//
//   Summary (ท้ายตาราง):  BIAS(W)  SETUP(D)  ENTRY_ZONE(4H)*  ENTRY_TRIGGER(1H)*  ACTION(Final)
//   *ENTRY_ZONE(4H) และ ENTRY_TRIGGER(1H) ปรากฏ "ซ้ำ 2 ที่" ในชีต (ในบล็อก TF เอง + ใน Summary)
//    สคริปต์จะใส่ "ค่าเดียวกัน" ทั้ง 2 คอลัมน์ (แสดงซ้ำเพื่อสแกนง่าย ไม่ใช่คำนวณคนละสูตร)
//
//   ACTION (Final) = ผลรวมของ BIAS(W)+SETUP(D)+ENTRY_ZONE(4H)+ENTRY_TRIGGER(1H)
//     🟢 BUY  | 🟡 WAIT | 🔴 EXIT | ว่าง = ไม่เข้าเงื่อนไข
//
// ⚠️ Threshold ต่างกันตาม TF (RSI/EMA_GAP/RS) — ปรับได้ที่ TF_CONFIG
// ⚠️ SIGNAL_VOLUME / RELATIVE_STRENGTH ไม่มีผลต่อ ACTION โดยตรง (คอลัมน์เสริม)
// ⚠️ บล็อก D ไม่มี TREND(D) และ MACD_HIST_DELTA(D) ตามชีตจริงของผู้ใช้ (ต่างจาก W/4H/1H)
// ⚠️ Bitkub มีแต่คู่เทียบ THB → PRICE เป็นบาท / เหรียญไม่มีคู่ THB จะขึ้น "NO PAIR"
// ⚠️ COST / QUANTITY = ผู้ใช้กรอกเอง สคริปต์ไม่เขียนทับ (เปลี่ยนแค่สีของ COST)
//
// คอลัมน์เวลาในสคีมาชีต:
//   UPDATED     = เวลาที่สคริปต์เขียนข้อมูลแถวนั้น (เวลาไทย)
//   LAST_CANDLE = เวลาปิดของแท่ง 1H ล่าสุดที่ใช้คำนวณ (ถ้าไม่มีข้อมูล 1H ใช้แท่ง Daily)
//   แถว NO PAIR / error / ไม่มีข้อมูล จะเว้นว่างทั้งสองคอลัมน์
//
// 🔧 การป้องกัน Timeout (ดูรายละเอียดที่ _runRange ด้านล่าง):
//   ปัญหาเดิม: continueUpdate trigger ถูกสร้าง "หลังจาก" ประมวลผลแต่ละ batch (chunk ของ BATCH_SIZE
//   เหรียญ) เสร็จเรียบร้อยเท่านั้น ถ้า chunk ใด chunk หนึ่งใช้เวลานานผิดปกติ (Bitkub API ช้า/rate-limit/
//   ต้อง retry หลายครั้ง) จนรวมเวลาทั้ง execution เกินขีดจำกัดจริงของ Apps Script (~6 นาที) Google จะ
//   "Exceeded maximum execution time" ฆ่าสคริปต์ทิ้งกลางทาง โดยที่โค้ดส่วนสร้าง trigger ทำต่อ (ท้ายลูป)
//   ไม่ได้รันเลย → ไม่มี trigger ไหนมาปลุกให้ทำงานต่อ → ค้างสนิท (เหมือนบั๊กที่เคยพบใน ThaiMutualFunds.gs)
//   วิธีแก้: สร้าง "safety trigger" (SAFETY_TRIGGER_MIN นาที) + บันทึกตำแหน่งแถวที่กำลังจะเริ่ม
//   ไว้ "ก่อน" ประมวลผลแต่ละ chunk เสมอ ถ้า chunk นั้นจบปกติ จะลบ safety trigger แล้วตั้ง trigger
//   ปกติ (1 นาที) แทน แต่ถ้า chunk นั้น timeout กลางทางจริง safety trigger ที่ตั้งไว้ล่วงหน้าจะยังอยู่
//   และมาปลุกให้ทำงานต่อเองภายใน SAFETY_TRIGGER_MIN นาที โดยไม่ต้องรอให้คนมาสั่งรันเอง
//
// วิธีใช้: เปิดชีต → เมนู "🟢 All-Bitkub" → ▶️ อัปเดตทั้งหมด → ตั้ง Trigger ทุก 1 ชั่วโมง
// ====================================================

const SHEET_NAME       = "All-Bitkub-BATCH";
const SYMBOL_HEADER    = "AKA";
const HEADER_SCAN_ROWS = 10;

const QUOTE_ASSET        = "THB";
const HISTORY_DAYS_1D    = 500;
const HISTORY_DAYS_1H    = 60;   // ถ้า 4H/1H ขึ้น WAIT(n) บ่อย ให้เพิ่มเป็น 90
const BATCH_SIZE         = 10;
const TIME_BUDGET_MS     = 300000;
const MAX_RETRIES        = 3;

// ✅ ระยะเวลา safety trigger (นาที) ที่ตั้งไว้ล่วงหน้าก่อนประมวลผลแต่ละ chunk เสมอ
//    ต้องนานพอสำหรับ chunk ที่ช้าที่สุด (เผื่อเหนือขีดจำกัดจริง ~6 นาทีของ Apps Script)
const SAFETY_TRIGGER_MIN = 7;

const TRIGGER_EVERY_HOURS   = 1;
const WEEK_OFFSET_HOURS     = 0;

const SELL_FEE_RATE = 0.0025;
const TRADINGVIEW_URL_PREFIX = "https://www.tradingview.com/chart/?symbol=";
const TRADINGVIEW_URL_SUFFIX = "THB";

// 🆕 รูปแบบ/เขตเวลาของคอลัมน์ UPDATED และ LAST_CANDLE
const TIME_ZONE   = "Asia/Bangkok";
const TIME_FORMAT = "dd/MM/yyyy HH:mm";

const SWING_LEFT  = 2;
const SWING_RIGHT = 2;
const STRUCT_MIN_SWINGS = 3;
const STRUCT_EQ_TOL = 0.005;

// true = ACTION BUY ต้องผ่านตัวกรอง ENTRY_ZONE(4H) ด้วย (รวมอยู่ใน calcActionMTF แล้วโดยธรรมชาติ)
const STRUCT_FILTER_BUY = true;

const PROP_NEXT_ROW = "BITKUB_NEXT_ROW";
const PROP_LAST_ROW = "BITKUB_LAST_ROW";

const WHITE = "#FFFFFF", BLACK = "#000000";
const BUY_BG = "#00B050", SELL_BG = "#C00000";

// ====================================================
// 🕒 Timeframes: resample daily/hourly ดิบ → ราคาต่อ TF
// ====================================================
const TIMEFRAMES = ["W", "D", "4H", "1H"];

const TF_RESAMPLE = {
  "W":  { source: "daily",  barSeconds: 7 * 86400, offsetSeconds: WEEK_OFFSET_HOURS * 3600 + 3 * 86400 },
  "D":  { source: "daily",  barSeconds: 86400,     offsetSeconds: 0 },
  "4H": { source: "hourly", barSeconds: 4 * 3600,  offsetSeconds: 0 },
  "1H": { source: "hourly", barSeconds: 3600,      offsetSeconds: 0 },
};

// "TF ที่ละเอียดกว่า" ใช้เช็กการหลุด Swing Low ของ TF นี้ (null = ใช้แท่งก่อนหน้าของตัวเอง)
const TF_FINER = { "W": "D", "D": "4H", "4H": "1H", "1H": null };

// ===== เกณฑ์ต่อ Timeframe — ปรับได้อิสระทีละ TF =====
const TF_CONFIG = {
  "W": {
    rsiPeriod: 14, trendMaPeriod: 4,
    emaFast: 9, emaSlow: 21, macdFast: 12, macdSlow: 26, macdSignal: 9,
    buyRsiThreshold: 35, sellRsiThreshold: 75,
    emaGapNearMax: 0.20, emaGapEarlyMax: 0.50, emaGapBullishMax: 1.50,
    volLookback: 4,  volBuyMult: 1.0, volSellMult: 0.8,
    rsLookback: 4,   rsTrendLookback: 3, rsBuyMin: 8,  rsSellMax: -8,
  },
  "D": {
    rsiPeriod: 14, trendMaPeriod: 5,
    emaFast: 9, emaSlow: 21, macdFast: 12, macdSlow: 26, macdSignal: 9,
    buyRsiThreshold: 38, sellRsiThreshold: 72,
    emaGapNearMax: 0.15, emaGapEarlyMax: 0.40, emaGapBullishMax: 1.20,
    volLookback: 7,  volBuyMult: 1.0, volSellMult: 0.8,
    rsLookback: 7,   rsTrendLookback: 3, rsBuyMin: 5,  rsSellMax: -5,
  },
  "4H": {
    rsiPeriod: 14, trendMaPeriod: 6,
    emaFast: 9, emaSlow: 21, macdFast: 12, macdSlow: 26, macdSignal: 9,
    buyRsiThreshold: 40, sellRsiThreshold: 70,
    emaGapNearMax: 0.10, emaGapEarlyMax: 0.25, emaGapBullishMax: 0.80,
    volLookback: 12, volBuyMult: 1.0, volSellMult: 0.8,
    rsLookback: 12,  rsTrendLookback: 6, rsBuyMin: 3,  rsSellMax: -3,
  },
  "1H": {
    rsiPeriod: 14, trendMaPeriod: 8,
    emaFast: 9, emaSlow: 21, macdFast: 12, macdSlow: 26, macdSignal: 9,
    buyRsiThreshold: 45, sellRsiThreshold: 65,
    emaGapNearMax: 0.05, emaGapEarlyMax: 0.15, emaGapBullishMax: 0.50,
    volLookback: 24, volBuyMult: 1.0, volSellMult: 0.8,
    rsLookback: 24,  rsTrendLookback: 12, rsBuyMin: 1.5, rsSellMax: -1.5,
  },
};

// ป้ายชื่อฟิลด์ → คำนำหน้าหัวตาราง
const FIELD_LABELS = {
  trend: "TREND", rsi: "RSI", hist: "MACD_HIST", histPrev: "MACD_HIST_PREV", histDelta: "MACD_HIST_DELTA",
  macd: "MACD", macdSig: "MACD_SIGNAL", ema9: "EMA9", ema21: "EMA21", emaGap: "EMA_GAP",
  sigRsi: "SIGNAL_RSI", sigMacd: "SIGNAL_MACD", sigEma: "SIGNAL_EMA9X21", sigVolume: "SIGNAL_VOLUME",
  structure: "PRICE_STRUCTURE", relStrength: "RELATIVE_STRENGTH", actionTF: "ACTION",
  entryZoneRaw: "ENTRY_ZONE", entryTriggerRaw: "ENTRY_TRIGGER",
};

// ชุดฟิลด์ต่อ TF — ตรงตามคอลัมน์จริงในชีต (D ไม่มี trend/histDelta ตามที่ผู้ใช้ระบุ)
const TF_BLOCK_FIELDS = {
  "W":  ["trend", "rsi", "hist", "histPrev", "histDelta", "macd", "macdSig", "ema9", "ema21", "emaGap",
         "sigRsi", "sigMacd", "sigEma", "sigVolume", "structure", "relStrength", "actionTF"],
  "D":  ["rsi", "hist", "histPrev", "macd", "macdSig", "ema9", "ema21", "emaGap",
         "sigRsi", "sigMacd", "sigEma", "sigVolume", "structure", "relStrength", "actionTF"],
  "4H": ["trend", "rsi", "hist", "histPrev", "histDelta", "macd", "macdSig", "ema9", "ema21", "emaGap",
         "sigRsi", "sigMacd", "sigEma", "sigVolume", "structure", "relStrength", "entryZoneRaw", "actionTF"],
  "1H": ["trend", "rsi", "hist", "histPrev", "histDelta", "macd", "macdSig", "ema9", "ema21", "emaGap",
         "sigRsi", "sigMacd", "sigEma", "sigVolume", "structure", "relStrength", "entryTriggerRaw", "actionTF"],
};

// สร้าง HEADER_DEFS อัตโนมัติ: key → { label, occurrence }
// occurrence ใช้แยกคอลัมน์ที่ "ชื่อซ้ำกัน" (ENTRY_ZONE(4H) / ENTRY_TRIGGER(1H) ปรากฏ 2 ที่ในชีต)
const HEADER_DEFS = {};
TIMEFRAMES.forEach(tf => {
  TF_BLOCK_FIELDS[tf].forEach(field => {
    HEADER_DEFS[field + "_" + tf] = { label: `${FIELD_LABELS[field]}(${tf})` };
  });
});
Object.assign(HEADER_DEFS, {
  biasW:          { label: "BIAS(W)" },
  setupD:         { label: "SETUP(D)" },
  entryZone4h:    { label: "ENTRY_ZONE(4H)",    occurrence: 1 }, // ตัวที่ 2 (ตัวแรกอยู่ในบล็อก 4H = entryZoneRaw_4H)
  entryTrigger1h: { label: "ENTRY_TRIGGER(1H)", occurrence: 1 }, // ตัวที่ 2 (ตัวแรกอยู่ในบล็อก 1H = entryTriggerRaw_1H)
  action:         { label: "ACTION" },
  cost:           { label: "COST" },
  quantity:       { label: "QUANTITY" },
  price:          { label: "PRICE" },
  profit:         { label: "PROFIT" },
  net:            { label: "NET" },
  url:            { label: "URL" },
  updated:        { label: "UPDATED" },      // 🆕 เวลาที่สคริปต์เขียนแถวนี้
  lastCandle:     { label: "LAST_CANDLE" },  // 🆕 เวลาปิดของแท่ง 1H ล่าสุดที่ใช้คำนวณ
});
const HEADER_ALIASES = { profit: ["PROFIT@PRICE"], net: ["NET@PRICE"] };

// คอลัมน์ที่ตั้งกฎสี BUY/SELL/WAIT/EXIT อัตโนมัติ
const BUYSELL_CF_KEYS = ["action"];
TIMEFRAMES.forEach(tf => {
  ["sigRsi", "sigMacd", "sigEma"].forEach(k => {
    if (TF_BLOCK_FIELDS[tf].indexOf(k) !== -1) BUYSELL_CF_KEYS.push(k + "_" + tf);
  });
});

// ====================================================
// 📋 เมนู
// ====================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🟢 All-Bitkub")
    .addItem("▶️ อัปเดตทั้งหมด", "updateAllBitkub")
    .addItem("🎯 อัปเดตเฉพาะแถวที่เลือก", "updateSelectedRows")
    .addItem("⏯️ ทำต่อ (ถ้ารันค้างไว้)", "continueUpdate")
    .addSeparator()
    .addItem("🔍 หาเหรียญรอ Trigger(1H) ก่อนเข้าซื้อ", "findPrimedForEntryTrigger")
    .addItem("▶️ อัปเดตทั้งหมด + 🔍 หาเหรียญรอ Trigger(1H)", "updateAllThenFindPrimed")
    .addSeparator()
    .addItem("🧪 ทดสอบดึงราคา (BTC / ETH / KUB)", "testBitkubFetch")
    .addItem("🔎 ตรวจ Multi-Timeframe (AVAX)", "debugMTF_AVAX")
    .addItem("📝 ใส่โน้ตหัวคอลัมน์ใหม่ทั้งหมด", "refreshAllNotes")
    .addItem("🎨 ตั้งกฎสี (BUY เขียว / SELL,EXIT แดง / WAIT เหลือง)", "applyBuySellFormatting")
    .addItem("🕐 ตั้ง Trigger อัปเดตทุก 1 ชั่วโมง", "createHourlyTrigger")
    .addItem("🧹 ล้างสถานะที่ค้าง / Trigger ทำต่อ", "resetProgress")
    .addToUi();
}

// ====================================================
// helpers ทั่วไป
// ====================================================
function _alert(msg) { try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log("[ALERT] " + msg); } }
function _toast(msg, title) { try { SpreadsheetApp.getActiveSpreadsheet().toast(msg, title || "All-Bitkub", 10); } catch (e) { Logger.log("[TOAST] " + msg); } }

function _getSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error(`ไม่พบชีตชื่อ "${SHEET_NAME}"`);
  return sheet;
}

// หาแถว header + แมปชื่อหัวตาราง → เลขคอลัมน์ (รองรับหัวตารางชื่อซ้ำผ่าน occurrence)
function _getLayout(sheet) {
  const lastCol = sheet.getLastColumn();
  const scanRows = Math.min(HEADER_SCAN_ROWS, sheet.getLastRow());
  const grid = sheet.getRange(1, 1, scanRows, lastCol).getValues();

  let headerRow = -1, symbolCol = -1;
  for (let r = 0; r < grid.length && headerRow === -1; r++) {
    for (let c = 0; c < lastCol; c++) {
      if (String(grid[r][c]).trim().toUpperCase() === SYMBOL_HEADER) {
        headerRow = r + 1; symbolCol = c + 1; break;
      }
    }
  }
  if (headerRow === -1) throw new Error(`ไม่พบหัวคอลัมน์ "${SYMBOL_HEADER}" ใน ${HEADER_SCAN_ROWS} แถวแรก`);

  const headerVals = grid[headerRow - 1].map(v => String(v).trim().toUpperCase());
  const nameToIdxList = {};
  headerVals.forEach((v, i) => { if (!v) return; (nameToIdxList[v] = nameToIdxList[v] || []).push(i + 1); });

  const cols = { symbol: symbolCol };
  const missing = [];
  Object.keys(HEADER_DEFS).forEach(key => {
    const def = HEADER_DEFS[key];
    const names = [def.label].concat(HEADER_ALIASES[key] || []).map(s => s.toUpperCase());
    let idxList = [];
    names.forEach(n => { if (nameToIdxList[n]) idxList = idxList.concat(nameToIdxList[n]); });
    idxList.sort((a, b) => a - b);
    const occ = def.occurrence || 0;
    if (idxList.length > occ) cols[key] = idxList[occ];
    else missing.push(def.label + (occ > 0 ? ` (ต้องมีคอลัมน์ชื่อนี้ซ้ำ ${occ + 1} คอลัมน์)` : ""));
  });
  if (missing.length) throw new Error(`ไม่พบหัวคอลัมน์ (${missing.length}): ${missing.slice(0, 20).join(", ")}${missing.length > 20 ? " ..." : ""}`);

  return { headerRow, cols };
}

function _getLastSymbolRow(sheet, layout) {
  const first = layout.headerRow + 1;
  const last = sheet.getLastRow();
  if (last < first) return layout.headerRow;
  const vals = sheet.getRange(first, layout.cols.symbol, last - first + 1, 1).getValues();
  for (let i = vals.length - 1; i >= 0; i--) if (String(vals[i][0]).trim()) return first + i;
  return layout.headerRow;
}

// ====================================================
// 🎛️ Entry points
// ====================================================
function updateAllBitkub() {
  try {
    const sheet = _getSheet();
    const layout = _getLayout(sheet);
    const first = layout.headerRow + 1;
    const last = _getLastSymbolRow(sheet, layout);
    if (last < first) { _alert("ไม่พบรายชื่อเหรียญในคอลัมน์ " + SYMBOL_HEADER); return; }
    _clearContinueTriggers();
    _runRange(sheet, layout, first, last);
  } catch (e) {
    Logger.log(e.stack || e.message);
    _alert("❌ " + e.message);
  }
}

// ▶️ อัปเดตทั้งหมด แล้วต่อด้วย 🔍 หาเหรียญรอ Trigger(1H) ทันทีในการรันเดียวกัน
// หมายเหตุ: ถ้าจำนวนเหรียญเยอะมากจนอัปเดตไม่จบใน TIME_BUDGET_MS
// (ต้องใช้ continueUpdate ทำต่อในรอบถัดไป) ฟังก์ชันนี้จะยังคง "หาเหรียญ" ต่อทันที
// โดยใช้ข้อมูลเท่าที่อัปเดตเสร็จ ณ ตอนนั้น (แถวที่ยังไม่ได้อัปเดตจะไม่ถูกนับ)
function updateAllThenFindPrimed() {
  updateAllBitkub();
  findPrimedForEntryTrigger();
}

function updateSelectedRows() {
  try {
    const sheet = _getSheet();
    const layout = _getLayout(sheet);
    const range = SpreadsheetApp.getActiveRange();
    if (!range || range.getSheet().getName() !== SHEET_NAME) { _alert(`กรุณาเลือกแถวในชีต "${SHEET_NAME}" ก่อน`); return; }
    const first = Math.max(range.getRow(), layout.headerRow + 1);
    const last = range.getLastRow();
    if (last < first) { _alert("เลือกแถวข้อมูล (ไม่ใช่แถวหัวตาราง)"); return; }
    _clearContinueTriggers();
    _runRange(sheet, layout, first, last);
  } catch (e) {
    Logger.log(e.stack || e.message);
    _alert("❌ " + e.message);
  }
}

function continueUpdate() {
  const props = PropertiesService.getScriptProperties();
  const next = parseInt(props.getProperty(PROP_NEXT_ROW), 10);
  const last = parseInt(props.getProperty(PROP_LAST_ROW), 10);
  if (isNaN(next) || isNaN(last)) { _clearContinueTriggers(); _alert("ไม่มีงานที่ค้างอยู่"); return; }
  // ⚠️ ไม่เรียก _clearContinueTriggers() ที่นี่ก่อนรัน — ปล่อยให้ safety trigger เดิม (ถ้ามี) คงอยู่
  // จนกว่า _runRange() รอบนี้จะตั้งอันใหม่ทับเอง เผื่อรอบนี้ก็ timeout อีกจะได้ยังมีตัวมาปลุกต่อ
  try {
    const sheet = _getSheet();
    const layout = _getLayout(sheet);
    _runRange(sheet, layout, next, last);
  } catch (e) {
    Logger.log(e.stack || e.message);
    _alert("❌ " + e.message);
  }
}

function resetProgress() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(PROP_NEXT_ROW);
  props.deleteProperty(PROP_LAST_ROW);
  _clearContinueTriggers();
  _alert("🧹 ล้างสถานะที่ค้างและ trigger ทำต่อเรียบร้อย");
}

function _clearContinueTriggers() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === "continueUpdate").forEach(t => ScriptApp.deleteTrigger(t));
}

function refreshAllNotes() {
  try {
    const sheet = _getSheet();
    const layout = _getLayout(sheet);
    _setAllNotes(sheet, layout);
    _alert("📝 ใส่โน้ตหัวคอลัมน์ทั้งหมดเรียบร้อย");
  } catch (e) {
    Logger.log(e.stack || e.message);
    _alert("❌ " + e.message);
  }
}

// ====================================================
// 🔁 ตัววนหลัก
// ✅ แก้บั๊ก Timeout: ตั้ง "safety trigger" + เซฟตำแหน่งแถว "ก่อน" ประมวลผลแต่ละ chunk เสมอ
//    (ดูรายละเอียดเหตุผลที่หัวไฟล์) แทนที่จะตั้งหลังประมวลผลเสร็จเหมือนเดิม
// ====================================================
function _runRange(sheet, layout, firstRow, lastRow) {
  const startedAt = Date.now();
  const props = PropertiesService.getScriptProperties();
  const total = lastRow - firstRow + 1;
  const pairs = _loadThbPairs();
  const stats = { ok: 0, noPair: 0, error: 0 };

  const btcSeries = _fetchBtcSeries();

  let row = firstRow;
  while (row <= lastRow) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;

    // ✅ SAFETY NET: บันทึกจุดที่ "กำลังจะเริ่ม" chunk นี้ + ตั้ง safety trigger (SAFETY_TRIGGER_MIN นาที)
    // ไว้ล่วงหน้าเสมอ ก่อนเรียก _processChunk() — เผื่อ chunk นี้ (fetch/retry ช้าผิดปกติ) ทำให้รวมเวลา
    // ทั้ง execution เกินขีดจำกัดจริงของ Apps Script (~6 นาที) จน Google ฆ่าสคริปต์ทิ้งกลางทาง
    // ถ้าไม่ตั้งไว้ตรงนี้ก่อน โค้ดตั้ง trigger ท้ายลูปจะไม่ได้รันเลย และไม่มีอะไรมาปลุกให้ทำงานต่อ
    // กรณีปกติ (ไม่ timeout) โค้ดหลัง _processChunk() หรือท้ายฟังก์ชันจะตั้ง trigger ที่เหมาะสมทับอันนี้เอง
    props.setProperty(PROP_NEXT_ROW, String(row));
    props.setProperty(PROP_LAST_ROW, String(lastRow));
    _clearContinueTriggers();
    ScriptApp.newTrigger("continueUpdate").timeBased().after(SAFETY_TRIGGER_MIN * 60 * 1000).create();

    const n = Math.min(BATCH_SIZE, lastRow - row + 1);
    _processChunk(sheet, layout, row, n, pairs, stats, btcSeries);
    row += n;
    _toast(`ทำแล้ว ${Math.min(row - firstRow, total)}/${total} เหรียญ`, "⏳ กำลังอัปเดต");
  }

  // ⬇️ มาถึงบรรทัดนี้ได้ แปลว่าลูป while จบแบบไม่ถูกฆ่ากลางทาง (ไม่ว่าจะครบหรือหมดเวลาตามที่ตั้งใจ) ⬇️

  if (row <= lastRow) {
    // ยังไม่ครบ (แต่จบรอบอย่างปลอดภัยตาม TIME_BUDGET_MS) — แทนที่ safety trigger ด้วย trigger ปกติ (1 นาที)
    props.setProperty(PROP_NEXT_ROW, String(row));
    props.setProperty(PROP_LAST_ROW, String(lastRow));
    _clearContinueTriggers();
    ScriptApp.newTrigger("continueUpdate").timeBased().after(60 * 1000).create();
    _toast(`ใกล้หมดเวลา — จะทำต่ออัตโนมัติใน 1 นาที (เหลือแถว ${row}–${lastRow})`, "⏯️ ทำต่ออัตโนมัติ");
    return;
  }

  // เสร็จสมบูรณ์ทั้งหมด — ลบสถานะค้างและ safety trigger ทิ้ง
  props.deleteProperty(PROP_NEXT_ROW);
  props.deleteProperty(PROP_LAST_ROW);
  _clearContinueTriggers();

  try { _applyBuySellRules(sheet, layout); } catch (e) { Logger.log("[conditional format] " + e.message); }

  const stamp = "Updated: " + Utilities.formatDate(new Date(), TIME_ZONE, TIME_FORMAT);
  sheet.getRange(layout.headerRow, layout.cols.price).setNote(stamp + "\nราคาเป็น THB (Bitkub) — อ้างอิงจากแท่ง 1H ล่าสุด");

  try { _setAllNotes(sheet, layout); } catch (e) { Logger.log("[notes] " + e.message); }

  _toast(`✅ เสร็จแล้ว — สำเร็จ ${stats.ok} / ไม่มีคู่ THB ${stats.noPair} / error ${stats.error}`, "All-Bitkub");
  Logger.log(`เสร็จ: ok=${stats.ok}, noPair=${stats.noPair}, error=${stats.error} (${stamp})`);
}

// ====================================================
// 📝 โน้ตหัวคอลัมน์ — ครบทุกคอลัมน์ที่สคริปต์ดูแล
// ====================================================
function _noteForTFField(field, tf, cfg) {
  switch (field) {
    case "trend": return `TREND(${tf}) = UP ถ้าราคาปิดล่าสุด ≥ ค่าเฉลี่ย ${cfg.trendMaPeriod} แท่งหลังสุด ไม่งั้น DOWN`;
    case "rsi": return `RSI(${tf}) period ${cfg.rsiPeriod}\nพื้นแดง = RSI ≥ ${cfg.sellRsiThreshold} (โซน Overbought ของ TF นี้)`;
    case "hist": return `MACD Histogram(${tf}) ล่าสุด = เส้น MACD − เส้น Signal\nเขียว >0 (โมเมนตัมขาขึ้น) / แดง <0 (โมเมนตัมขาลง)`;
    case "histPrev": return `MACD Histogram(${tf}) ของแท่งก่อนหน้า — ใช้คำนวณ MACD_HIST_DELTA`;
    case "histDelta": return `MACD_HIST_DELTA(${tf}) = Histogram ล่าสุด − ก่อนหน้า\nเขียว = โมเมนตัมดีขึ้น / แดง = แย่ลง`;
    case "macd": return `เส้น MACD(${tf}) = EMA${cfg.macdFast} − EMA${cfg.macdSlow} ของราคาปิด`;
    case "macdSig": return `เส้น Signal(${tf}) = EMA${cfg.macdSignal} ของเส้น MACD`;
    case "ema9": return `EMA${cfg.emaFast} ของราคาปิด (${tf})`;
    case "ema21": return `EMA${cfg.emaSlow} ของราคาปิด (${tf})`;
    case "emaGap": return `EMA GAP(${tf}) % = (EMA9−EMA21)/EMA21×100 — ใช้ยืนยัน Trend เท่านั้น ไม่ใช่ตัวตัดสิน\n` +
      `🔴 Bearish <0% | 🟡 Near Cross 0–${cfg.emaGapNearMax}% | 🟢 Early ${cfg.emaGapNearMax}–${cfg.emaGapEarlyMax}% | 🟢 Bullish ${cfg.emaGapEarlyMax}–${cfg.emaGapBullishMax}% | 🔥 Strong >${cfg.emaGapBullishMax}%`;
    case "sigRsi": return `SIGNAL_RSI(${tf}): BUY = Trend UP และ RSI<${cfg.buyRsiThreshold} | SELL = Trend DOWN และ RSI>${cfg.sellRsiThreshold}\nRSI สูง/ต่ำอย่างเดียวไม่ใช่คำสั่งซื้อขายทันที`;
    case "sigMacd": return `SIGNAL_MACD(${tf}): ต้องผ่านครบพร้อมกัน — RSI สอดคล้อง + Histogram ดีขึ้น/แย่ลง + MACD ตัด Signal จริง + SIGNAL_EMA9X21 ทิศทางเดียวกัน`;
    case "sigEma": return `SIGNAL_EMA9X21(${tf}): BUY เมื่อ EMA9 ตัดขึ้น EMA21 / SELL เมื่อตัดลง (นับเฉพาะจังหวะตัดจริง)`;
    case "sigVolume": return `SIGNAL_VOLUME(${tf}) — เทียบ Volume แท่งปิดล่าสุดกับค่าเฉลี่ยย้อนหลัง ${cfg.volLookback} แท่ง\n*ไม่มีผลต่อ ACTION โดยตรง เป็นคอลัมน์เสริม`;
    case "structure": return `PRICE_STRUCTURE(${tf}) = โครงสร้างราคาจาก Swing High/Low (Pivot ${SWING_LEFT}-${SWING_RIGHT})\n🟢UP(HH+HL) 🟡REVERSAL 🟠DOWN→REVERSAL 🟤UP→WEAKENING 🔴DOWN(LH+LL) ⚪MIXED\nหลุด Swing Low ล่าสุด → ลดระดับสถานะทันที`;
    case "relStrength": return `RELATIVE_STRENGTH(${tf}) — เทียบผลตอบแทนย้อนหลัง ${cfg.rsLookback} แท่งกับ BTC (Benchmark)\n*ไม่มีผลต่อ ACTION โดยตรง เป็นคอลัมน์เสริม`;
    case "entryZoneRaw": return `ENTRY_ZONE(4H) = บริเวณราคาที่น่าเข้า จาก PRICE_STRUCTURE(4H) + เช็ก Breakout/Breakdown เทียบ Swing ล่าสุด\n🟢 HH/HL, BREAKOUT | 🟡 RETEST, RANGE | 🔴 LH/LL, BREAKDOWN\n(ค่าเดียวกับ ENTRY_ZONE(4H) ใน Summary ท้ายตาราง)`;
    case "entryTriggerRaw": return `ENTRY_TRIGGER(1H) = จังหวะเข้าจริง จาก PRICE_STRUCTURE(1H) + SIGNAL_EMA9X21(1H) + Volume/Momentum ยืนยัน\n🟢 ENTRY, BREAKOUT | 🟡 RETEST, WAIT | 🔴 FAILED\n(ค่าเดียวกับ ENTRY_TRIGGER(1H) ใน Summary ท้ายตาราง)`;
    case "actionTF": return _actionTFNote(tf);
    default: return "";
  }
}

function _actionTFNote(tf) {
  switch (tf) {
    case "W":  return "ACTION(W) = สรุปทิศทางใหญ่แบบ 3 สถานะ (ย่อจาก BIAS(W))\n🟢 BULLISH | 🟡 NEUTRAL (รวม RECOVERY/MIXED) | 🔴 BEARISH";
    case "D":  return "ACTION(D) = สรุป Setup แบบ 3 สถานะ (ย่อจาก SETUP(D) 6 สถานะ)\n🟢 READY | 🟡 WATCH (Pullback/Recovery/Wait) | 🔴 WEAK (Failed/Extended)";
    case "4H": return "ACTION(4H) = สรุป Entry Zone แบบ 3 สถานะ (ย่อจาก ENTRY_ZONE(4H))\n🟢 ZONE | 🟡 WAIT | 🔴 INVALID";
    case "1H": return "ACTION(1H) = สรุป Entry Trigger แบบ 3 สถานะ (ย่อจาก ENTRY_TRIGGER(1H))\n🟢 TRIGGER | 🟡 WAIT | 🔴 FAILED";
    default: return "";
  }
}

function _setAllNotes(sheet, layout) {
  const cols = layout.cols;
  TIMEFRAMES.forEach(tf => {
    const cfg = TF_CONFIG[tf];
    TF_BLOCK_FIELDS[tf].forEach(field => {
      const key = field + "_" + tf;
      if (!cols[key]) return;
      const note = _noteForTFField(field, tf, cfg);
      if (note) sheet.getRange(layout.headerRow, cols[key]).setNote(note);
    });
  });

  sheet.getRange(layout.headerRow, cols.biasW).setNote(
    "BIAS(W) = ภาพใหญ่/ทิศทาง จาก PRICE_STRUCTURE(W) — รายละเอียดเต็ม 4 สถานะ\n🟢 BULLISH | 🟡 RECOVERY (กำลังกลับตัว) | ⚪ NEUTRAL | 🔴 BEARISH");
  sheet.getRange(layout.headerRow, cols.setupD).setNote(
    "SETUP(D) = ความพร้อมของ Setup จาก PRICE_STRUCTURE(D) + RSI(D) — รายละเอียดเต็ม 6 สถานะ\n🟢 READY | 🟡 PULLBACK/RECOVERY | 🟠 EXTENDED (Overbought) | 🔴 FAILED | ⚪ WAIT");
  sheet.getRange(layout.headerRow, cols.entryZone4h).setNote(
    "ENTRY_ZONE(4H) — ค่าเดียวกับคอลัมน์ ENTRY_ZONE(4H) ในบล็อก 4H ด้านบน แสดงซ้ำที่นี่เพื่อดูพร้อมกับ BIAS/SETUP/ACTION");
  sheet.getRange(layout.headerRow, cols.entryTrigger1h).setNote(
    "ENTRY_TRIGGER(1H) — ค่าเดียวกับคอลัมน์ ENTRY_TRIGGER(1H) ในบล็อก 1H ด้านบน แสดงซ้ำที่นี่เพื่อดูพร้อมกับ BIAS/SETUP/ACTION");
  sheet.getRange(layout.headerRow, cols.action).setNote(
    "ACTION (Final) = ผลรวมของ BIAS(W) + SETUP(D) + ENTRY_ZONE(4H) + ENTRY_TRIGGER(1H) — ห้ามใช้เงื่อนไขเดียวตัดสิน\n" +
    "🟢 BUY  = W Bullish + D พร้อม (READY/RECOVERY/PULLBACK) + 4H เข้าโซน + 1H Trigger แล้ว\n" +
    "🟡 WAIT = ทิศทางถูกแต่ยังไม่ครบทุกชั้น (ห้ามไล่ซื้อ)\n" +
    "🔴 EXIT = W Bearish + D Failed + 4H หลุดโซน + 1H ยืนยันอ่อนแรง\n" +
    "ว่าง = ไม่เข้าเงื่อนไขไหนเลย (รอ)");
  sheet.getRange(layout.headerRow, cols.cost).setNote("ต้นทุนต่อเหรียญ (ผู้ใช้กรอกเอง เป็นบาท) — สคริปต์ไม่เขียนทับค่า เปลี่ยนแค่สี");
  sheet.getRange(layout.headerRow, cols.quantity).setNote("จำนวนที่ถือ (ผู้ใช้กรอกเอง) — สคริปต์ไม่แตะคอลัมน์นี้เลย");
  sheet.getRange(layout.headerRow, cols.price).setNote("ราคาล่าสุด (บาท) — อ้างอิงจากแท่ง 1H ล่าสุด ถ้าไม่มีข้อมูล 1H จะ fallback เป็นแท่ง Daily ล่าสุด");
  sheet.getRange(layout.headerRow, cols.profit).setNote("PROFIT = กำไร/ขาดทุนถ้าขายที่ PRICE ตอนนี้ (ยังไม่หักค่าธรรมเนียมขาย)\nบาท = QUANTITY×(PRICE−COST) | % = PRICE÷COST−1");
  sheet.getRange(layout.headerRow, cols.net).setNote(`NET = กำไร/ขาดทุนถ้าขายที่ PRICE ตอนนี้ หลังหักค่าธรรมเนียมขาย ${SELL_FEE_RATE * 100}%`);
  sheet.getRange(layout.headerRow, cols.url).setNote("ลิงก์ไปหน้า TradingView ของเหรียญนี้ (คู่ THB)");
  sheet.getRange(layout.headerRow, cols.updated).setNote("UPDATED = เวลาที่สคริปต์เขียนข้อมูลแถวนี้ (เวลาไทย)");
  sheet.getRange(layout.headerRow, cols.lastCandle).setNote("LAST_CANDLE = เวลาปิดของแท่ง 1H ล่าสุดที่ใช้คำนวณสัญญาณ (เวลาไทย)\nถ้าไม่มีข้อมูล 1H จะใช้เวลาปิดของแท่ง Daily แทน");
}

// ====================================================
// รายชื่อคู่เทรด THB / BTC benchmark
// ====================================================
function _loadThbPairs() {
  try {
    const res = UrlFetchApp.fetch("https://api.bitkub.com/api/v3/market/symbols", { muteHttpExceptions: true, headers: { "User-Agent": "Mozilla/5.0" } });
    if (res.getResponseCode() !== 200) return null;
    const list = (JSON.parse(res.getContentText()).result) || [];
    const set = {};
    list.forEach(s => { if (s && s.symbol) set[String(s.symbol).toUpperCase()] = true; });
    return Object.keys(set).length ? set : null;
  } catch (e) {
    Logger.log("[symbols] " + e.message);
    return null;
  }
}

function _fetchBtcSeries() {
  const pair = "BTC_" + QUOTE_ASSET;
  try {
    const daily = _fetchHistories([pair], "1D", HISTORY_DAYS_1D)[0];
    const hourly = _fetchHistories([pair], "60", HISTORY_DAYS_1H)[0];
    const out = {};
    TIMEFRAMES.forEach(tf => { out[tf] = _buildTFSeries(tf, daily, hourly); });
    return out;
  } catch (e) {
    Logger.log("[BTC benchmark] " + e.message);
    return { "W": null, "D": null, "4H": null, "1H": null };
  }
}

// ====================================================
// ประมวลผลหนึ่งชุด
// ====================================================
function _processChunk(sheet, layout, firstRow, n, pairs, stats, btcSeries) {
  const cols = layout.cols;
  const symbols = sheet.getRange(firstRow, cols.symbol, n, 1).getValues();
  const costs   = sheet.getRange(firstRow, cols.cost,     n, 1).getValues();
  const qtys    = sheet.getRange(firstRow, cols.quantity, n, 1).getValues();

  const entries = symbols.map(r => {
    const sym = String(r[0]).trim().toUpperCase().replace(/_THB$/, "");
    return { sym, pair: sym ? `${sym}_${QUOTE_ASSET}` : "" };
  });

  const toFetch = [];
  entries.forEach((e, i) => {
    if (!e.sym) return;
    if (pairs && !pairs[e.pair]) { e.status = "NO PAIR"; return; }
    toFetch.push(i);
  });

  const dailyH  = _fetchHistories(toFetch.map(i => entries[i].pair), "1D", HISTORY_DAYS_1D);
  const hourlyH = _fetchHistories(toFetch.map(i => entries[i].pair), "60", HISTORY_DAYS_1H);
  toFetch.forEach((i, k) => { entries[i].dailyHist = dailyH[k]; entries[i].hourlyHist = hourlyH[k]; });

  const out = {};
  Object.keys(HEADER_DEFS).forEach(k => { out[k] = []; });

  entries.forEach((e, i) => {
    const cells = _buildRowCells(e, costs[i][0], qtys[i][0], stats, btcSeries);
    Object.keys(HEADER_DEFS).forEach(k => out[k].push(cells[k]));
  });

  Object.keys(HEADER_DEFS).forEach(k => {
    if (k === "quantity") return;
    const range = sheet.getRange(firstRow, cols[k], n, 1);
    if (k === "url") {
      range.setRichTextValues(out[k].map(c => {
        const b = SpreadsheetApp.newRichTextValue().setText(c.v || "");
        if (c.v) b.setLinkUrl(c.v);
        return [b.build()];
      }));
      return;
    }
    if (k === "cost") {
      range.setBackgrounds(out[k].map(c => [c.bg]));
      range.setFontColors(out[k].map(c => [c.fg]));
      return;
    }
    if (k === "price") { range.setValues(out[k].map(c => [c.v])); return; }
    // 🆕 UPDATED / LAST_CANDLE: เขียนเป็นข้อความล้วน (กัน Sheets แปลงเป็นวันที่เอง) ไม่แตะสี/ฟอนต์
    if (k === "updated" || k === "lastCandle") {
      range.setNumberFormat("@");
      range.setValues(out[k].map(c => [c.v]));
      return;
    }
    if (k === "net" || k === "profit") {
      range.setNumberFormat("@");
      range.setValues(out[k].map(c => [c.v]));
      range.setBackgrounds(out[k].map(c => [c.bg]));
      range.setFontColors(out[k].map(c => [c.fg]));
      range.setFontWeights(out[k].map(c => [c.b ? "bold" : "normal"]));
      return;
    }
    range.setValues(out[k].map(c => [c.v]));
    range.setBackgrounds(out[k].map(c => [c.bg]));
    range.setFontColors(out[k].map(c => [c.fg]));
    range.setFontWeights(out[k].map(c => [c.b ? "bold" : "normal"]));
  });
  SpreadsheetApp.flush();

  try { _notifyTelegramForBuys(entries, out); } catch (e) { Logger.log("[telegram notify] " + e.message); }
}

// ====================================================
// 🧱 สร้างเซลล์ของหนึ่งแถว
// ====================================================
function _buildRowCells(e, costRaw, qtyRaw, stats, btcSeries) {
  const blank = () => ({ v: "", bg: WHITE, fg: BLACK, b: false });
  const wait  = (n) => ({ v: `WAIT(${n || 0})`, bg: "#FFF3CD", fg: "#856404", b: false });
  const cells = {};
  Object.keys(HEADER_DEFS).forEach(k => { cells[k] = blank(); });

  if (!e.sym) return cells;
  cells.url = { v: TRADINGVIEW_URL_PREFIX + e.sym + TRADINGVIEW_URL_SUFFIX };

  if (e.status === "NO PAIR") {
    stats.noPair++;
    cells.trend_W = { v: "NO PAIR", bg: "#E0E0E0", fg: "#666666", b: false };
    return cells;
  }

  const dh = e.dailyHist;
  if (!dh || !dh.ok) {
    stats.error++;
    cells.trend_W = { v: dh && dh.msg ? dh.msg : "ERROR", bg: "#E0E0E0", fg: "#666666", b: false };
    Logger.log(`[${e.pair}] daily: ${dh && dh.msg}`);
    return cells;
  }

  const hh = e.hourlyHist && e.hourlyHist.ok ? e.hourlyHist : null;
  if (!hh) Logger.log(`[${e.pair}] hourly: ${e.hourlyHist && e.hourlyHist.msg}`);

  const tfSeries = {};
  TIMEFRAMES.forEach(tf => { tfSeries[tf] = _buildTFSeries(tf, dh, hh); });

  if (!tfSeries["D"] || tfSeries["D"].closes.length < 2) {
    stats.error++;
    cells.trend_W = { v: "NO DATA", bg: "#E0E0E0", fg: "#666666", b: false };
    return cells;
  }
  stats.ok++;

  // PRICE ที่แสดงผล = ราคาล่าสุดจริง (แท่งกำลังวิ่งได้) ส่วนตัวชี้วัด/สัญญาณของ 1H,4H
  // ใช้ series ที่ตัดแท่งยังไม่ปิดทิ้งแล้ว (ดู _buildTFSeries / CLOSED_CANDLE_TFS) เพื่อกัน repaint
  const liveRaw = hh && hh.c && hh.c.length ? parseFloat(hh.c[hh.c.length - 1]) : NaN;
  const price = !isNaN(liveRaw) ? liveRaw
    : (tfSeries["1H"] && tfSeries["1H"].closes.length)
      ? tfSeries["1H"].closes[tfSeries["1H"].closes.length - 1]
      : tfSeries["D"].closes[tfSeries["D"].closes.length - 1];
  cells.price = { v: _sig(price, 8) };

  // 🆕 UPDATED = เวลาที่สคริปต์เขียนแถวนี้
  cells.updated = { v: Utilities.formatDate(new Date(), TIME_ZONE, TIME_FORMAT), bg: WHITE, fg: BLACK, b: false };

  // 🆕 LAST_CANDLE = เวลา "ปิด" ของแท่ง 1H ล่าสุดที่ใช้คำนวณ (ถ้าไม่มีข้อมูล 1H ใช้แท่ง Daily แทน)
  const s1h = tfSeries["1H"], sDay = tfSeries["D"];
  const candleEndSec = (s1h && s1h.barEnds && s1h.barEnds.length) ? s1h.barEnds[s1h.barEnds.length - 1]
    : (sDay && sDay.barEnds && sDay.barEnds.length) ? sDay.barEnds[sDay.barEnds.length - 1]
    : null;
  if (candleEndSec) {
    cells.lastCandle = { v: Utilities.formatDate(new Date(candleEndSec * 1000), TIME_ZONE, TIME_FORMAT), bg: WHITE, fg: BLACK, b: false };
  }

  let biasState = null, setupState = null, entryZoneLabel = null, entryTriggerLabel = null;

  TIMEFRAMES.forEach(tf => {
    const series = tfSeries[tf];
    const cfg = TF_CONFIG[tf];
    const fields = TF_BLOCK_FIELDS[tf];

    if (!series || series.closes.length < 2) {
      fields.forEach(f => { cells[f + "_" + tf] = wait(series ? series.closes.length : 0); });
      return;
    }

    const finerTf = TF_FINER[tf];
    let refPrice = series.closes[series.closes.length - 1];
    if (finerTf && tfSeries[finerTf] && tfSeries[finerTf].closes.length >= 2) {
      refPrice = tfSeries[finerTf].closes[tfSeries[finerTf].closes.length - 2];
    } else if (series.closes.length >= 2) {
      refPrice = series.closes[series.closes.length - 2];
    }

    const benchSeries = btcSeries[tf];
    const res = _analyzeTF(series, refPrice, benchSeries ? benchSeries.closeMap : null, cfg);

    if (tf === "W")  biasState  = calcBiasW(res);
    if (tf === "D")  setupState = calcSetupD(res, cfg);
    if (tf === "4H") entryZoneLabel = calcStructure4h(res);
    if (tf === "1H") entryTriggerLabel = calcEntry1h(res);

    fields.forEach(field => {
      const key = field + "_" + tf;
      switch (field) {
        case "trend":       cells[key] = res.trend ? _trendStyle(res.trend) : blank(); break;
        case "rsi":         cells[key] = (typeof res.rsi === "number") ? _rsiStyleGeneric(res.rsi, cfg.sellRsiThreshold) : wait(series.closes.length); break;
        case "hist":        cells[key] = _numStyle(res.hist, 6, true) || wait(series.closes.length); break;
        case "histPrev":    cells[key] = _numStyle(res.histPrev, 6, true) || wait(series.closes.length); break;
        case "histDelta":   cells[key] = _numStyle(res.histDelta, 6, true) || wait(series.closes.length); break;
        case "macd":        cells[key] = _numStyle(res.macd, 6, false) || wait(series.closes.length); break;
        case "macdSig":     cells[key] = _numStyle(res.macdSig, 6, false) || wait(series.closes.length); break;
        case "ema9":        cells[key] = _numStyle(res.ema9, 6, false) || wait(series.closes.length); break;
        case "ema21":       cells[key] = _numStyle(res.ema21, 6, false) || wait(series.closes.length); break;
        case "emaGap":      cells[key] = (res.emaGap !== null) ? _emaGapStyle(res.emaGap, cfg) : wait(series.closes.length); break;
        case "sigRsi":      cells[key] = _signalStyle(res.sigRsi); break;
        case "sigMacd":     cells[key] = _signalStyle(res.sigMacd); break;
        case "sigEma":      cells[key] = _signalStyle(res.sigEma); break;
        case "sigVolume":   cells[key] = res.sigVolume ? _buySellHoldStyle(res.sigVolume) : wait(series.volumes.length); break;
        case "structure":   cells[key] = res.structureState ? _structStyle(res.structureState) : wait(series.closes.length); break;
        case "relStrength": cells[key] = res.rs ? _buySellHoldStyle(res.rs) : (benchSeries ? wait(series.closes.length) : { v: "NO DATA (BTC)", bg: "#E0E0E0", fg: "#666666", b: false }); break;
        case "entryZoneRaw":     cells[key] = _labelStyle(entryZoneLabel); break;
        case "entryTriggerRaw": cells[key] = _labelStyle(entryTriggerLabel); break;
        case "actionTF": {
          if (tf === "W")  cells[key] = _actionWStyle(calcActionW(biasState));
          if (tf === "D")  cells[key] = _actionDStyle(calcActionD(setupState));
          if (tf === "4H") cells[key] = _action4hStyle(calcAction4h(entryZoneLabel));
          if (tf === "1H") cells[key] = _action1hStyle(calcAction1h(entryTriggerLabel));
          break;
        }
      }
    });
  });

  // ----- Summary section -----
  cells.biasW = _biasStyle(biasState);
  cells.setupD = _setupStyle(setupState);
  cells.entryZone4h = _labelStyle(entryZoneLabel);
  cells.entryTrigger1h = _labelStyle(entryTriggerLabel);

  const action = calcActionMTF(biasState, setupState, entryZoneLabel, entryTriggerLabel);
  cells.action = _actionStyle(action);

  const cost = _num(costRaw);
  if (!isNaN(cost) && cost > 0) {
    if (price > cost)      { cells.cost.bg = "#CCFFCC"; cells.cost.fg = "#006600"; }
    else if (price < cost) { cells.cost.bg = "#FFCCCC"; cells.cost.fg = "#CC0000"; }
    const qty = _num(qtyRaw);
    cells.profit = _pnlCell(price, cost, qty, false);
    cells.net    = _pnlCell(price, cost, qty, true);
  }

  return cells;
}

function _num(v) { if (typeof v === "number") return v; return parseFloat(String(v).replace(/[,\s฿]/g, "")); }

function _fmtSigned(v, decimals) {
  const r = Number(v.toFixed(decimals));
  if (r === 0) return (0).toFixed(decimals);
  const body = Math.abs(r).toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (r > 0 ? "+" : "-") + body;
}

function _pnlCell(price, cost, qty, applyFee) {
  const hasQty = !isNaN(qty) && qty > 0;
  let baht = null, pct;
  if (hasQty) {
    const gross = qty * price;
    const fee = applyFee ? Math.ceil(gross * SELL_FEE_RATE * 100 - 1e-9) / 100 : 0;
    const invested = qty * cost;
    baht = gross - fee - invested;
    pct = baht / invested;
  } else {
    pct = price * (applyFee ? 1 - SELL_FEE_RATE : 1) / cost - 1;
  }
  const pctText = _fmtSigned(pct * 100, 2) + "%";
  const text = hasQty ? `${_fmtSigned(baht, 2)} (${pctText})` : `(${pctText})`;
  const signBasis = hasQty ? Number(baht.toFixed(2)) : Number((pct * 100).toFixed(2));
  if (signBasis > 0) return { v: text, bg: "#CCFFCC", fg: "#006600", b: false };
  if (signBasis < 0) return { v: text, bg: "#FFCCCC", fg: "#CC0000", b: false };
  return { v: text, bg: WHITE, fg: BLACK, b: false };
}

function _sig(v, digits) { return parseFloat(Number(v).toPrecision(digits)); }

// ====================================================
// 🌐 Bitkub fetch (รองรับหลาย resolution)
// ====================================================
function _historyUrl(pair, resolution, days) {
  const now = Math.floor(Date.now() / 1000);
  const from = now - days * 86400;
  return `https://api.bitkub.com/tradingview/history?symbol=${pair}&resolution=${resolution}&from=${from}&to=${now}`;
}

function _parseHistoryResponse(res) {
  const code = res.getResponseCode();
  const body = res.getContentText();
  if (code === 429 || code >= 500) return { ok: false, retry: true, msg: `HTTP ${code}` };
  if (code !== 200) return { ok: false, retry: false, msg: `HTTP ${code}` };
  let json;
  try { json = JSON.parse(body); } catch (e) { return { ok: false, retry: true, msg: "BAD JSON" }; }
  if (json.s !== "ok") return { ok: false, retry: false, msg: "NO DATA" };
  if (!Array.isArray(json.t) || !Array.isArray(json.c) || !json.t.length) return { ok: false, retry: false, msg: "NO DATA" };
  return {
    ok: true, t: json.t, c: json.c,
    h: Array.isArray(json.h) ? json.h : [],
    l: Array.isArray(json.l) ? json.l : [],
    v: Array.isArray(json.v) ? json.v : []
  };
}

function _fetchHistories(pairs, resolution, days) {
  const results = new Array(pairs.length);
  if (!pairs.length) return results;
  const options = { muteHttpExceptions: true, headers: { "User-Agent": "Mozilla/5.0" } };
  const requests = pairs.map(p => Object.assign({ url: _historyUrl(p, resolution, days) }, options));

  let responses = null;
  try { responses = UrlFetchApp.fetchAll(requests); }
  catch (e) { Logger.log("[fetchAll] " + e.message + " — ลองยิงทีละตัวแทน"); }

  pairs.forEach((pair, i) => {
    if (responses) results[i] = _parseHistoryResponse(responses[i]);
    else results[i] = { ok: false, retry: true, msg: "FETCH ERROR" };
  });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const failed = results.map((r, i) => (!r.ok && r.retry) ? i : -1).filter(i => i >= 0);
    if (!failed.length) break;
    Utilities.sleep(1500 * attempt);
    failed.forEach(i => {
      try {
        const res = UrlFetchApp.fetch(_historyUrl(pairs[i], resolution, days), options);
        results[i] = _parseHistoryResponse(res);
      } catch (e) { results[i] = { ok: false, retry: true, msg: "FETCH ERROR" }; }
    });
  }
  return results;
}

function _resampleOHLCV(t, h, l, c, v, barSeconds, offsetSeconds) {
  const pts = [];
  const n = (t || []).length;
  for (let i = 0; i < n; i++) {
    const tt = Number(t[i]), hi = parseFloat(h[i]), lo = parseFloat(l[i]), cl = parseFloat(c[i]);
    if (isNaN(tt) || isNaN(hi) || isNaN(lo) || isNaN(cl)) continue;
    const vol = (v && v.length) ? parseFloat(v[i]) : NaN;
    pts.push({ t: tt, h: hi, l: lo, c: cl, v: isNaN(vol) ? 0 : vol });
  }
  pts.sort((a, b) => a.t - b.t);

  const byBar = {};
  pts.forEach(p => {
    const key = Math.floor((p.t + offsetSeconds) / barSeconds);
    if (!byBar[key]) byBar[key] = { h: p.h, l: p.l, c: p.c, v: p.v, lastT: p.t };
    else {
      const b = byBar[key];
      b.h = Math.max(b.h, p.h);
      b.l = Math.min(b.l, p.l);
      b.v += p.v;
      if (p.t >= b.lastT) { b.c = p.c; b.lastT = p.t; }
    }
  });
  const keys = Object.keys(byBar).map(Number).sort((a, b) => a - b);
  return {
    closes:  keys.map(k => byBar[k].c),
    highs:   keys.map(k => byBar[k].h),
    lows:    keys.map(k => byBar[k].l),
    volumes: keys.map(k => byBar[k].v),
    // 🆕 เก็บ key ของแต่ละแท่ง + เวลาที่แท่งนั้น "ปิด" (unix sec) ไว้เช็กว่าแท่งล่าสุดปิดจริงหรือยัง
    barKeys: keys,
    barEnds: keys.map(k => (k + 1) * barSeconds - offsetSeconds),
  };
}

function _closeMapAtRes(t, c, barSeconds, offsetSeconds) {
  const pts = [];
  const n = (t || []).length;
  for (let i = 0; i < n; i++) {
    const tt = Number(t[i]), p = parseFloat(c[i]);
    if (isNaN(tt) || isNaN(p)) continue;
    pts.push({ t: tt, p });
  }
  pts.sort((a, b) => a.t - b.t);
  const map = {};
  pts.forEach(pt => { map[Math.floor((pt.t + offsetSeconds) / barSeconds)] = pt.p; });
  return map;
}

// 🆕 TF ที่ต้อง "ตัดแท่งล่าสุดทิ้งถ้ายังไม่ปิด" ก่อนคำนวณ indicator/structure/signal ทั้งหมด
// ป้องกันสัญญาณ repaint — เช่น ENTRY_TRIGGER(1H) กระพริบ 🟢 แล้วหายไปตอนที่แท่งยังไม่ปิดจริง
// ปิดสวิตช์ได้ด้วยการเอา TF ออกจากลิสต์นี้ (เช่น อยากให้ 4H ยังใช้แท่งสดได้ ก็เหลือแค่ ["1H"])
const CLOSED_CANDLE_TFS = ["1H", "4H"];
const CLOSED_CANDLE_GRACE_SECONDS = 5; // เผื่อ clock skew/ดีเลย์เล็กน้อยของ API

function _trimIncompleteLastBar(series) {
  if (!series || !series.barEnds || !series.barEnds.length) return;
  const nowSec = Math.floor(Date.now() / 1000);
  const lastIdx = series.barEnds.length - 1;
  if (series.barEnds[lastIdx] > nowSec + CLOSED_CANDLE_GRACE_SECONDS) {
    const droppedKey = series.barKeys[lastIdx];
    series.closes.pop();
    series.highs.pop();
    series.lows.pop();
    series.volumes.pop();
    series.barEnds.pop();
    series.barKeys.pop();
    if (series.closeMap && droppedKey !== undefined) delete series.closeMap[droppedKey];
  }
}

function _buildTFSeries(tf, dailyHist, hourlyHist) {
  const cfg = TF_RESAMPLE[tf];
  const src = cfg.source === "daily" ? dailyHist : hourlyHist;
  if (!src || !src.ok) return null;
  const series = _resampleOHLCV(src.t, src.h, src.l, src.c, src.v, cfg.barSeconds, cfg.offsetSeconds);
  series.closeMap = _closeMapAtRes(src.t, src.c, cfg.barSeconds, cfg.offsetSeconds);

  if (CLOSED_CANDLE_TFS.indexOf(tf) !== -1) _trimIncompleteLastBar(series);

  return series;
}

// ====================================================
// 🏗️ PRICE STRUCTURE (HH/HL/LH/LL)
// ====================================================
function _pivots(arr, isHigh) {
  const out = [];
  for (let i = SWING_LEFT; i < arr.length - SWING_RIGHT; i++) {
    let ok = true;
    for (let j = 1; j <= SWING_LEFT && ok; j++) if (isHigh ? !(arr[i] > arr[i - j]) : !(arr[i] < arr[i - j])) ok = false;
    for (let j = 1; j <= SWING_RIGHT && ok; j++) if (isHigh ? !(arr[i] > arr[i + j]) : !(arr[i] < arr[i + j])) ok = false;
    if (ok) out.push({ i, p: arr[i] });
  }
  return out;
}

function _cmp(sw, isHigh) {
  const n = sw.length;
  if (n < 2) return "";
  const a = sw[n - 1].p, b = sw[n - 2].p;
  if (b !== 0 && Math.abs(a - b) / Math.abs(b) <= STRUCT_EQ_TOL) return "EQ";
  if (a > b) return isHigh ? "HH" : "HL";
  return isHigh ? "LH" : "LL";
}

function calcPriceStructure(highs, lows, refPrice) {
  const sh = _pivots(highs, true), sl = _pivots(lows, false);
  if (sh.length < STRUCT_MIN_SWINGS || sl.length < STRUCT_MIN_SWINGS) return null;

  const hs = _cmp(sh, true), hsPrev = _cmp(sh.slice(0, -1), true);
  const ls = _cmp(sl, false), lsPrev = _cmp(sl.slice(0, -1), false);

  let state = "MIXED";
  if (hs === "HH" && ls === "HL") {
    if (hsPrev === "HH") state = "UP";
    else if (hsPrev === "LH") state = "REVERSAL";
  } else if (hs === "LH" && ls === "LL") {
    state = "DOWN";
  } else if (hs === "LH" && ls === "HL") {
    if (lsPrev === "LL") state = "DOWN_REV";
    else if (hsPrev === "HH") state = "UP_WEAK";
  }

  const lastL = sl[sl.length - 1], lastH = sh[sh.length - 1];
  const DOWNGRADE = { UP: "UP_WEAK", REVERSAL: "MIXED", DOWN_REV: "DOWN", UP_WEAK: "DOWN" };
  if (typeof refPrice === "number" && !isNaN(refPrice) && refPrice < lastL.p && DOWNGRADE[state]) {
    state = DOWNGRADE[state];
  }
  return { state, lastSwingHigh: lastH.p, lastSwingLow: lastL.p };
}

function _structStyle(structInfo) {
  switch (structInfo.state) {
    case "UP":       return { v: "🟢 UP",              bg: "#CCFFCC", fg: "#006600", b: true };
    case "REVERSAL": return { v: "🟡 REVERSAL",        bg: "#FFF3CD", fg: "#856404", b: true };
    case "DOWN_REV": return { v: "🟠 DOWN → REVERSAL", bg: "#FFE0B2", fg: "#E65100", b: true };
    case "UP_WEAK":  return { v: "🟤 UP → WEAKENING",  bg: "#EFEBE9", fg: "#5D4037", b: true };
    case "DOWN":     return { v: "🔴 DOWN",            bg: "#FFCCCC", fg: "#CC0000", b: true };
    default:         return { v: "⚪ SIDEWAY/MIXED",   bg: "#EEEEEE", fg: "#555555", b: true };
  }
}

// ====================================================
// 📈 Indicators
// ====================================================
function calcRSI(prices, period) {
  if (prices.length < period + 1) throw new Error(`ข้อมูลน้อยเกินไป (ต้องการ ${period + 1} จุด)`);
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) { const d = prices[i] - prices[i - 1]; if (d > 0) gains += d; else losses += Math.abs(d); }
  let avgGain = gains / period, avgLoss = losses / period;
  for (let i = period + 1; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? Math.abs(d) : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

function calcTrend(prices, maPeriod) {
  if (!prices || prices.length < maPeriod + 1) return null;
  const recent = prices.slice(-maPeriod);
  const ma = recent.reduce((a, b) => a + b, 0) / recent.length;
  return prices[prices.length - 1] >= ma ? "UP" : "DOWN";
}

function calcEMASeries(prices, period) {
  if (!prices || prices.length < period) return new Array(prices ? prices.length : 0).fill(null);
  const emaArr = new Array(prices.length).fill(null);
  const k = 2 / (period + 1);
  let sma = 0;
  for (let i = 0; i < period; i++) sma += prices[i];
  emaArr[period - 1] = sma / period;
  for (let i = period; i < prices.length; i++) emaArr[i] = (prices[i] - emaArr[i - 1]) * k + emaArr[i - 1];
  return emaArr;
}

function calcEMAOfSeries(series, period) {
  const n = series.length;
  const result = new Array(n).fill(null);
  const startIdx = series.findIndex(v => v !== null && v !== undefined);
  if (startIdx === -1 || n - startIdx < period) return result;
  const k = 2 / (period + 1);
  let sma = 0;
  for (let i = 0; i < period; i++) sma += series[startIdx + i];
  const seedIdx = startIdx + period - 1;
  result[seedIdx] = sma / period;
  for (let i = seedIdx + 1; i < n; i++) {
    if (series[i] === null || series[i] === undefined) continue;
    result[i] = (series[i] - result[i - 1]) * k + result[i - 1];
  }
  return result;
}

function calcMACDSeries(prices, fast, slow, signalP) {
  const emaFast = calcEMASeries(prices, fast), emaSlow = calcEMASeries(prices, slow);
  const n = prices.length;
  const macdLine = new Array(n).fill(null);
  for (let i = 0; i < n; i++) if (emaFast[i] !== null && emaSlow[i] !== null) macdLine[i] = emaFast[i] - emaSlow[i];
  const signalLine = calcEMAOfSeries(macdLine, signalP);
  const histogram = new Array(n).fill(null);
  for (let i = 0; i < n; i++) if (macdLine[i] !== null && signalLine[i] !== null) histogram[i] = macdLine[i] - signalLine[i];
  return { macdLine, signalLine, histogram };
}

function _lastValid(arr) { for (let i = arr.length - 1; i >= 0; i--) if (arr[i] !== null && arr[i] !== undefined) return arr[i]; return null; }
function _nthLastValid(arr, n) {
  let count = -1;
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] !== null && arr[i] !== undefined) { count++; if (count === n) return arr[i]; }
  return null;
}

// ====================================================
// 🚦 Signals
// ====================================================
function calcSignal(trend, rsi, buyRsi, sellRsi) {
  if (trend === "UP" && typeof rsi === "number" && rsi < buyRsi) return "BUY";
  if (trend === "DOWN" && typeof rsi === "number" && rsi > sellRsi) return "SELL";
  return "";
}

function _cross(a, b) {
  const n = a.length;
  if (n < 2) return "";
  const at = a[n - 1], bt = b[n - 1], at1 = a[n - 2], bt1 = b[n - 2];
  if (at == null || bt == null || at1 == null || bt1 == null) return "";
  if (at1 <= bt1 && at > bt) return "BUY";
  if (at1 >= bt1 && at < bt) return "SELL";
  return "";
}

function _histogramImproved(h) { const n = h.length; return n >= 2 && h[n - 1] != null && h[n - 2] != null && h[n - 1] > h[n - 2]; }
function _histogramWorsened(h) { const n = h.length; return n >= 2 && h[n - 1] != null && h[n - 2] != null && h[n - 1] < h[n - 2]; }

function calcSignalMacd(rsi, histogram, macdLine, signalLine, sigEma, buyRsi, sellRsi) {
  const macdCross = _cross(macdLine, signalLine);
  const buy = typeof rsi === "number" && rsi < buyRsi && _histogramImproved(histogram) && macdCross === "BUY" && sigEma === "BUY";
  const sell = typeof rsi === "number" && rsi > sellRsi && _histogramWorsened(histogram) && macdCross === "SELL" && sigEma === "SELL";
  if (buy) return "BUY";
  if (sell) return "SELL";
  return "";
}

function calcSignalVolume(vols, closes, histDelta, sigEma, lookback, buyMult, sellMult) {
  const n = vols.length;
  const refIdx = n - 2;
  if (refIdx - lookback < 0) return null;
  const volRef = vols[refIdx], volPrev1 = vols[refIdx - 1];
  const window = vols.slice(refIdx - lookback, refIdx);
  const avgVol = window.reduce((a, b) => a + b, 0) / window.length;

  if (volRef > avgVol * buyMult && volRef > volPrev1) return "BUY";

  const priceRef = closes[refIdx], pricePrev1 = closes[refIdx - 1];
  const priceWeak = priceRef < pricePrev1 && typeof histDelta === "number" && histDelta < 0 && sigEma === "SELL";
  if (volRef < avgVol * sellMult && priceWeak) return "SELL";

  return "HOLD";
}

function _rsAtBar(barKey, coinMap, benchMap, lookback) {
  const p0 = coinMap[barKey], p1 = coinMap[barKey - lookback];
  const b0 = benchMap[barKey], b1 = benchMap[barKey - lookback];
  if (p0 == null || p1 == null || b0 == null || b1 == null || p1 === 0 || b1 === 0) return null;
  return ((p0 / p1 - 1) - (b0 / b1 - 1)) * 100;
}

function calcRelativeStrengthGeneric(coinMap, benchMap, lookback, trendLookback, buyMin, sellMax) {
  const keys = Object.keys(coinMap).map(Number).sort((a, b) => a - b);
  if (keys.length < 2) return null;
  const refKey = keys[keys.length - 2];

  const rsNow = _rsAtBar(refKey, coinMap, benchMap, lookback);
  if (rsNow === null) return null;

  const prevVals = [];
  for (let i = 1; i <= trendLookback; i++) {
    const v = _rsAtBar(refKey - i, coinMap, benchMap, lookback);
    if (v === null) return null;
    prevVals.push(v);
  }
  const avgPrev = prevVals.reduce((a, b) => a + b, 0) / prevVals.length;

  if (rsNow > buyMin && rsNow > avgPrev) return "BUY";
  if (rsNow < sellMax && rsNow < avgPrev) return "SELL";
  return "HOLD";
}

// ====================================================
// 🧮 วิเคราะห์ TF เดียว
// ====================================================
function _analyzeTF(series, refPrice, benchMap, cfg) {
  const closes = series.closes;
  const out = {};

  out.trend = calcTrend(closes, cfg.trendMaPeriod);
  out.rsi = (closes.length >= cfg.rsiPeriod + 1) ? parseFloat(calcRSI(closes, cfg.rsiPeriod).toFixed(2)) : null;

  const m = calcMACDSeries(closes, cfg.macdFast, cfg.macdSlow, cfg.macdSignal);
  out.macd = _lastValid(m.macdLine);
  out.macdSig = _lastValid(m.signalLine);
  out.hist = _lastValid(m.histogram);
  out.histPrev = _nthLastValid(m.histogram, 1);
  out.histDelta = (out.hist !== null && out.histPrev !== null) ? out.hist - out.histPrev : null;

  const ema9S = calcEMASeries(closes, cfg.emaFast);
  const ema21S = calcEMASeries(closes, cfg.emaSlow);
  out.ema9 = _lastValid(ema9S);
  out.ema21 = _lastValid(ema21S);
  out.emaGap = (out.ema9 !== null && out.ema21 !== null && out.ema21 !== 0) ? (out.ema9 - out.ema21) / out.ema21 * 100 : null;

  out.sigEma = _cross(ema9S, ema21S);
  out.sigRsi = calcSignal(out.trend, out.rsi, cfg.buyRsiThreshold, cfg.sellRsiThreshold);
  out.sigMacd = calcSignalMacd(out.rsi, m.histogram, m.macdLine, m.signalLine, out.sigEma, cfg.buyRsiThreshold, cfg.sellRsiThreshold);

  out.structureState = calcPriceStructure(series.highs, series.lows, refPrice);

  out.sigVolume = (series.volumes && series.volumes.length >= cfg.volLookback + 2)
    ? calcSignalVolume(series.volumes, closes, out.histDelta, out.sigEma, cfg.volLookback, cfg.volBuyMult, cfg.volSellMult)
    : null;

  out.rs = benchMap ? calcRelativeStrengthGeneric(series.closeMap, benchMap, cfg.rsLookback, cfg.rsTrendLookback, cfg.rsBuyMin, cfg.rsSellMax) : null;

  out.lastClose = closes[closes.length - 1];
  return out;
}

// ====================================================
// 🧭 Summary layer (รายละเอียดเต็ม): BIAS(W) → SETUP(D) → ENTRY_ZONE(4H) → ENTRY_TRIGGER(1H) → ACTION
// ====================================================
function calcBiasW(res) {
  if (!res || !res.structureState) return "";
  switch (res.structureState.state) {
    case "UP": return "BULLISH";
    case "DOWN": return "BEARISH";
    case "REVERSAL": case "DOWN_REV": return "RECOVERY";
    default: return "NEUTRAL";
  }
}
function _biasStyle(state) {
  switch (state) {
    case "BULLISH":  return { v: "🟢 BULLISH",  bg: "#CCFFCC", fg: "#006600", b: true };
    case "BEARISH":  return { v: "🔴 BEARISH",  bg: "#FFCCCC", fg: "#CC0000", b: true };
    case "RECOVERY": return { v: "🟡 RECOVERY", bg: "#FFF3CD", fg: "#856404", b: true };
    case "NEUTRAL":  return { v: "⚪ NEUTRAL",  bg: "#EEEEEE", fg: "#555555", b: false };
    default:         return { v: "", bg: WHITE, fg: BLACK, b: false };
  }
}

function calcSetupD(res, cfgD) {
  if (!res || !res.structureState) return "";
  if (typeof res.rsi === "number" && res.rsi > cfgD.sellRsiThreshold) return "EXTENDED";
  switch (res.structureState.state) {
    case "DOWN": return "FAILED";
    case "DOWN_REV": return "RECOVERY";
    case "UP": case "REVERSAL":
      return (typeof res.rsi === "number" && res.rsi <= 50) ? "PULLBACK" : "READY";
    default: return "WAIT";
  }
}
function _setupStyle(state) {
  switch (state) {
    case "READY":    return { v: "🟢 READY",    bg: "#CCFFCC", fg: "#006600", b: true };
    case "RECOVERY": return { v: "🟡 RECOVERY", bg: "#FFF3CD", fg: "#856404", b: true };
    case "PULLBACK": return { v: "🟡 PULLBACK", bg: "#FFF3CD", fg: "#856404", b: true };
    case "EXTENDED": return { v: "🟠 EXTENDED", bg: "#FFE0B2", fg: "#E65100", b: true };
    case "FAILED":   return { v: "🔴 FAILED",   bg: "#FFCCCC", fg: "#CC0000", b: true };
    case "WAIT":     return { v: "⚪ WAIT",     bg: "#EEEEEE", fg: "#555555", b: false };
    default:         return { v: "", bg: WHITE, fg: BLACK, b: false };
  }
}

function calcStructure4h(res) {
  if (!res || !res.structureState) return "";
  const si = res.structureState;
  switch (si.state) {
    case "UP": return (res.lastClose > si.lastSwingHigh) ? "🟢 BREAKOUT" : "🟢 HH/HL";
    case "REVERSAL": case "DOWN_REV": return "🟡 RETEST";
    case "UP_WEAK": return "🟡 RANGE";
    case "DOWN": return (res.lastClose < si.lastSwingLow) ? "🔴 BREAKDOWN" : "🔴 LH/LL";
    default: return "🟡 RANGE";
  }
}

function calcEntry1h(res) {
  if (!res || !res.structureState) return "";
  const si = res.structureState;
  const bullConfirm = res.sigEma === "BUY" && (res.sigVolume === "BUY" || (typeof res.histDelta === "number" && res.histDelta > 0));
  const bearConfirm = res.sigEma === "SELL" && (res.sigVolume === "SELL" || (typeof res.histDelta === "number" && res.histDelta < 0));

  if (si.state === "UP" || si.state === "REVERSAL") {
    if (bullConfirm) return (res.lastClose > si.lastSwingHigh) ? "🟢 BREAKOUT" : "🟢 ENTRY";
    return "🟡 WAIT";
  }
  if (si.state === "DOWN" || si.state === "UP_WEAK") {
    if (bearConfirm) return "🔴 FAILED";
    return "🟡 RETEST";
  }
  return "🟡 WAIT";
}

function _labelStyle(label) {
  if (!label) return { v: "", bg: WHITE, fg: BLACK, b: false };
  if (label.indexOf("🟢") === 0) return { v: label, bg: "#CCFFCC", fg: "#006600", b: true };
  if (label.indexOf("🔴") === 0) return { v: label, bg: "#FFCCCC", fg: "#CC0000", b: true };
  if (label.indexOf("🟡") === 0) return { v: label, bg: "#FFF3CD", fg: "#856404", b: true };
  return { v: label, bg: "#EEEEEE", fg: "#555555", b: false };
}

// ACTION (Final) — ต้องผ่านทั้ง 4 ชั้นตามลำดับ ห้ามใช้เงื่อนไขเดียวตัดสิน
function calcActionMTF(bias, setup, entryZoneLabel, entryTriggerLabel) {
  if (!bias || !setup || !entryZoneLabel || !entryTriggerLabel) return "";

  const zoneBull = entryZoneLabel.indexOf("🟢") === 0;
  const zoneBear = entryZoneLabel.indexOf("🔴") === 0;
  const triggerBull = entryTriggerLabel.indexOf("🟢") === 0;
  const triggerBear = entryTriggerLabel.indexOf("🔴") === 0;
  const triggerWaitOrRetest = entryTriggerLabel.indexOf("🟡") === 0;

  const buySetupOk  = (setup === "READY" || setup === "RECOVERY" || setup === "PULLBACK");
  const sellSetupOk = (setup === "FAILED");

  if (bias === "BULLISH" && buySetupOk) {
    if (zoneBull && triggerBull) return "BUY";
    if (zoneBull && triggerWaitOrRetest) return "WAIT";
  }
  if (bias === "BEARISH" && sellSetupOk) {
    if (zoneBear && triggerBear) return "SELL"; // แสดงผลเป็น 🔴 EXIT
    if (zoneBear) return "WAIT";
  }
  return "";
}

// ====================================================
// 🧩 ACTION(TF) — สรุป 3 สถานะต่อ TF (ย่อจาก BIAS/SETUP/ENTRY_ZONE/ENTRY_TRIGGER)
// ====================================================
function calcActionW(biasState) {
  if (biasState === "BULLISH") return "BULLISH";
  if (biasState === "BEARISH") return "BEARISH";
  return "NEUTRAL";
}
function _actionWStyle(s) {
  if (s === "BULLISH") return { v: "🟢 BULLISH", bg: "#CCFFCC", fg: "#006600", b: true };
  if (s === "BEARISH") return { v: "🔴 BEARISH", bg: "#FFCCCC", fg: "#CC0000", b: true };
  return { v: "🟡 NEUTRAL", bg: "#FFF3CD", fg: "#856404", b: true };
}

function calcActionD(setupState) {
  if (setupState === "READY") return "READY";
  if (setupState === "FAILED" || setupState === "EXTENDED") return "WEAK";
  return "WATCH";
}
function _actionDStyle(s) {
  if (s === "READY") return { v: "🟢 READY", bg: "#CCFFCC", fg: "#006600", b: true };
  if (s === "WEAK") return { v: "🔴 WEAK", bg: "#FFCCCC", fg: "#CC0000", b: true };
  return { v: "🟡 WATCH", bg: "#FFF3CD", fg: "#856404", b: true };
}

function calcAction4h(entryZoneLabel) {
  if (!entryZoneLabel) return "";
  if (entryZoneLabel.indexOf("🟢") === 0) return "ZONE";
  if (entryZoneLabel.indexOf("🔴") === 0) return "INVALID";
  return "WAIT";
}
function _action4hStyle(s) {
  if (s === "ZONE") return { v: "🟢 ZONE", bg: "#CCFFCC", fg: "#006600", b: true };
  if (s === "INVALID") return { v: "🔴 INVALID", bg: "#FFCCCC", fg: "#CC0000", b: true };
  if (s === "WAIT") return { v: "🟡 WAIT", bg: "#FFF3CD", fg: "#856404", b: true };
  return { v: "", bg: WHITE, fg: BLACK, b: false };
}

function calcAction1h(entryTriggerLabel) {
  if (!entryTriggerLabel) return "";
  if (entryTriggerLabel.indexOf("🟢") === 0) return "TRIGGER";
  if (entryTriggerLabel.indexOf("🔴") === 0) return "FAILED";
  return "WAIT";
}
function _action1hStyle(s) {
  if (s === "TRIGGER") return { v: "🟢 TRIGGER", bg: "#CCFFCC", fg: "#006600", b: true };
  if (s === "FAILED") return { v: "🔴 FAILED", bg: "#FFCCCC", fg: "#CC0000", b: true };
  if (s === "WAIT") return { v: "🟡 WAIT", bg: "#FFF3CD", fg: "#856404", b: true };
  return { v: "", bg: WHITE, fg: BLACK, b: false };
}

// ====================================================
// 🎨 สไตล์เซลล์ (Indicators/Signals ทั่วไป)
// ====================================================
function _rsiStyleGeneric(v, redMin) {
  return (v >= redMin) ? { v, bg: "#FFCCCC", fg: "#CC0000", b: false } : { v, bg: WHITE, fg: BLACK, b: false };
}

function _trendStyle(trend) {
  if (trend === "UP") return { v: "UP", bg: "#CCFFCC", fg: "#006600", b: false };
  if (trend === "DOWN") return { v: "DOWN", bg: "#FFCCCC", fg: "#CC0000", b: false };
  return { v: "", bg: WHITE, fg: BLACK, b: false };
}

function _numStyle(v, digits, colorBySign) {
  if (v === null || v === undefined || isNaN(v)) return null;
  const val = _sig(v, digits);
  if (!colorBySign) return { v: val, bg: WHITE, fg: BLACK, b: false };
  if (val > 0) return { v: val, bg: "#CCFFCC", fg: "#006600", b: false };
  if (val < 0) return { v: val, bg: "#FFCCCC", fg: "#CC0000", b: false };
  return { v: val, bg: WHITE, fg: BLACK, b: false };
}

function _emaGapStyle(gap, cfg) {
  let st;
  if (gap < 0) st = { bg: "#FFCCCC", fg: "#CC0000" };
  else if (gap < cfg.emaGapNearMax) st = { bg: "#FFF3CD", fg: "#856404" };
  else if (gap < cfg.emaGapEarlyMax) st = { bg: "#D4F4DD", fg: "#1B7A3D" };
  else if (gap < cfg.emaGapBullishMax) st = { bg: "#CCFFCC", fg: "#006600" };
  else st = { bg: "#FFE0B2", fg: "#E65100" };
  return { v: _sig(gap, 4), bg: st.bg, fg: st.fg, b: false };
}

function _signalStyle(sig) {
  if (sig === "BUY") return { v: "BUY", bg: BUY_BG, fg: WHITE, b: true };
  if (sig === "SELL") return { v: "SELL", bg: SELL_BG, fg: WHITE, b: true };
  return { v: "", bg: WHITE, fg: BLACK, b: false };
}

function _buySellHoldStyle(sig) {
  if (sig === "BUY") return { v: "🟢 BUY", bg: BUY_BG, fg: WHITE, b: true };
  if (sig === "SELL") return { v: "🔴 SELL", bg: SELL_BG, fg: WHITE, b: true };
  return { v: "⚪ HOLD", bg: "#EEEEEE", fg: "#555555", b: false };
}

// ACTION (Final) — แสดง EXIT แทน SELL ตามที่กำหนด
function _actionStyle(action) {
  if (action === "BUY") return { v: "🟢 BUY", bg: BUY_BG, fg: WHITE, b: true };
  if (action === "SELL") return { v: "🔴 EXIT", bg: SELL_BG, fg: WHITE, b: true };
  if (action === "WAIT") return { v: "🟡 WAIT", bg: "#FFF3CD", fg: "#856404", b: true };
  return { v: "", bg: WHITE, fg: BLACK, b: false };
}

// ====================================================
// 🎨 Conditional Formatting
// ====================================================
function _applyBuySellRules(sheet, layout) {
  const first = layout.headerRow + 1;
  const rows = Math.max(sheet.getMaxRows() - first + 1, 1);
  const colNums = BUYSELL_CF_KEYS.map(k => layout.cols[k]).filter(c => c);
  const targets = colNums.map(c => sheet.getRange(first, c, rows, 1));

  const touchesTarget = rule => rule.getRanges().some(r => colNums.some(c => r.getColumn() <= c && c <= r.getLastColumn()));
  const isBuySellText = rule => {
    const cond = rule.getBooleanCondition();
    if (!cond || cond.getCriteriaType() !== SpreadsheetApp.BooleanCriteria.TEXT_CONTAINS) return false;
    const v = String(cond.getCriteriaValues()[0] || "").trim().toUpperCase();
    return v === "BUY" || v === "SELL" || v === "WAIT" || v === "EXIT";
  };
  const kept = sheet.getConditionalFormatRules().filter(rule => !(touchesTarget(rule) && isBuySellText(rule)));

  const buyRule = SpreadsheetApp.newConditionalFormatRule().whenTextContains("BUY").setBackground(BUY_BG).setFontColor(WHITE).setBold(true).setRanges(targets).build();
  const sellRule = SpreadsheetApp.newConditionalFormatRule().whenTextContains("SELL").setBackground(SELL_BG).setFontColor(WHITE).setBold(true).setRanges(targets).build();
  const exitRule = SpreadsheetApp.newConditionalFormatRule().whenTextContains("EXIT").setBackground(SELL_BG).setFontColor(WHITE).setBold(true)
    .setRanges([sheet.getRange(first, layout.cols.action, rows, 1)]).build();
  const waitRule = SpreadsheetApp.newConditionalFormatRule().whenTextContains("WAIT").setBackground("#FFF3CD").setFontColor("#856404").setBold(true)
    .setRanges([sheet.getRange(first, layout.cols.action, rows, 1)]).build();

  sheet.setConditionalFormatRules([buyRule, sellRule, exitRule, waitRule].concat(kept));
}

function applyBuySellFormatting() {
  try {
    const sheet = _getSheet();
    const layout = _getLayout(sheet);
    _applyBuySellRules(sheet, layout);
    _alert("✅ ตั้งกฎสีเรียบร้อย\nBUY = พื้นเขียว / SELL,EXIT = พื้นแดง / WAIT (เฉพาะ ACTION) = พื้นเหลือง");
  } catch (e) {
    Logger.log(e.stack || e.message);
    _alert("❌ " + e.message);
  }
}

// ====================================================
// 🔍 หาเหรียญที่ผ่านครบ W → D → 4H แล้วเหลือแค่รอ ENTRY_TRIGGER(1H)
// ไม่จัดอันดับ ไม่บอกว่าตัวไหน "ดีที่สุด" — แค่คัดกรองตามลำดับชั้น
// แล้วเรียงตามชื่อเหรียญ (A-Z) เพื่อให้ดูง่าย
// ====================================================
function findPrimedForEntryTrigger() {
  try {
    const sheet = _getSheet();
    const layout = _getLayout(sheet);
    const first = layout.headerRow + 1;
    const last = _getLastSymbolRow(sheet, layout);
    const n = last - first + 1;
    if (n < 1) { _alert("ไม่พบรายชื่อเหรียญในชีต"); return; }

    const cols = layout.cols;
    const symbols = sheet.getRange(first, cols.symbol,         n, 1).getValues();
    const biasW   = sheet.getRange(first, cols.biasW,          n, 1).getValues();
    const setupD  = sheet.getRange(first, cols.setupD,         n, 1).getValues();
    const zone4h  = sheet.getRange(first, cols.entryZone4h,    n, 1).getValues();
    const trig1h  = sheet.getRange(first, cols.entryTrigger1h, n, 1).getValues();

    const primed = [];   // W+D+4H ผ่านหมด รอแค่ 1H
    const nearZone = []; // W+D ผ่าน แต่ 4H ยังไม่ยืนยันโซน (จับตาไว้)

    for (let i = 0; i < n; i++) {
      const sym = String(symbols[i][0]).trim();
      if (!sym) continue;

      const b = String(biasW[i][0]);
      const s = String(setupD[i][0]);
      const z = String(zone4h[i][0]);
      const t = String(trig1h[i][0]);

      // ตาม logic ของ calcActionMTF: ACTION=BUY เกิดได้เฉพาะ bias เป็น BULLISH เท่านั้น
      const wBullish  = b.indexOf("🟢 BULLISH") === 0;
      // setup ที่ "พร้อมซื้อ" ตาม calcActionMTF: READY / RECOVERY / PULLBACK
      const dReady    = s.indexOf("READY") !== -1 || s.indexOf("RECOVERY") !== -1 || s.indexOf("PULLBACK") !== -1;
      const zoneGreen = z.indexOf("🟢") === 0;   // 4H ยืนยันโซนแล้ว
      const stillWait = t.indexOf("🟡") === 0;   // 1H ยังไม่ trigger (WAIT/RETEST)
      const triggered = t.indexOf("🟢") === 0;   // 1H trigger แล้ว (กลายเป็น BUY ไปแล้ว)

      if (wBullish && dReady && zoneGreen && stillWait) {
        primed.push(`${sym}\tW:${b}\tD:${s}\t4H:${z}\t1H:${t}`);
      } else if (wBullish && dReady && !zoneGreen && !triggered) {
        nearZone.push(`${sym}\tW:${b}\tD:${s}\t4H:${z}`);
      }
    }

    primed.sort((a, b) => a.localeCompare(b));
    nearZone.sort((a, b) => a.localeCompare(b));

    let msg = "🟢 พร้อมครบ W→D→4H — เหลือรอ ENTRY_TRIGGER(1H) ก่อนเข้าซื้อ:\n";
    msg += primed.length ? primed.join("\n") : "(ยังไม่มีเหรียญไหนผ่านครบในตอนนี้)";
    msg += "\n\n🟡 W→D ผ่านแล้ว แต่ 4H ยังไม่ยืนยันโซน (จับตาไว้ก่อน):\n";
    msg += nearZone.length ? nearZone.join("\n") : "(ไม่มี)";

    Logger.log(msg);
    _alert(msg);
  } catch (e) {
    Logger.log(e.stack || e.message);
    _alert("❌ " + e.message);
  }
}

// ====================================================
// 📲 Telegram — optional BUY notifications; credentials come from Script Properties
// ====================================================
const TELEGRAM_NOTIFY_ON_BUY_ONLY = true;
const PROP_NOTIFY_STATE = "BITKUB_NOTIFY_STATE";

function _telegramCredentials() {
  const properties = PropertiesService.getScriptProperties();
  return {
    token: properties.getProperty("TELEGRAM_BOT_TOKEN"),
    chatId: properties.getProperty("TELEGRAM_CHAT_ID")
  };
}

function _telegramConfigured() {
  const credentials = _telegramCredentials();
  return !!(credentials.token && credentials.chatId);
}

function _sendTelegram(text) {
  const credentials = _telegramCredentials();
  if (!credentials.token || !credentials.chatId) {
    Logger.log("[telegram] Not sent: configure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Script Properties.");
    return false;
  }

  const url = "https://api.telegram.org/bot" + credentials.token + "/sendMessage";
  try {
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        chat_id: credentials.chatId,
        text: text,
        parse_mode: "HTML",
        disable_web_page_preview: true
      }),
      muteHttpExceptions: true
    });
    let result;
    try {
      result = JSON.parse(response.getContentText());
    } catch (error) {
      Logger.log("[telegram] Invalid response (HTTP " + response.getResponseCode() + ").");
      return false;
    }
    if (response.getResponseCode() !== 200 || !result.ok) {
      Logger.log("[telegram] Send failed (HTTP " + response.getResponseCode() + "): " + (result.description || "API request failed."));
      return false;
    }
    return true;
  } catch (error) {
    Logger.log("[telegram] Send failed: " + error.message);
    return false;
  }
}

function _loadNotifyState() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty(PROP_NOTIFY_STATE);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    Logger.log("[notify state] Could not read saved state: " + error.message);
    return {};
  }
}

function _saveNotifyState(state) {
  try {
    PropertiesService.getScriptProperties().setProperty(PROP_NOTIFY_STATE, JSON.stringify(state));
  } catch (error) {
    Logger.log("[notify state] Could not save state: " + error.message);
  }
}

// Called after a batch is written; only newly changed BUY states are sent.
function _notifyTelegramForBuys(entries, out) {
  if (!_telegramConfigured()) return;
  const state = _loadNotifyState();
  let changed = false;

  entries.forEach((entry, index) => {
    if (!entry.sym) return;
    const actionCell = out.action[index];
    const actionValue = actionCell ? String(actionCell.v || "") : "";
    const isBuy = actionValue.indexOf("BUY") !== -1;

    if (TELEGRAM_NOTIFY_ON_BUY_ONLY && !isBuy) {
      if (state[entry.sym]) {
        delete state[entry.sym];
        changed = true;
      }
      return;
    }

    const previous = state[entry.sym];
    if (previous && previous.action === actionValue) return;

    const bias = out.biasW[index] ? out.biasW[index].v : "";
    const setup = out.setupD[index] ? out.setupD[index].v : "";
    const zone = out.entryZone4h[index] ? out.entryZone4h[index].v : "";
    const trigger = out.entryTrigger1h[index] ? out.entryTrigger1h[index].v : "";
    const stamp = Utilities.formatDate(new Date(), TIME_ZONE, TIME_FORMAT);
    const message =
      `📢 <b>${entry.sym}</b> — ${stamp}\n` +
      `W: ${bias}\nD: ${setup}\n4H: ${zone}\n1H: ${trigger}\n` +
      `➡️ ACTION: ${actionValue}`;

    if (_sendTelegram(message)) {
      state[entry.sym] = { action: actionValue };
      changed = true;
    }
  });

  if (changed) _saveNotifyState(state);
}

function testMtfsTelegramMessage() {
  if (!_telegramConfigured()) {
    _alert("❌ ตั้งค่า TELEGRAM_BOT_TOKEN และ TELEGRAM_CHAT_ID ใน Script Properties ก่อน");
    return;
  }
  if (!_sendTelegram("✅ ทดสอบ Telegram จาก All-Bitkub-BATCH MTFS สำเร็จ")) {
    throw new Error("Telegram test failed. ตรวจรายละเอียดใน Apps Script Executions.");
  }
  _alert("ส่งข้อความทดสอบไป Telegram แล้ว — ตรวจสอบแชตปลายทาง");
}

// ====================================================
// 🧪 ทดสอบ / Debug / Trigger
// ====================================================
function testBitkubFetch() {
  const pairs = ["BTC_THB", "ETH_THB", "KUB_THB"];
  const daily = _fetchHistories(pairs, "1D", HISTORY_DAYS_1D);
  const hourly = _fetchHistories(pairs, "60", HISTORY_DAYS_1H);
  let report = "🧪 ทดสอบดึงราคา Bitkub (Multi-Timeframe)\n\n";
  pairs.forEach((p, i) => {
    const d = daily[i], h = hourly[i];
    report += `— ${p} —\n`;
    if (!d.ok) { report += `  ❌ Daily: ${d.msg}\n\n`; return; }
    const wSeries = _buildTFSeries("W", d, h);
    const dSeries = _buildTFSeries("D", d, h);
    const h4Series = h && h.ok ? _buildTFSeries("4H", d, h) : null;
    const h1Series = h && h.ok ? _buildTFSeries("1H", d, h) : null;
    report += `  ✅ Daily ok — แท่ง W: ${wSeries.closes.length}, D: ${dSeries.closes.length}\n`;
    report += h && h.ok
      ? `  ✅ Hourly ok — แท่ง 4H: ${h4Series.closes.length}, 1H: ${h1Series.closes.length}\n`
      : `  ⚠️ Hourly: ${h && h.msg}\n`;
    report += `  ราคาล่าสุด (D): ${dSeries.closes[dSeries.closes.length - 1]} THB\n\n`;
  });
  const set = _loadThbPairs();
  report += set ? `📋 คู่เทรด THB บน Bitkub: ${Object.keys(set).length} คู่` : "⚠️ ดึงรายชื่อคู่เทรดไม่ได้ — จะลองยิงทุกเหรียญเอง";
  Logger.log(report);
  _alert(report);
}

function debugMTF(sym) {
  sym = String(sym || "AVAX").toUpperCase();
  const pair = sym + "_" + QUOTE_ASSET;
  const d = _fetchHistories([pair], "1D", HISTORY_DAYS_1D)[0];
  const h = _fetchHistories([pair], "60", HISTORY_DAYS_1H)[0];
  if (!d.ok) { _alert("❌ Daily: " + d.msg); return; }

  const btcSeries = _fetchBtcSeries();
  let report = `🔎 ${sym} — Multi-Timeframe\n\n`;
  let biasState = null, setupState = null, entryZoneLabel = null, entryTriggerLabel = null;

  TIMEFRAMES.forEach(tf => {
    const series = _buildTFSeries(tf, d, h && h.ok ? h : null);
    const cfg = TF_CONFIG[tf];
    if (!series || series.closes.length < 2) { report += `[${tf}] ข้อมูลไม่พอ\n`; return; }
    const refPrice = series.closes[series.closes.length - 1]; // ใช้แบบง่ายเพื่อ debug (ของจริงใน _buildRowCells ใช้ finer-TF)
    const res = _analyzeTF(series, refPrice, btcSeries[tf] ? btcSeries[tf].closeMap : null, cfg);

    let actionTFLabel = "";
    if (tf === "W")  { biasState = calcBiasW(res); actionTFLabel = _actionWStyle(calcActionW(biasState)).v; }
    if (tf === "D")  { setupState = calcSetupD(res, cfg); actionTFLabel = _actionDStyle(calcActionD(setupState)).v; }
    if (tf === "4H") { entryZoneLabel = calcStructure4h(res); actionTFLabel = _action4hStyle(calcAction4h(entryZoneLabel)).v; }
    if (tf === "1H") { entryTriggerLabel = calcEntry1h(res); actionTFLabel = _action1hStyle(calcAction1h(entryTriggerLabel)).v; }

    report += `[${tf}] แท่ง:${series.closes.length} RSI:${res.rsi} Structure:${res.structureState ? res.structureState.state : "WAIT"} ` +
      `SigEMA:${res.sigEma} SigVol:${res.sigVolume} RS:${res.rs} → ACTION(${tf})=${actionTFLabel}\n`;
  });

  const action = calcActionMTF(biasState, setupState, entryZoneLabel, entryTriggerLabel);
  report += `\nBIAS(W)=${biasState}  SETUP(D)=${setupState}\nENTRY_ZONE(4H)=${entryZoneLabel}  ENTRY_TRIGGER(1H)=${entryTriggerLabel}\n\n➡️ ACTION = ${_actionStyle(action).v || "(ว่าง)"}`;
  Logger.log(report);
  _alert(report);
}
function debugMTF_AVAX() { debugMTF("AVAX"); }

function createHourlyTrigger() {
  const hours = TRIGGER_EVERY_HOURS;
  if (!Number.isInteger(hours) || hours !== 1) {
    throw new Error("The MTFS sample is configured to update once per hour.");
  }
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === "updateAllBitkub")
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
  // Run shortly after the hourly candle closes; the fetch logic also excludes unfinished candles.
  ScriptApp.newTrigger("updateAllBitkub")
    .timeBased()
    .everyHours(hours)
    .nearMinute(2)
    .create();
  _alert("✅ ตั้ง Trigger เรียบร้อย — อัปเดตทุก 1 ชั่วโมง หลังแท่งปิดโดยประมาณ");
}
