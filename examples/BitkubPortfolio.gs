/**
 * Bitkub Portfolio Monitor example for Google Apps Script.
 *
 * Setup:
 * 1. Bind this script to a Google Sheet and run setupBitkubPortfolioSheet().
 * 2. Add REF_SHEET_URL, BITKUB_API_KEY, and BITKUB_API_SECRET in
 *    Project Settings > Script Properties.
 * 3. Live orders are disabled by default. Set
 *    BITKUB_ENABLE_LIVE_STOPLOSS=true only after reviewing and testing.
 *
 * This sample uses Bitkub API directly; Apps Script cannot execute the
 * repository's local trade.sh or cancel.sh scripts.
 */

const BP_SHEET_NAME = "BitkubPortfolio";
const BP_HEADERS = [
  "Currency",
  "Source",
  "Tier",
  "Total",
  "ราคาซื้อเฉลี่ย (รวมค่าธรรมเนียม)",
  "ราคาล่าสุด",
  "มูลค่า (THB)",
  "กำไร/ขาดทุน (หักค่าธรรมเนียม)",
  "%P/L(Monitor)",
  "%STOPLOSS(SET)",
  "ราคา Limit (THB)",
  "ปริมาณในคำสั่ง",
  "Remark"
];
const BP_BASE_URL = "https://api.bitkub.com";
const BP_DEFAULT_STOPLOSS = 35;
const BP_HISTORY_PAGE_LIMIT = 500;
const BP_PROPERTY_SCHEDULE_MINUTES = "BP_SCHEDULE_MINUTES";
const BP_PROPERTY_LAST_UPDATE = "BP_LAST_UPDATE_MS";
const BP_STOPLOSS_STATE_PREFIX = "BP_STOPLOSS_STATE_";

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Bitkub Portfolio")
    .addItem("อัพเดท Portfolio", "updateBitkubPortfolio")
    .addSeparator()
    .addItem("ตั้งค่า Triger 5 นาที", "setBitkubPortfolioTrigger5")
    .addItem("ตั้งค่า Triger 15 นาที", "setBitkubPortfolioTrigger15")
    .addItem("ตั้งค่า Triger 30 นาที", "setBitkubPortfolioTrigger30")
    .addItem("ตั้งค่า Triger 45 นาที", "setBitkubPortfolioTrigger45")
    .addItem("ตั้งค่า Triger 60 นาที", "setBitkubPortfolioTrigger60")
    .addItem("ล้างการตั้งค่า Triger", "clearBitkubPortfolioTriggers")
    .addToUi();
}

function setupBitkubPortfolioSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(BP_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(BP_SHEET_NAME);

  if (sheet.getLastRow() > 0 || sheet.getLastColumn() > 0) {
    const existing = sheet.getRange(1, 1, 1, BP_HEADERS.length).getDisplayValues()[0];
    if (existing.some((value, index) => value !== BP_HEADERS[index])) {
      throw new Error(
        'ชีท "' + BP_SHEET_NAME + '" มีข้อมูลหรือหัวตารางไม่ตรงกัน; ' +
        "จะไม่เขียนทับชีทที่มีอยู่"
      );
    }
  } else {
    sheet.getRange(1, 1, 1, BP_HEADERS.length).setValues([BP_HEADERS]);
  }

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, BP_HEADERS.length).setFontWeight("bold");
  sheet.getRange(2, 9, Math.max(sheet.getMaxRows() - 1, 1), 1)
    .setNumberFormat("0.00%");
  sheet.getRange(2, 10, Math.max(sheet.getMaxRows() - 1, 1), 1)
    .setNumberFormat('0.##"%"');
  SpreadsheetApp.getActiveSpreadsheet().toast(
    "ตรวจสอบ/สร้างหัวตารางแล้ว; ค่า Stop Loss เริ่มต้นจะเติมเมื่ออัพเดทข้อมูล",
    BP_SHEET_NAME,
    6
  );
}

