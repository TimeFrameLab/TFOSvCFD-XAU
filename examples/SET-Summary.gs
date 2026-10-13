/**
 * Read prepared signals from All-SET-MTFS and write a separate SET-Summary tab.
 * This example is manual-only and does not fetch market data or place orders.
 */

const TFOSVS_SOURCE_SHEET = "All-SET-MTFS";
const TFOSVS_SUMMARY_SHEET = "SET-Summary";
const TFOSVS_SUMMARY_HEADERS = [
  "GROUP",
  "หุ้น (Finnomena)",
  "PRICE",
  "TREND(W)",
  "RSI(W)",
  "TREND(D)",
  "RSI(D)",
  "TREND(4H)",
  "RSI(4H)",
  "TREND(1H)",
  "RSI(1H)",
  "ACTION"
];
const TFOSVS_SOURCE_HEADERS = [
  "GROUP",
  "AKA",
  "PRICE",
  "TREND(W)",
  "RSI(W)",
  "TREND(D)",
  "RSI(D)",
  "TREND(4H)",
  "RSI(4H)",
  "TREND(1H)",
  "RSI(1H)",
  "MACD_HIST_DELTA(W)",
  "RELATIVE_STRENGTH(W)",
  "RELATIVE_STRENGTH(D)",
  "RELATIVE_STRENGTH(4H)",
  "RELATIVE_STRENGTH(1H)",
  "ACTION"
];
const TFOSVS_TREND_HEADERS = ["TREND(W)", "TREND(D)", "TREND(4H)", "TREND(1H)"];
const TFOSVS_RSI_HEADERS = ["RSI(W)", "RSI(D)", "RSI(4H)", "RSI(1H)"];
const TFOSVS_RS_HEADERS = [
  "RELATIVE_STRENGTH(W)",
  "RELATIVE_STRENGTH(D)",
  "RELATIVE_STRENGTH(4H)",
  "RELATIVE_STRENGTH(1H)"
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("TFOSvS | SET")
    .addItem("สร้าง/ตรวจหัวตาราง Summary", "setupSetSummary")
    .addItem("อัปเดต SET-Summary", "refreshSetSummary")
    .addToUi();
}

function setupSetSummary() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let summary = spreadsheet.getSheetByName(TFOSVS_SUMMARY_SHEET);
  if (!summary) {
    summary = spreadsheet.insertSheet(TFOSVS_SUMMARY_SHEET);
  }

  const lastRow = summary.getLastRow();
  const lastColumn = summary.getLastColumn();
  if (lastRow === 0 && lastColumn === 0) {
    summary.getRange(1, 1, 1, TFOSVS_SUMMARY_HEADERS.length)
      .setValues([TFOSVS_SUMMARY_HEADERS]);
  } else {
    if (lastColumn !== TFOSVS_SUMMARY_HEADERS.length) {
      throw new Error(
        'แท็บ "' + TFOSVS_SUMMARY_SHEET +
        '" มีข้อมูลอยู่และจำนวนคอลัมน์ไม่ตรง schema; ไม่มีการแก้ไขข้อมูล'
      );
    }
    const existingHeaders = summary.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
    if (existingHeaders.some((header, index) => header !== TFOSVS_SUMMARY_HEADERS[index])) {
      throw new Error(
        'หัวตาราง "' + TFOSVS_SUMMARY_SHEET +
        '" ไม่ตรง schema; ไม่มีการแก้ไขข้อมูล'
      );
    }
  }

  summary.setFrozenRows(1);
  summary.getRange(1, 1, 1, TFOSVS_SUMMARY_HEADERS.length)
    .setFontWeight("bold")
    .setBackground("#1F4E79")
    .setFontColor("#FFFFFF");
  summary.getRange("C:C").setNumberFormat("#,##0.00####");
  summary.autoResizeColumns(1, TFOSVS_SUMMARY_HEADERS.length);
  SpreadsheetApp.getActiveSpreadsheet().toast(
    'ตรวจสอบหัวตาราง "' + TFOSVS_SUMMARY_SHEET + '" แล้ว',
    "TFOSvS | SET",
    5
  );
}

