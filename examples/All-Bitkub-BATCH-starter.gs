/**
 * Starter helpers for an All-Bitkub-BATCH Google Sheet.
 *
 * This file creates the requested header row and provides a guarded helper
 * for writing analysis fields to existing coin rows. Add your own market-data
 * fetching and calculation logic before using it as an updater.
 */

const ALL_BITKUB_SHEET_NAME = "All-Bitkub-BATCH";

const ALL_BITKUB_HEADERS = [
  "FLAG", "TIER", "IMAGE", "TV", "IMAGEurl", "CDN", "PNG", "AKA",
  "TREND(W)", "RSI(W)", "MACD_HIST(W)", "MACD_HIST_PREV(W)",
  "MACD_HIST_DELTA(W)", "MACD(W)", "MACD_SIGNAL(W)", "EMA9(W)",
  "EMA21(W)", "EMA_GAP(W)", "SIGNAL_RSI(W)", "SIGNAL_MACD(W)",
  "SIGNAL_EMA9X21(W)", "SIGNAL_VOLUME(W)", "PRICE_STRUCTURE(W)",
  "RELATIVE_STRENGTH(W)", "ACTION(W)", "RSI(D)", "MACD_HIST(D)",
  "MACD_HIST_PREV(D)", "MACD(D)", "MACD_SIGNAL(D)", "EMA9(D)",
  "EMA21(D)", "EMA_GAP(D)", "SIGNAL_RSI(D)", "SIGNAL_MACD(D)",
  "SIGNAL_EMA9X21(D)", "SIGNAL_VOLUME(D)", "PRICE_STRUCTURE(D)",
  "RELATIVE_STRENGTH(D)", "ACTION(D)", "TREND(4H)", "RSI(4H)",
  "MACD_HIST(4H)", "MACD_HIST_PREV(4H)", "MACD_HIST_DELTA(4H)",
  "MACD(4H)", "MACD_SIGNAL(4H)", "EMA9(4H)", "EMA21(4H)",
  "EMA_GAP(4H)", "SIGNAL_RSI(4H)", "SIGNAL_MACD(4H)",
  "SIGNAL_EMA9X21(4H)", "SIGNAL_VOLUME(4H)", "PRICE_STRUCTURE(4H)",
  "RELATIVE_STRENGTH(4H)", "ENTRY_ZONE(4H)", "ACTION(4H)", "TREND(1H)",
  "RSI(1H)", "MACD_HIST(1H)", "MACD_HIST_PREV(1H)",
  "MACD_HIST_DELTA(1H)", "MACD(1H)", "MACD_SIGNAL(1H)", "EMA9(1H)",
  "EMA21(1H)", "EMA_GAP(1H)", "SIGNAL_RSI(1H)", "SIGNAL_MACD(1H)",
  "SIGNAL_EMA9X21(1H)", "SIGNAL_VOLUME(1H)", "PRICE_STRUCTURE(1H)",
  "RELATIVE_STRENGTH(1H)", "ENTRY_TRIGGER(1H)", "ACTION(1H)", "BIAS(W)",
  "SETUP(D)", "ENTRY_ZONE(4H)", "ENTRY_TRIGGER(1H)", "ACTION", "COST",
  "QUANTITY", "PRICE", "PROFIT", "NET", "URL", "LAST_CANDLE", "UPDATED",
  "Source"
];

const ALL_BITKUB_PROTECTED_HEADERS = new Set([
  "AKA", "COST", "QUANTITY", "PROFIT", "NET"
]);

/**
 * Creates the sheet and its headers only when the sheet is empty.
 * Does not modify an existing sheet.
 */
function setupAllBitkubBatchSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(ALL_BITKUB_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(ALL_BITKUB_SHEET_NAME);
  }

  if (sheet.getLastRow() > 0 || sheet.getLastColumn() > 0) {
    throw new Error(
      'Sheet "' + ALL_BITKUB_SHEET_NAME +
      '" is not empty. Use a blank sheet or verify its headers manually; ' +
      "no cells were changed."
    );
  }

  sheet.getRange(1, 1, 1, ALL_BITKUB_HEADERS.length)
    .setValues([ALL_BITKUB_HEADERS]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, ALL_BITKUB_HEADERS.length).setFontWeight("bold");
  spreadsheet.toast("Header row created.", ALL_BITKUB_SHEET_NAME, 5);
}

/**
 * Updates analysis fields for existing coins.
 *
 * @param {Array<{symbol: string, values: Object}>} updates
 *   Each `values` key must be a unique header name, or a duplicate-header
 *   selector such as "ENTRY_ZONE(4H)#2". Values are written only to supplied
 *   columns; protected portfolio columns are always rejected.
 */