function updateBitkubPortfolio() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(1000)) {
    throw new Error("มีการอัพเดท Portfolio ทำงานอยู่แล้ว; รอบนี้ไม่ได้เริ่ม");
  }

  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName(BP_SHEET_NAME);
    if (!sheet) {
      throw new Error('ไม่พบชีท "' + BP_SHEET_NAME + '"; กรุณารัน setupBitkubPortfolioSheet()');
    }
    bpValidateHeaders(sheet);

    const oldRows = bpReadExistingRows(sheet);
    const properties = PropertiesService.getScriptProperties();
    const credentials = bpGetCredentials(properties);
    const reference = bpLoadReference(properties.getProperty("REF_SHEET_URL"));
    const wallet = bpApiRequest(credentials, "GET", "/api/v4/wallet/balances");
    const tickerResponse = bpPublicRequest("/api/v3/market/ticker");
    const symbolsResponse = bpPublicRequest("/api/v3/market/symbols");
    const balances = bpGetArray(wallet, ["data", "result"], "wallet balances");
    const tickers = bpGetArray(tickerResponse, ["result", "data"], "ticker");
    const symbols = bpGetArray(symbolsResponse, ["result", "data"], "symbols");
    const tickerBySymbol = new Map();
    tickers.forEach((ticker) => {
      if (ticker && ticker.symbol) tickerBySymbol.set(String(ticker.symbol).toUpperCase(), ticker);
    });
    const symbolByCoin = new Map();
    symbols.forEach((item) => {
      if (item && item.symbol) {
        symbolByCoin.set(String(item.symbol).toUpperCase().replace(/_THB$/, ""), item);
      }
    });

    const rows = [];
    let thbBalance = 0;
    balances.forEach((balance) => {
      if (!balance || typeof balance.currency !== "string") {
        throw new Error("Wallet response มีรายการที่ไม่มี currency");
      }
      const coin = balance.currency.toUpperCase();
      const total = bpNumber(balance.total, "wallet total for " + coin);
      if (coin === "THB") {
        thbBalance = total;
        return;
      }
      if (total <= 0) return;

      const market = tickerBySymbol.get(coin + "_THB");
      const last = market ? bpNumber(market.last, "ticker last for " + coin) : 0;
      const value = last > 0 ? total * last : 0;
      const history = bpTryOrderHistory(credentials, coin);
      const historyResult = history.ok
        ? bpAverageBuyCost(history.orders, total, symbolByCoin.get(coin))
        : { average: null, error: history.error };
      const cost = historyResult.average;
      const pnl = cost !== null && last > 0 ? value - cost * total : null;
      const pnlRatio = pnl !== null && cost * total > 0 ? pnl / (cost * total) : null;
      const previous = oldRows.get(coin);
      const stopLoss = previous && Number.isFinite(previous.stopLoss) && previous.stopLoss >= 0
        ? previous.stopLoss
        : BP_DEFAULT_STOPLOSS;
      const openOrders = bpTryOpenOrders(credentials, coin);
      let remark = historyResult.error || "";
      let limitPrices = "—";
      let limitAmounts = "—";
      if (openOrders.ok) {
        const sellLimits = openOrders.orders.filter((order) =>
          String(order.side).toLowerCase() === "sell" &&
          String(order.type).toLowerCase() === "limit"
        );
        if (sellLimits.length) {
          limitPrices = sellLimits.map((order) => bpDisplayValue(order.price)).join("\n");
          limitAmounts = sellLimits.map((order) => bpDisplayValue(order.amount)).join("\n");
        }
      } else {
        remark = bpJoinRemark(remark, "Open Orders N/A (" + openOrders.error + ")");
      }

      const ref = reference.get(coin) || {};
      const row = [
        coin,
        ref.source || (symbolByCoin.get(coin) && symbolByCoin.get(coin).source) || "N/A",
        ref.tier || "N/A",
        total,
        cost === null ? "N/A" : cost,
        last > 0 ? last : "N/A",
        value > 0 ? value : "N/A",
        pnl === null ? "N/A" : pnl,
        pnlRatio === null ? "N/A" : pnlRatio,
        stopLoss,
        limitPrices,
        limitAmounts,
        remark || "—"
      ];
      rows.push({
        coin: coin,
        row: row,
        pnlRatio: pnlRatio,
        stopLoss: stopLoss,
        marketValue: value
      });
    });

    rows.sort((a, b) => b.marketValue - a.marketValue);
    if (thbBalance > 0) {
      rows.push({
        coin: "THB",
        row: ["THB", "—", "—", thbBalance, "—", 1, thbBalance, "—", "—", "", "—", "—", "—"],
        pnlRatio: null,
        stopLoss: null
      });
    }

    const values = [BP_HEADERS].concat(rows.map((item) => item.row));
    sheet.clearContents();
    sheet.getRange(1, 1, values.length, BP_HEADERS.length).setValues(values);
    sheet.setFrozenRows(1);
    if (rows.length) {
      sheet.getRange(2, 9, rows.length, 1).setNumberFormat("0.00%");
      sheet.getRange(2, 10, rows.length, 1).setNumberFormat('0.##"%"');
      sheet.getRange(2, 5, rows.length, 4).setNumberFormat("#,##0.00########");
      sheet.getRange(2, 11, rows.length, 2).setWrap(true);
    }
    SpreadsheetApp.flush();

    const liveEnabled = properties.getProperty("BITKUB_ENABLE_LIVE_STOPLOSS") === "true";
    rows.forEach((item, index) => {
      if (item.coin === "THB" || item.pnlRatio === null) return;
      if (item.pnlRatio >= -(item.stopLoss / 100)) return;
      const remark = bpRunStopLoss(
        credentials,
        item.coin,
        item.stopLoss,
        item.pnlRatio,
        liveEnabled,
        properties
      );
      const currentRemark = sheet.getRange(index + 2, 13).getDisplayValue();
      sheet.getRange(index + 2, 13).setValue(bpJoinRemark(
        currentRemark === "—" ? "" : currentRemark,
        remark
      ) || "—");
    });

    properties.setProperty(BP_PROPERTY_LAST_UPDATE, String(Date.now()));
    SpreadsheetApp.flush();
    spreadsheet.toast("อัพเดท Portfolio สำเร็จ (" + rows.length + " แถว)", BP_SHEET_NAME, 6);
  } finally {
    lock.releaseLock();
  }
}