function refreshSetSummary() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(1000)) {
    throw new Error("มีการอัปเดต SET-Summary ทำงานอยู่แล้ว; รอบนี้ไม่ได้เริ่ม");
  }

  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const source = spreadsheet.getSheetByName(TFOSVS_SOURCE_SHEET);
    if (!source) {
      throw new Error('ไม่พบแท็บต้นทาง "' + TFOSVS_SOURCE_SHEET + '"');
    }

    const lastRow = source.getLastRow();
    const lastColumn = source.getLastColumn();
    if (lastRow < 1 || lastColumn < 1) {
      throw new Error('แท็บต้นทาง "' + TFOSVS_SOURCE_SHEET + '" ว่าง');
    }

    const sourceValues = source.getRange(1, 1, lastRow, lastColumn).getValues();
    const sourceHeaders = sourceValues[0].map((header) => String(header || "").trim());
    const columns = {};
    const requiredHeaders = new Set(TFOSVS_SOURCE_HEADERS);
    sourceHeaders.forEach((header, index) => {
      if (!header) return;
      if (
        Object.prototype.hasOwnProperty.call(columns, header) &&
        requiredHeaders.has(header)
      ) {
        throw new Error('หัวคอลัมน์ "' + header + '" ซ้ำในแท็บต้นทาง');
      }
      if (!Object.prototype.hasOwnProperty.call(columns, header)) {
        columns[header] = index;
      }
    });

    const missingHeaders = TFOSVS_SOURCE_HEADERS.filter(
      (header) => !Object.prototype.hasOwnProperty.call(columns, header)
    );
    if (missingHeaders.length) {
      throw new Error("ขาดหัวคอลัมน์ต้นทาง: " + missingHeaders.join(", "));
    }

    const errors = [];
    const seenSymbols = new Set();
    const records = [];
    sourceValues.slice(1).forEach((row, index) => {
      if (row.every((value) => value === "" || value === null)) return;
      const rowNumber = index + 2;
      const rawSymbol = row[columns.AKA];
      const symbol = typeof rawSymbol === "string" ? rawSymbol.trim().toUpperCase() : "";
      if (!symbol || !/^[A-Z0-9][A-Z0-9.&_-]{0,19}$/.test(symbol)) {
        errors.push("แถว " + rowNumber + ": AKA ว่างหรือรูปแบบไม่ถูกต้อง");
      } else if (seenSymbols.has(symbol)) {
        errors.push("แถว " + rowNumber + ": AKA " + symbol + " ซ้ำ");
      } else {
        seenSymbols.add(symbol);
      }

      const group = row[columns.GROUP];
      if (group === "" || group === null || String(group).trim() === "") {
        errors.push("แถว " + rowNumber + ": GROUP ว่าง");
      }

      TFOSVS_TREND_HEADERS.concat(TFOSVS_RS_HEADERS).forEach((header) => {
        const value = row[columns[header]];
        if (value === "" || value === null || String(value).trim() === "") {
          errors.push("แถว " + rowNumber + ": " + header + " ว่าง");
        }
      });

      const price = row[columns.PRICE];
      if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
        errors.push("แถว " + rowNumber + ": PRICE ต้องเป็นตัวเลขที่มากกว่า 0");
      }

      TFOSVS_RSI_HEADERS.forEach((header) => {
        const value = row[columns[header]];
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
          errors.push("แถว " + rowNumber + ": " + header + " ต้องเป็นตัวเลขระหว่าง 0 ถึง 100");
        }
      });

      const macdDelta = row[columns["MACD_HIST_DELTA(W)"]];
      if (typeof macdDelta !== "number" || !Number.isFinite(macdDelta)) {
        errors.push("แถว " + rowNumber + ": MACD_HIST_DELTA(W) ต้องเป็นตัวเลข finite");
      }

      if (symbol) records.push({ row: row, symbol: symbol, rowNumber: rowNumber });
    });

    if (records.length === 0) {
      errors.push("ไม่พบแถวข้อมูลหุ้น");
    }
    if (errors.length) {
      throw new Error(
        "ตรวจข้อมูลต้นทางไม่ผ่าน (" + errors.length + " รายการ):\n" +
        errors.slice(0, 20).join("\n") +
        (errors.length > 20 ? "\nและข้อผิดพลาดอื่นอีก " + (errors.length - 20) + " รายการ" : "")
      );
    }

    const summary = spreadsheet.getSheetByName(TFOSVS_SUMMARY_SHEET);
    if (!summary) {
      throw new Error(
        'ไม่พบแท็บ "' + TFOSVS_SUMMARY_SHEET +
        '"; ให้เลือกเมนู "สร้าง/ตรวจหัวตาราง Summary" ก่อน'
      );
    }
    if (summary.getLastColumn() !== TFOSVS_SUMMARY_HEADERS.length) {
      throw new Error('จำนวนคอลัมน์ใน "' + TFOSVS_SUMMARY_SHEET + '" ไม่ตรง schema');
    }
    const summaryHeaders = summary
      .getRange(1, 1, 1, TFOSVS_SUMMARY_HEADERS.length)
      .getDisplayValues()[0];
    if (summaryHeaders.some((header, index) => header !== TFOSVS_SUMMARY_HEADERS[index])) {
      throw new Error('หัวตาราง "' + TFOSVS_SUMMARY_SHEET + '" ไม่ตรง schema');
    }

    const outputRows = records.map(({ row, symbol }) => [
      tfosvsTextValue(row[columns.GROUP]),
      symbol,
      row[columns.PRICE],
      ...TFOSVS_TREND_HEADERS.map((header) => tfosvsTextValue(row[columns[header]])),
      ...TFOSVS_RSI_HEADERS.map((header) => row[columns[header]]),
      tfosvsTextValue(row[columns.ACTION])
    ]);
    const outputSize = Math.max(summary.getLastRow() - 1, outputRows.length, 0);
    if (outputSize > 0) {
      summary.getRange(2, 1, outputSize, TFOSVS_SUMMARY_HEADERS.length).clearContent();
    }
    if (outputRows.length) {
      summary.getRange(2, 1, outputRows.length, TFOSVS_SUMMARY_HEADERS.length)
        .setValues(outputRows);
      const links = records.map(({ symbol }) => [
        SpreadsheetApp.newRichTextValue()
          .setText(symbol)
          .setLinkUrl("https://www.finnomena.com/stock/" + encodeURIComponent(symbol) + "/advance")
          .build()
      ]);
      summary.getRange(2, 2, links.length, 1).setRichTextValues(links);
    }

    setupSetSummary();
    SpreadsheetApp.getActiveSpreadsheet().toast(
      "อัปเดต SET-Summary แล้ว (" + outputRows.length + " หุ้น); แท็บต้นทางไม่ถูกแก้ไข",
      "TFOSvS | SET",
      6
    );
  } finally {
    lock.releaseLock();
  }
}

function tfosvsTextValue(value) {
  const text = String(value === null || value === undefined ? "" : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}