function writeAllBitkubAnalysisUpdates(updates) {
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new Error("Provide a non-empty array of coin updates.");
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(ALL_BITKUB_SHEET_NAME);
  if (!sheet) {
    throw new Error('Sheet "' + ALL_BITKUB_SHEET_NAME + '" was not found.');
  }

  const lastColumn = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  if (lastColumn !== ALL_BITKUB_HEADERS.length || lastRow < 1) {
    throw new Error("The sheet is empty or its column count does not match the template.");
  }

  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  if (headers.some((header, index) => header !== ALL_BITKUB_HEADERS[index])) {
    throw new Error("Sheet headers do not match the starter schema and order.");
  }

  const columnsByHeader = new Map();
  headers.forEach((header, index) => {
    const positions = columnsByHeader.get(header) || [];
    positions.push(index + 1);
    columnsByHeader.set(header, positions);
  });

  const symbolColumn = columnsByHeader.get("AKA")[0];
  const rowBySymbol = new Map();
  if (lastRow > 1) {
    sheet.getRange(2, symbolColumn, lastRow - 1, 1)
      .getDisplayValues()
      .forEach((row, index) => {
        const symbol = row[0].trim();
        if (!symbol) return;
        if (rowBySymbol.has(symbol)) {
          throw new Error('Duplicate AKA "' + symbol + '" found in the sheet.');
        }
        rowBySymbol.set(symbol, index + 2);
      });
  }

  const preparedWrites = [];
  updates.forEach((update) => {
    if (!update || typeof update.symbol !== "string" || !update.symbol.trim()) {
      throw new Error("Each update must include a non-empty symbol.");
    }
    if (!update.values || typeof update.values !== "object" || Array.isArray(update.values)) {
      throw new Error('Update for "' + update.symbol + '" must include a values object.');
    }

    const row = rowBySymbol.get(update.symbol.trim());
    if (!row) {
      throw new Error(
        'Coin "' + update.symbol + '" was not found. This helper does not add rows.'
      );
    }

    Object.keys(update.values).forEach((selector) => {
      const match = selector.match(/^(.*)#([1-9]\d*)$/);
      const header = match ? match[1] : selector;
      const occurrence = match ? Number(match[2]) : 1;

      if (ALL_BITKUB_PROTECTED_HEADERS.has(header)) {
        throw new Error('Refusing to write protected column "' + header + '".');
      }

      const positions = columnsByHeader.get(header);
      if (!positions) {
        throw new Error('Unknown column "' + header + '".');
      }
      if (!match && positions.length > 1) {
        throw new Error(
          'Column "' + header + '" appears more than once; specify it as "' +
          header + '#1", "' + header + '#2", etc.'
        );
      }
      if (occurrence > positions.length) {
        throw new Error('Column selector "' + selector + '" does not exist.');
      }

      preparedWrites.push({
        row: row,
        column: positions[occurrence - 1],
        value: update.values[selector]
      });
    });
  });

  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    preparedWrites.forEach((write) => {
      sheet.getRange(write.row, write.column).setValue(write.value);
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Sends a Telegram message using credentials stored in Apps Script properties.
 * Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Project Settings first.
 *
 * @param {string} text Plain-text message to send.
 */
function sendTelegramMessage(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Telegram message must not be empty.");
  }

  const properties = PropertiesService.getScriptProperties();
  const token = properties.getProperty("TELEGRAM_BOT_TOKEN");
  const chatId = properties.getProperty("TELEGRAM_CHAT_ID");
  if (!token || !chatId) {
    throw new Error(
      "Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Apps Script Project Settings > Script Properties."
    );
  }

  const response = UrlFetchApp.fetch(
    "https://api.telegram.org/bot" + token + "/sendMessage",
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ chat_id: chatId, text: text }),
      muteHttpExceptions: true
    }
  );
  const statusCode = response.getResponseCode();
  let result;
  try {
    result = JSON.parse(response.getContentText());
  } catch (error) {
    throw new Error("Telegram returned an invalid response (HTTP " + statusCode + ").");
  }

  if (!result || typeof result !== "object") {
    throw new Error("Telegram returned an invalid response (HTTP " + statusCode + ").");
  }
  if (statusCode !== 200 || !result.ok) {
    const detail = result.description || "Telegram request failed.";
    throw new Error("Telegram API error (HTTP " + statusCode + "): " + detail);
  }
}

function testTelegramMessage() {
  sendTelegramMessage("Test message from All-Bitkub-BATCH Apps Script.");
  Logger.log("Telegram test message sent.");
}