function bpRunStopLoss(credentials, coin, stopLoss, pnlRatio, liveEnabled, properties) {
  const label = "STOPLOSS " + coin + ": P/L=" + (pnlRatio * 100).toFixed(2) +
    "%, threshold=-" + stopLoss + "%";
  if (!liveEnabled) return label + " | DRY RUN: ไม่ได้ยกเลิกหรือส่งคำสั่ง";

  const stateKey = BP_STOPLOSS_STATE_PREFIX + coin;
  const existingState = properties.getProperty(stateKey);
  if (existingState) return label + " | ไม่ส่งซ้ำ; state=" + existingState;

  try {
    let orders = bpFetchOpenOrders(credentials, coin);
    orders.forEach((order) => bpCancelOrder(credentials, coin, order));
    orders = bpFetchOpenOrders(credentials, coin);
    if (orders.length) {
      throw new Error("ยังพบ Open Orders " + orders.length + " รายการหลังยกเลิก");
    }

    const balanceResponse = bpApiRequest(
      credentials,
      "GET",
      "/api/v4/wallet/balances"
    );
    const balanceRows = bpGetArray(balanceResponse, ["data", "result"], "wallet balance " + coin);
    const balance = balanceRows.find((entry) =>
      entry && String(entry.currency).toUpperCase() === coin
    );
    const available = balance ? bpNumber(balance.available, "available balance " + coin) : 0;
    if (available <= 0) return label + " | ยกเลิกคำสั่งแล้ว แต่ไม่มี available balance ให้ขาย";

    const symbolResponse = bpPublicRequest("/api/v3/market/symbols");
    const symbolRows = bpGetArray(symbolResponse, ["result", "data"], "symbols");
    const symbol = symbolRows.find((entry) =>
      entry && String(entry.symbol || "").toUpperCase() === coin + "_THB"
    );
    if (!symbol || !Number.isInteger(Number(symbol.base_asset_scale))) {
      throw new Error("อ่าน base_asset_scale ของ " + coin + "_THB ไม่ได้");
    }
    const quantity = bpFloorToScale(available, Number(symbol.base_asset_scale));
    if (!(quantity > 0)) return label + " | available ต่ำกว่าความละเอียดที่ขายได้";

    // Persist before POST so an interrupted/ambiguous request cannot be retried blindly.
    properties.setProperty(stateKey, "SUBMITTING|" + new Date().toISOString());
    let response;
    try {
      response = bpApiRequest(credentials, "POST", "/api/v3/market/place-ask", {
        sym: coin.toLowerCase() + "_thb",
        amt: quantity,
        rat: 0,
        typ: "market"
      });
    } catch (error) {
      if (error.ambiguous === false) {
        properties.deleteProperty(stateKey);
        return label + " | Bitkub ปฏิเสธ Market Sell; สามารถตรวจสอบแล้วลองรอบถัดไป: " +
          error.message;
      }
      return label + " | ผลส่ง Market Sell ไม่แน่ชัด; กันการส่งซ้ำไว้: " + error.message;
    }

    const result = response.result;
    const orderId = result && (result.id || result.order_id);
    if (!orderId) {
      return label + " | API ตอบรับ/ผลไม่ชัดเจนแต่ไม่มี Order ID; กันการส่งซ้ำไว้";
    }
    const state = "SUBMITTED|" + new Date().toISOString() + "|" + orderId;
    properties.setProperty(stateKey, state);
    return label + " | Market Sell ส่งแล้ว; ID=" + orderId + "; amount=" + quantity;
  } catch (error) {
    return label + " | หยุดก่อนส่ง Market Sell: " + error.message;
  }
}

function bpAverageBuyCost(orders, walletTotal, symbol) {
  if (!Array.isArray(orders) || !orders.length) {
    return { average: null, error: "No Order History" };
  }
  if (!symbol || !Number.isInteger(Number(symbol.base_asset_scale))) {
    return { average: null, error: "Cost basis N/A (base_asset_scale unavailable)" };
  }

  const scale = Number(symbol.base_asset_scale);
  if (scale < 0 || scale > 18) {
    return { average: null, error: "Cost basis N/A (invalid base_asset_scale)" };
  }
  const unit = Math.pow(10, -scale);
  const events = [];
  const seenTransactions = new Set();
  let buyCount = 0;
  let quotePrecisionTolerance = 0;

  try {
    orders.forEach((order, index) => {
      if (!order || typeof order !== "object") throw new Error("invalid order record");
      const transactionId = order.txn_id;
      if (transactionId !== undefined && transactionId !== null) {
        if (seenTransactions.has(String(transactionId))) return;
        seenTransactions.add(String(transactionId));
      }
      const side = String(order.side || "").toLowerCase();
      const timestamp = Number(order.ts);
      const amount = bpNumber(order.amount, "order amount");
      if (!Number.isFinite(timestamp) || amount <= 0) throw new Error("invalid order time/amount");
      if (side === "buy") {
        const rate = bpNumber(order.rate, "buy rate");
        const fee = bpNumber(order.fee, "buy fee");
        const credit = bpNumber(order.credit, "buy credit");
        if (rate <= 0 || fee < 0 || credit < 0 || credit > fee) {
          throw new Error("invalid buy rate/fee/credit");
        }
        const quantity = Math.floor(((amount - fee + credit) / rate) / unit) * unit;
        if (quantity <= 0) throw new Error("buy quantity is not positive");
        [order.amount, order.fee, order.credit].forEach((value) => {
          if (Number(value) !== 0) {
            quotePrecisionTolerance += bpHalfPrecisionUnit(value) / rate;
          }
        });
        events.push({ timestamp: timestamp, index: index, side: side, quantity: quantity, cost: amount });
        buyCount++;
      } else if (side === "sell") {
        events.push({ timestamp: timestamp, index: index, side: side, quantity: amount, cost: 0 });
      } else {
        throw new Error("unknown order side");
      }
    });
  } catch (error) {
    return { average: null, error: "Cost basis N/A (" + error.message + ")" };
  }

  events.sort((a, b) => a.timestamp - b.timestamp || a.index - b.index);
  let held = 0;
  let costBasis = 0;
  let buySeen = false;
  let sellCount = 0;
  for (const event of events) {
    if (event.side === "buy") {
      buySeen = true;
      held += event.quantity;
      costBasis += event.cost;
    } else {
      if (event.quantity > held) {
        if (buySeen) return { average: null, error: "Cost basis N/A (sell exceeds known holdings)" };
        continue;
      }
      costBasis -= costBasis / held * event.quantity;
      held -= event.quantity;
      sellCount++;
    }
  }

  if (held <= 0 || costBasis <= 0) {
    return { average: null, error: "Cost basis N/A (no remaining purchased holdings)" };
  }
  const tolerance = unit * (buyCount + 1) + quotePrecisionTolerance;
  const difference = Math.abs(held - walletTotal);
  const floatingPointGuard = Number.EPSILON *
    Math.max(1, Math.abs(held), Math.abs(walletTotal), tolerance) *
    (orders.length + 2);
  if (difference > tolerance + floatingPointGuard) {
    return {
      average: null,
      error: "Cost basis N/A (wallet/history mismatch: " + difference + ")"
    };
  }
  const average = costBasis / (sellCount ? held : walletTotal);
  return Number.isFinite(average) && average > 0
    ? { average: average, error: "" }
    : { average: null, error: "Cost basis N/A (invalid average)" };
}

function bpTryOrderHistory(credentials, coin) {
  const orders = [];
  let cursor = "";
  const seenCursors = new Set();
  try {
    for (let page = 0; page < BP_HISTORY_PAGE_LIMIT; page++) {
      let query = "?sym=" + encodeURIComponent(coin.toLowerCase() + "_thb") +
        "&lmt=100&pagination_type=keyset";
      if (cursor) query += "&cursor=" + encodeURIComponent(cursor);
      const response = bpApiRequest(
        credentials,
        "GET",
        "/api/v3/market/my-order-history" + query
      );
      if (!Array.isArray(response.result)) throw new Error("invalid order-history result");
      orders.push.apply(orders, response.result);
      const pagination = response.pagination || {};
      if (!pagination.has_next) return { ok: true, orders: orders };
      cursor = String(pagination.cursor || "");
      if (!cursor || seenCursors.has(cursor)) throw new Error("invalid/repeated order-history cursor");
      seenCursors.add(cursor);
    }
    throw new Error("order-history page limit exceeded");
  } catch (error) {
    return { ok: false, orders: [], error: "Order History N/A (" + error.message + ")" };
  }
}

function bpTryOpenOrders(credentials, coin) {
  try {
    return { ok: true, orders: bpFetchOpenOrders(credentials, coin) };
  } catch (error) {
    return { ok: false, orders: [], error: error.message };
  }
}

function bpFetchOpenOrders(credentials, coin) {
  const response = bpApiRequest(
    credentials,
    "GET",
    "/api/v3/market/my-open-orders?sym=" +
      encodeURIComponent(coin.toLowerCase() + "_thb")
  );
  if (!Array.isArray(response.result)) throw new Error("Open Orders ไม่มี result ที่เป็นรายการ");
  return response.result.map((order, index) => {
    if (!order || typeof order !== "object") {
      throw new Error("Open Orders รายการที่ " + (index + 1) + " ผิดรูปแบบ");
    }
    const side = String(order.sd || order.side || "").toLowerCase();
    const id = order.id;
    const type = order.typ || order.type;
    const amount = order.amt !== undefined ? order.amt : order.amount;
    const price = String(type).toLowerCase() === "market"
      ? "Market"
      : (order.rat !== undefined ? order.rat : order.rate);
    if (!["buy", "sell"].includes(side) || id === undefined ||
        !/^[a-z0-9]+$/i.test(String(id)) || !type ||
        amount === undefined || (price === undefined && String(type).toLowerCase() !== "market")) {
      throw new Error("Open Orders รายการที่ " + (index + 1) + " ข้อมูลไม่ครบ");
    }
    return { id: String(id), side: side, type: String(type), amount: amount, price: price };
  });
}

function bpCancelOrder(credentials, coin, order) {
  bpApiRequest(credentials, "POST", "/api/v3/market/cancel-order", {
    sym: coin.toLowerCase() + "_thb",
    id: order.id,
    sd: order.side
  });
}

function bpApiRequest(credentials, method, pathAndQuery, bodyObject) {
  const timestampResponse = UrlFetchApp.fetch(BP_BASE_URL + "/api/v3/servertime", {
    muteHttpExceptions: true
  });
  const timestamp = String(timestampResponse.getContentText()).trim();
  if (timestampResponse.getResponseCode() < 200 || timestampResponse.getResponseCode() >= 300 ||
      !/^\d+$/.test(timestamp)) {
    throw new Error("อ่านเวลา Bitkub ไม่สำเร็จ (HTTP " + timestampResponse.getResponseCode() + ")");
  }

  const queryIndex = pathAndQuery.indexOf("?");
  const path = queryIndex < 0 ? pathAndQuery : pathAndQuery.substring(0, queryIndex);
  const query = queryIndex < 0 ? "" : pathAndQuery.substring(queryIndex);
  const body = bodyObject ? JSON.stringify(bodyObject) : "";
  const signaturePayload = timestamp + method + path + query + body;
  const signature = bpHmacHex(credentials.secret, signaturePayload);
  const options = {
    method: method.toLowerCase(),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-BTK-APIKEY": credentials.key,
      "X-BTK-TIMESTAMP": timestamp,
      "X-BTK-SIGN": signature
    },
    muteHttpExceptions: true
  };
  if (body) options.payload = body;
  const response = UrlFetchApp.fetch(BP_BASE_URL + pathAndQuery, options);
  const status = response.getResponseCode();
  let data;
  try {
    data = JSON.parse(response.getContentText());
  } catch (error) {
    throw new Error("Bitkub API ตอบ JSON ไม่ถูกต้อง (HTTP " + status + ")");
  }
  const apiCode = data && typeof data === "object"
    ? (data.error !== undefined ? data.error : data.code)
    : undefined;
  if (status < 200 || status >= 300 || apiCode === undefined || String(apiCode) !== "0") {
    const error = new Error(
      "Bitkub API error (HTTP " + status + ", code " +
      (apiCode === undefined ? "unavailable" : apiCode) + ")"
    );
    error.ambiguous = apiCode === undefined || String(apiCode) === "0";
    throw error;
  }
  return data;
}

function bpPublicRequest(path) {
  const response = UrlFetchApp.fetch(BP_BASE_URL + path, { muteHttpExceptions: true });
  const status = response.getResponseCode();
  let data;
  try {
    data = JSON.parse(response.getContentText());
  } catch (error) {
    throw new Error("Bitkub public API ตอบ JSON ไม่ถูกต้อง (HTTP " + status + ")");
  }
  if (status < 200 || status >= 300 || !data ||
      (!Array.isArray(data) && String(data.error) !== "0")) {
    throw new Error(
      "Bitkub public API error (HTTP " + status + ", code " +
      (data && data.error !== undefined ? data.error : "unavailable") + ")"
    );
  }
  return data;
}

function bpHmacHex(secret, payload) {
  return Utilities.computeHmacSha256Signature(payload, secret)
    .map((byte) => ("0" + ((byte + 256) % 256).toString(16)).slice(-2))
    .join("");
}

function bpGetCredentials(properties) {
  const key = properties.getProperty("BITKUB_API_KEY");
  const secret = properties.getProperty("BITKUB_API_SECRET");
  if (!key || !secret) {
    throw new Error("กรุณาตั้ง BITKUB_API_KEY และ BITKUB_API_SECRET ใน Script Properties");
  }
  return { key: key, secret: secret };
}

function bpLoadReference(url) {
  if (!url) throw new Error("กรุณาตั้ง REF_SHEET_URL ใน Script Properties");
  const idMatch = url.match(/\/spreadsheets\/d\/([^/]+)/);
  if (!idMatch) throw new Error("REF_SHEET_URL ไม่มี Spreadsheet ID ที่ถูกต้อง");
  const spreadsheet = SpreadsheetApp.openById(idMatch[1]);
  const sheet = spreadsheet.getSheetByName("All-Bitkub-BATCH");
  if (!sheet || sheet.getLastRow() < 1) {
    throw new Error('ไม่พบชีท "All-Bitkub-BATCH" ใน REF Sheet');
  }
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0].map((value) => String(value).trim().toUpperCase());
  const akaColumn = headers.indexOf("AKA");
  const sourceColumn = headers.indexOf("SOURCE");
  const tierColumn = headers.indexOf("TIER");
  if (akaColumn < 0 || sourceColumn < 0 || tierColumn < 0) {
    throw new Error("REF Sheet ต้องมีหัวคอลัมน์ AKA, SOURCE และ TIER");
  }
  const reference = new Map();
  for (let row = 1; row < values.length; row++) {
    const coin = String(values[row][akaColumn] || "").trim().toUpperCase();
    if (!coin) continue;
    const tierMatch = String(values[row][tierColumn] || "").trim().toUpperCase()
      .match(/^T?([1-4])(?:\.0+)?$/);
    reference.set(coin, {
      source: String(values[row][sourceColumn] || "").trim() || "N/A",
      tier: tierMatch ? "T" + tierMatch[1] : "N/A"
    });
  }
  return reference;
}

function bpReadExistingRows(sheet) {
  const rows = new Map();
  if (sheet.getLastRow() < 2) return rows;
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, BP_HEADERS.length).getValues();
  data.forEach((row) => {
    const coin = String(row[0] || "").trim().toUpperCase();
    if (!coin || coin === "THB") return;
    if (rows.has(coin)) throw new Error("พบ Currency ซ้ำในชีท: " + coin);
    const stopLoss = row[9] === "" ? NaN : Number(row[9]);
    rows.set(coin, { stopLoss: stopLoss });
  });
  return rows;
}

function bpValidateHeaders(sheet) {
  if (sheet.getLastRow() < 1 || sheet.getLastColumn() !== BP_HEADERS.length) {
    throw new Error("หัวตาราง BitkubPortfolio ไม่ตรงกับตัวอย่าง; กรุณารัน setupBitkubPortfolioSheet()");
  }
  const headers = sheet.getRange(1, 1, 1, BP_HEADERS.length).getDisplayValues()[0];
  if (headers.some((value, index) => value !== BP_HEADERS[index])) {
    throw new Error("หัวตาราง BitkubPortfolio ไม่ตรงกับสคีมาที่กำหนด");
  }
}

function bpGetArray(response, keys, label) {
  if (Array.isArray(response)) return response;
  for (const key of keys) {
    if (Array.isArray(response[key])) return response[key];
  }
  throw new Error("Bitkub " + label + " ไม่มีรายการข้อมูลที่ถูกต้อง");
}

function bpNumber(value, label) {
  const number = Number(value);
  if (value === null || value === "" || !Number.isFinite(number)) {
    throw new Error("ค่าตัวเลขไม่ถูกต้อง: " + label);
  }
  return number;
}

function bpHalfPrecisionUnit(value) {
  const match = String(value).trim().toLowerCase()
    .match(/^[+-]?\d+(?:\.(\d*))?(?:e([+-]?\d+))?$/);
  if (!match) throw new Error("รูปแบบทศนิยมจาก Order History ไม่ถูกต้อง");
  const fractionalDigits = match[1] ? match[1].length : 0;
  const exponent = Number(match[2] || 0) - fractionalDigits;
  const halfUnit = 0.5 * Math.pow(10, exponent);
  if (!Number.isFinite(halfUnit)) {
    throw new Error("ความละเอียดตัวเลขใน Order History ไม่รองรับ");
  }
  return halfUnit;
}

function bpDisplayValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "N/A";
  return number.toLocaleString("en-US", { maximumFractionDigits: 12 });
}

function bpFloorToScale(value, scale) {
  const multiplier = Math.pow(10, scale);
  return Math.floor(value * multiplier) / multiplier;
}

function bpJoinRemark(first, second) {
  return [first, second]
    .filter((value) => value && value !== "—")
    .join(" | ");
}

function setBitkubPortfolioTrigger5() { bpSetTrigger(5); }
function setBitkubPortfolioTrigger15() { bpSetTrigger(15); }
function setBitkubPortfolioTrigger30() { bpSetTrigger(30); }
function setBitkubPortfolioTrigger45() { bpSetTrigger(45); }
function setBitkubPortfolioTrigger60() { bpSetTrigger(60); }

function bpSetTrigger(minutes) {
  const properties = PropertiesService.getScriptProperties();
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === "runScheduledBitkubPortfolioUpdate") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  properties.setProperty(BP_PROPERTY_SCHEDULE_MINUTES, String(minutes));
  if (minutes === 60) {
    ScriptApp.newTrigger("runScheduledBitkubPortfolioUpdate").timeBased().everyHours(1).create();
  } else if (minutes === 45) {
    // Apps Script has no 45-minute trigger; check the elapsed time every 15 minutes.
    ScriptApp.newTrigger("runScheduledBitkubPortfolioUpdate").timeBased().everyMinutes(15).create();
  } else {
    ScriptApp.newTrigger("runScheduledBitkubPortfolioUpdate").timeBased()
      .everyMinutes(minutes).create();
  }
  SpreadsheetApp.getActiveSpreadsheet().toast(
    "ตั้ง Trigger อัพเดททุก " + minutes + " นาทีแล้ว",
    BP_SHEET_NAME,
    5
  );
}

function clearBitkubPortfolioTriggers() {
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === "runScheduledBitkubPortfolioUpdate") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  PropertiesService.getScriptProperties().deleteProperty(BP_PROPERTY_SCHEDULE_MINUTES);
  SpreadsheetApp.getActiveSpreadsheet().toast("ล้าง Trigger Portfolio แล้ว", BP_SHEET_NAME, 5);
}

function runScheduledBitkubPortfolioUpdate() {
  const properties = PropertiesService.getScriptProperties();
  const minutes = Number(properties.getProperty(BP_PROPERTY_SCHEDULE_MINUTES));
  if (![5, 15, 30, 45, 60].includes(minutes)) {
    throw new Error("ไม่พบค่ารอบ Trigger ที่ถูกต้อง; กรุณาตั้ง Trigger ใหม่จากเมนู");
  }
  if (minutes === 45) {
    const lastUpdate = Number(properties.getProperty(BP_PROPERTY_LAST_UPDATE) || 0);
    if (lastUpdate && Date.now() - lastUpdate < 45 * 60 * 1000) return;
  }
  updateBitkubPortfolio();
}
