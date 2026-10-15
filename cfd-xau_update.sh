#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="$ROOT/.venv/bin/python"
[[ -x "$PYTHON_BIN" ]] || PYTHON_BIN=python3

exec "$PYTHON_BIN" - "$@" <<'PY'
import csv
import io
import json
import math
import os
import re
import sys
import tempfile
import time
from zipfile import BadZipFile
from datetime import datetime
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

import requests
from openpyxl import Workbook, load_workbook

ROOT = os.path.dirname(os.path.abspath(__file__))
SHEET_DEFAULT = "All-CFD-MTFS"
SNAPSHOT_PATH = os.path.join(ROOT, "downloads", "All-CFD-MTFS.xlsx")
REPORT_PATH = os.path.join(ROOT, "downloads", "All-CFD-MTFS_output.xlsx")
SCANNER_URL = "https://scanner.tradingview.com/cfd/scan"
LIQUIDITY_CSV_DIR = os.path.join(ROOT, "downloads", "tradingview-liquidity")
LIQUIDITY_CSV_COLUMN = "TFOS_AVG_TURNOVER_20D_USD_DAY"
TIMEOUT_SECONDS = 20
RETRY_COUNT = 3
BATCH_SIZE = 10
TIMEZONE_BANGKOK = ZoneInfo("Asia/Bangkok")
SCANNER_COLUMNS = ["close|1W", "volume|1W"]
REPORT_HEADERS = [
    "SNAPSHOT_FETCHED_AT",
    "AKA",
    "TRADINGVIEW_SYMBOL",
    "MPTM_STATUS",
    "ACTION",
    "BIAS(W)",
    "SETUP(D)",
    "ENTRY_ZONE(4H)",
    "ENTRY_TRIGGER(1H)",
    "PRICE",
    "RSI(W)",
    "RSI(D)",
    "RSI(1H)",
    "MACD_HIST_DELTA(W)",
    "LAST_CANDLE",
    "UPDATED",
    "CURRENT_WEEK_TURNOVER_PROXY",
    "AVG_TURNOVER_20D_PROXY",
]
REQUIRED_COLUMNS = (
    "AKA",
    "ACTION",
    "BIAS(W)",
    "SETUP(D)",
    "ENTRY_ZONE(4H)",
    "ENTRY_TRIGGER(1H)",
    "PRICE",
    "RSI(W)",
    "RSI(D)",
    "RSI(1H)",
    "MACD_HIST_DELTA(W)",
    "LAST_CANDLE",
    "UPDATED",
)
ALLOWED_DUPLICATE_COLUMNS = {"ENTRY_ZONE(4H)", "ENTRY_TRIGGER(1H)"}
DEFAULT_SYMBOL_MAP = {"XAU": "OANDA:XAUUSD"}
SYMBOL_PATTERN = re.compile(r"^[A-Za-z0-9._-]+:[A-Za-z0-9._-]+$")


def error(message):
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_config():
    path = os.path.join(ROOT, ".env")
    if not os.path.isfile(path):
        error("ไม่พบไฟล์ .env กรุณาคัดลอก .env.example แล้วตั้งค่า")
    config = {}
    with open(path, encoding="utf-8") as source:
        for line in source:
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in line:
                continue
            key, value = line.rstrip("\r\n").split("=", 1)
            config[key.strip()] = value.strip().strip("\"'")
    return config


def parse_symbol_map(raw):
    symbols = dict(DEFAULT_SYMBOL_MAP)
    if not raw:
        return symbols
    for entry in raw.split(","):
        if "=" not in entry:
            error("TRADINGVIEW_SYMBOL_MAP ต้องอยู่ในรูป AKA=EXCHANGE:SYMBOL")
        aka, ticker = (part.strip() for part in entry.split("=", 1))
        aka = aka.upper()
        if not aka or not SYMBOL_PATTERN.fullmatch(ticker):
            error("พบค่าไม่ถูกต้องใน TRADINGVIEW_SYMBOL_MAP")
        symbols[aka] = ticker
    return symbols


def parse_command(args):
    if args == ["--help"] or args == ["-h"]:
        print(
            "Usage: ./update.sh [UPDATE[/<AKA>-<AKA>-...]]\n"
            "       ./candidate.sh [CANDIDATE]"
        )
        raise SystemExit(0)
    if len(args) > 1:
        error("ระบุคำสั่งได้ครั้งละหนึ่งคำสั่ง")
    command = args[0] if args else "UPDATE"
    if command in ("UPDATE", "CANDIDATE"):
        return command, []
    if command.startswith("UPDATE/"):
        selected = [item.strip().upper() for item in command[7:].split("-")]
        if not selected or any(not item for item in selected):
            error("รูปแบบคำสั่งต้องเป็น UPDATE/<AKA> หรือ UPDATE/<AKA>-<AKA>")
        if len(selected) != len(set(selected)):
            error("ระบุ AKA ซ้ำในคำสั่งไม่ได้")
        return "SPECIFIED", selected
    error("คำสั่งไม่ถูกต้อง ใช้ UPDATE, UPDATE/<AKA> หรือ CANDIDATE")


def validate_data_url(value):
    parsed = urlparse(value)
    match = re.search(r"/spreadsheets/d/([A-Za-z0-9_-]+)", parsed.path)
    if parsed.scheme != "https" or parsed.netloc != "docs.google.com" or not match:
        error("SET_DATA_URL ต้องเป็น Google Sheets URL แบบ HTTPS")
    return match.group(1)


def download_snapshot(config, sheet_name):
    if not config.get("SET_DATA_URL"):
        error("กรุณากำหนด SET_DATA_URL ใน .env")
    spreadsheet_id = validate_data_url(config["SET_DATA_URL"])
    url = (
        f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export"
        f"?format=xlsx&nocache={int(time.time())}"
    )
    try:
        response = requests.get(
            url,
            headers={"Cache-Control": "no-cache", "Pragma": "no-cache"},
            timeout=TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        content = response.content
        workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    except requests.RequestException as exc:
        status = getattr(getattr(exc, "response", None), "status_code", None)
        suffix = f" (HTTP {status})" if status else f" ({type(exc).__name__})"
        error("ดาวน์โหลด Google Sheets ไม่สำเร็จ" + suffix)
    except (BadZipFile, OSError, ValueError, KeyError) as exc:
        error(f"ไฟล์ที่ดาวน์โหลดไม่ใช่ workbook XLSX ที่อ่านได้ ({type(exc).__name__})")

    if sheet_name not in workbook.sheetnames:
        error(f"ไม่พบชีต {sheet_name!r} ใน workbook")
    sheet = workbook[sheet_name]
    header_row = None
    headers = None
    for row_number, row in enumerate(sheet.iter_rows(min_row=1, max_row=10, values_only=True), 1):
        normalized = [str(value or "").strip().upper() for value in row]
        if "AKA" in normalized:
            header_row = row_number
            headers = normalized
            break
    if header_row is None:
        error('ไม่พบหัวคอลัมน์ "AKA" ใน 10 แถวแรก')
    missing = [name for name in REQUIRED_COLUMNS if name not in headers]
    if missing:
        error("ขาดคอลัมน์สำหรับรายงาน MPTM: " + ", ".join(missing))
    duplicates = [
        name
        for name in REQUIRED_COLUMNS
        if headers.count(name) > 1 and name not in ALLOWED_DUPLICATE_COLUMNS
    ]
    if duplicates:
        error("พบหัวคอลัมน์ซ้ำใน snapshot: " + ", ".join(duplicates))

    rows = list(sheet.iter_rows(min_row=header_row + 1, values_only=True))
    indexes = {name: headers.index(name) for name in headers if name}
    records = []
    seen = set()
    for row_number, row in enumerate(rows, header_row + 1):
        aka = str(cell(row, indexes["AKA"]) or "").strip().upper()
        if not aka:
            continue
        if aka in seen:
            error(f"AKA ซ้ำในชีต: {aka} (แถว {row_number})")
        seen.add(aka)
        records.append({"aka": aka, "row": row, "row_number": row_number})
    workbook.close()
    if not records:
        error("ไม่พบข้อมูล AKA ในชีต")

    os.makedirs(os.path.dirname(SNAPSHOT_PATH), exist_ok=True)
    descriptor, temporary_path = tempfile.mkstemp(
        prefix=".All-CFD-MTFS-", suffix=".xlsx", dir=os.path.dirname(SNAPSHOT_PATH)
    )
    try:
        with os.fdopen(descriptor, "wb") as target:
            target.write(content)
        os.replace(temporary_path, SNAPSHOT_PATH)
    except OSError as exc:
        try:
            os.unlink(temporary_path)
        except FileNotFoundError:
            pass
        error(f"บันทึก snapshot ไม่สำเร็จ ({type(exc).__name__})")
    return headers, indexes, records


def cell(row, index):
    return row[index] if index < len(row) else None


def get_value(record, indexes, name):
    return cell(record["row"], indexes[name])


def finite_number(value):
    try:
        number = float(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def normalized(value):
    return str(value or "").strip().upper()


def is_green(value):
    return str(value or "").strip().startswith("🟢")


def is_yellow(value):
    return str(value or "").strip().startswith("🟡")


def is_pre_entry(record, indexes):
    bias = normalized(get_value(record, indexes, "BIAS(W)"))
    setup = normalized(get_value(record, indexes, "SETUP(D)"))
    zone = get_value(record, indexes, "ENTRY_ZONE(4H)")
    trigger = get_value(record, indexes, "ENTRY_TRIGGER(1H)")
    return (
        "BULLISH" in bias
        and any(state in setup for state in ("READY", "RECOVERY", "PULLBACK"))
        and is_green(zone)
        and is_yellow(trigger)
    )


def status_for(record, indexes):
    action = normalized(get_value(record, indexes, "ACTION"))
    setup = normalized(get_value(record, indexes, "SETUP(D)"))
    if "BUY" in action:
        return "BUY CONFIRMED"
    if "EXIT" in action or "SELL" in action:
        return "EXIT"
    if "EXTENDED" in setup:
        return "OVEREXTENDED"
    if is_pre_entry(record, indexes):
        return "PRE-ENTRY — WAIT 1H"
    return "WAIT/RETEST"


def candidate_sort_key(record, indexes):
    delta = finite_number(get_value(record, indexes, "MACD_HIST_DELTA(W)"))
    return delta if delta is not None else float("-inf")


def scanner_request(session, tickers):
    payload = {
        "symbols": {"tickers": tickers, "query": {"types": []}},
        "columns": SCANNER_COLUMNS,
    }
    last_error = None
    for attempt in range(RETRY_COUNT):
        try:
            response = session.post(SCANNER_URL, json=payload, timeout=TIMEOUT_SECONDS)
            if response.status_code == 429 or response.status_code >= 500:
                last_error = f"HTTP {response.status_code}"
                if attempt + 1 < RETRY_COUNT:
                    time.sleep(attempt + 1)
                    continue
                break
            if response.status_code >= 400:
                return [], f"HTTP {response.status_code}"
            response.raise_for_status()
            result = response.json()
            if not isinstance(result, dict) or not isinstance(result.get("data"), list):
                raise ValueError("รูปแบบข้อมูลตอบกลับไม่ถูกต้อง")
            return result["data"], None
        except requests.RequestException as exc:
            last_error = f"{type(exc).__name__}"
        except ValueError as exc:
            last_error = str(exc)
        if attempt + 1 < RETRY_COUNT:
            time.sleep(attempt + 1)
    return [], last_error or "ไม่ทราบสาเหตุ"


def current_week_turnover(items_by_ticker, ticker):
    item = items_by_ticker.get(ticker)
    if item is None:
        return None
    values = item.get("d")
    if not isinstance(values, list) or len(values) != len(SCANNER_COLUMNS):
        return None
    close = finite_number(values[0])
    volume = finite_number(values[1])
    if close is None or volume is None or close <= 0 or volume < 0:
        return None
    return close * volume


def avg_turnover_from_csv(aka):
    if not re.fullmatch(r"[A-Za-z0-9._-]+", aka):
        return None, f"{aka}: AKA ใช้เป็นชื่อไฟล์ CSV ไม่ได้"
    path = os.path.join(LIQUIDITY_CSV_DIR, aka + ".csv")
    if not os.path.isfile(path):
        return None, f"{aka}: ไม่พบไฟล์ Pine CSV ({path})"
    try:
        with open(path, newline="", encoding="utf-8-sig") as source:
            reader = csv.DictReader(source)
            headers = [str(name or "").strip() for name in (reader.fieldnames or [])]
            if LIQUIDITY_CSV_COLUMN not in headers:
                return None, (
                    f"{aka}: Pine CSV ไม่มีคอลัมน์ {LIQUIDITY_CSV_COLUMN}"
                )
            value = None
            for row in reader:
                normalized_row = {
                    str(name or "").strip(): item for name, item in row.items()
                }
                candidate = finite_number(normalized_row.get(LIQUIDITY_CSV_COLUMN))
                if candidate is not None and candidate > 0:
                    value = candidate
            if value is None:
                return None, f"{aka}: ไม่มีค่า Avg Turnover 20D ที่ใช้ได้ใน Pine CSV"
            return value, None
    except (OSError, UnicodeError, csv.Error) as exc:
        return None, f"{aka}: อ่าน Pine CSV ไม่สำเร็จ ({type(exc).__name__})"


def fetch_liquidity(tickers_by_aka):
    current_values = {}
    avg_values = {}
    warnings = []
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (compatible; TFOSvCFD-XAU/1.0)",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Origin": "https://www.tradingview.com",
        "Referer": "https://www.tradingview.com/",
    })
    mapped = {}
    for aka, ticker in tickers_by_aka.items():
        avg_values[aka], csv_warning = avg_turnover_from_csv(aka)
        if csv_warning:
            warnings.append(csv_warning)
        if ticker:
            mapped[ticker] = aka
        else:
            warnings.append(f"{aka}: ไม่มี TradingView symbol mapping")

    tickers = list(mapped)
    for offset in range(0, len(tickers), BATCH_SIZE):
        batch = tickers[offset : offset + BATCH_SIZE]
        items, failure = scanner_request(session, batch)
        if failure:
            warnings.append(
                "TradingView Scanner: ดึง current weekly turnover ไม่สำเร็จ ("
                + failure
                + ")"
            )
            for ticker in batch:
                current_values[mapped[ticker]] = None
            continue
        results = {}
        for item in items:
            if isinstance(item, dict) and isinstance(item.get("s"), str):
                results[item["s"]] = item
        for ticker in batch:
            aka = mapped[ticker]
            estimate = current_week_turnover(results, ticker)
            current_values[aka] = estimate
            if estimate is None:
                warnings.append(
                    f"{aka}: TradingView ไม่มี close/volume ของสัปดาห์ปัจจุบันที่ใช้ได้"
                )
    session.close()
    return current_values, avg_values, warnings


def format_value(value):
    if value is None or str(value).strip() == "":
        return "⚫ N/A"
    return str(value).strip().replace("\r", " ").replace("\n", " ")


def markdown(value):
    return format_value(value).replace("|", "\\|")


def format_proxy(value, unit):
    if value is None:
        return "⚫ N/A"
    return f"≈ {value:,.2f} {unit}"


def report_row(record, indexes, ticker, current_turnover, avg_proxy, fetched_at):
    return {
        "SNAPSHOT_FETCHED_AT": fetched_at,
        "AKA": record["aka"],
        "TRADINGVIEW_SYMBOL": ticker or "⚫ N/A",
        "MPTM_STATUS": status_for(record, indexes),
        "ACTION": format_value(get_value(record, indexes, "ACTION")),
        "BIAS(W)": format_value(get_value(record, indexes, "BIAS(W)")),
        "SETUP(D)": format_value(get_value(record, indexes, "SETUP(D)")),
        "ENTRY_ZONE(4H)": format_value(get_value(record, indexes, "ENTRY_ZONE(4H)")),
        "ENTRY_TRIGGER(1H)": format_value(get_value(record, indexes, "ENTRY_TRIGGER(1H)")),
        "PRICE": format_value(get_value(record, indexes, "PRICE")),
        "RSI(W)": format_value(get_value(record, indexes, "RSI(W)")),
        "RSI(D)": format_value(get_value(record, indexes, "RSI(D)")),
        "RSI(1H)": format_value(get_value(record, indexes, "RSI(1H)")),
        "MACD_HIST_DELTA(W)": format_value(
            get_value(record, indexes, "MACD_HIST_DELTA(W)")
        ),
        "LAST_CANDLE": format_value(get_value(record, indexes, "LAST_CANDLE")),
        "UPDATED": format_value(get_value(record, indexes, "UPDATED")),
        "CURRENT_WEEK_TURNOVER_PROXY": format_proxy(
            current_turnover, "USD/week (current, incomplete)"
        ),
        "AVG_TURNOVER_20D_PROXY": format_proxy(avg_proxy, "USD/day"),
    }


def write_report(rows, source_url):
    workbook = Workbook()
    latest = workbook.active
    latest.title = "Latest Snapshot"
    latest.append(REPORT_HEADERS)
    for row in rows:
        latest.append([row[column] for column in REPORT_HEADERS])

    master = workbook.create_sheet("Master Signal Log")
    master.append(REPORT_HEADERS)
    existing_log_path = REPORT_PATH
    if os.path.isfile(existing_log_path):
        try:
            old_book = load_workbook(existing_log_path, read_only=True, data_only=True)
            if "Master Signal Log" in old_book.sheetnames:
                old_log = old_book["Master Signal Log"]
                old_headers = [cell.value for cell in old_log[1]]
                if old_headers != REPORT_HEADERS:
                    old_book.close()
                    error("schema ของ Master Signal Log ไม่ตรง; หยุดเพื่อรักษาประวัติเดิม")
                for old_row in old_log.iter_rows(min_row=2, values_only=True):
                    master.append(list(old_row))
            old_book.close()
        except (BadZipFile, OSError, ValueError, KeyError) as exc:
            error(f"อ่านรายงานเดิมไม่สำเร็จ ({type(exc).__name__})")
    for row in rows:
        master.append([row[column] for column in REPORT_HEADERS])

    reference = workbook.create_sheet("REF.")
    reference.append(["รายการ", "ค่า"])
    reference.append(["Google Sheets snapshot", source_url])
    reference.append(["TradingView CFD Scanner", SCANNER_URL])
    reference.append([
        "Current week turnover proxy",
        "TradingView current 1W close × volume; partial week, estimate only",
    ])
    reference.append([
        "Avg Turnover 20D proxy",
        "Pine CSV value from four completed 1W close × volume bars / 20",
    ])
    reference.append([
        "Avg Turnover 20D Pine CSV",
        os.path.relpath(LIQUIDITY_CSV_DIR, ROOT) + " (freshness not validated)",
    ])
    for worksheet in (latest, master, reference):
        worksheet.freeze_panes = "A2"
        worksheet.auto_filter.ref = worksheet.dimensions
        for column in worksheet.columns:
            width = min(
                42,
                max(14, max(len(str(item.value or "")) for item in column[:40]) + 2),
            )
            worksheet.column_dimensions[column[0].column_letter].width = width
    os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
    descriptor, temporary_path = tempfile.mkstemp(
        prefix=".All-CFD-MTFS-output-", suffix=".xlsx", dir=os.path.dirname(REPORT_PATH)
    )
    try:
        with os.fdopen(descriptor, "wb") as target:
            workbook.save(target)
        os.replace(temporary_path, REPORT_PATH)
    except OSError as exc:
        try:
            os.unlink(temporary_path)
        except FileNotFoundError:
            pass
        error(f"บันทึกรายงาน Excel ไม่สำเร็จ ({type(exc).__name__})")
    workbook.close()


def print_table(rows, columns):
    print("| " + " | ".join(columns) + " |")
    print("|" + "|".join("---" for _ in columns) + "|")
    if not rows:
        print("| " + " | ".join("—" for _ in columns) + " |")
        return
    for row in rows:
        print("| " + " | ".join(markdown(row[column]) for column in columns) + " |")


def main():
    mode, selected = parse_command(sys.argv[1:])
    config = load_config()
    symbols = parse_symbol_map(config.get("TRADINGVIEW_SYMBOL_MAP", ""))
    sheet_name = config.get("SET_DATA_SHEET", SHEET_DEFAULT)
    _, indexes, records = download_snapshot(config, sheet_name)

    if selected:
        by_aka = {record["aka"]: record for record in records}
        missing = [aka for aka in selected if aka not in by_aka]
        if missing:
            error("ไม่พบ AKA ใน snapshot: " + ", ".join(missing))
        records = [by_aka[aka] for aka in selected]

    if mode == "CANDIDATE":
        records = [record for record in records if is_pre_entry(record, indexes)]
        records.sort(key=lambda record: candidate_sort_key(record, indexes), reverse=True)

    fetched_at = datetime.now(TIMEZONE_BANGKOK).strftime("%Y-%m-%d %H:%M:%S %Z")
    tickers_by_aka = {
        record["aka"]: symbols.get(record["aka"]) for record in records
    }
    current_turnover, avg_turnover, warnings = fetch_liquidity(tickers_by_aka)
    result_rows = [
        report_row(
            record,
            indexes,
            tickers_by_aka[record["aka"]],
            current_turnover.get(record["aka"]),
            avg_turnover.get(record["aka"]),
            fetched_at,
        )
        for record in records
    ]

    print(f"ข้อมูล snapshot ดึงเมื่อ: {fetched_at}")
    print(f"แหล่งข้อมูล MPTM: Google Sheets / {sheet_name}")
    print("Current weekly turnover: TradingView CFD Scanner — symbol ตาม mapping")
    print(
        "Avg Turnover 20D: TradingView Pine CSV — downloads/tradingview-liquidity/<AKA>.csv"
    )

    if mode == "CANDIDATE":
        print(
            f"\nผลการคัดกรอง CANDIDATE (MPTM W→D→4H→1H, รอ 1H Trigger) "
            f"— {len(result_rows)} รายการ"
        )
        print(
            "เงื่อนไข: BIAS(W) bullish + SETUP(D) ready/recovery/pullback "
            "+ ENTRY_ZONE(4H) ยืนยัน + ENTRY_TRIGGER(1H) ยังรอ"
        )
        columns = [
            "AKA",
            "TRADINGVIEW_SYMBOL",
            "PRICE",
            "MACD_HIST_DELTA(W)",
            "BIAS(W)",
            "SETUP(D)",
            "ENTRY_ZONE(4H)",
            "ENTRY_TRIGGER(1H)",
            "LAST_CANDLE",
            "UPDATED",
            "CURRENT_WEEK_TURNOVER_PROXY",
            "AVG_TURNOVER_20D_PROXY",
        ]
        print_table(result_rows[:25], columns)
    else:
        title = "UPDATE" if mode == "UPDATE" else "SPECIFIED CFD"
        print(f"\n{title} — {len(result_rows)} สัญลักษณ์")
        columns = [
            "AKA",
            "TRADINGVIEW_SYMBOL",
            "MPTM_STATUS",
            "ACTION",
            "BIAS(W)",
            "SETUP(D)",
            "ENTRY_ZONE(4H)",
            "ENTRY_TRIGGER(1H)",
            "PRICE",
            "RSI(W)",
            "RSI(D)",
            "RSI(1H)",
            "MACD_HIST_DELTA(W)",
            "CURRENT_WEEK_TURNOVER_PROXY",
            "AVG_TURNOVER_20D_PROXY",
            "LAST_CANDLE",
            "UPDATED",
        ]
        print_table(result_rows, columns)
        write_report(result_rows, config["SET_DATA_URL"])
        print(f"\n✅ Excel report: {REPORT_PATH}")

    for warning in dict.fromkeys(warnings):
        print("⚠️ " + warning)
    print(
        "⚠️ Current week turnover เป็น close × volume ของแท่ง 1W ปัจจุบัน "
        "ซึ่งอาจยังไม่ปิด; Avg Turnover 20D เป็นค่าใน Pine CSV จาก 4 แท่ง 1W "
        "ที่ปิดแล้ว ÷ 20; ทั้งคู่เป็น proxy ไม่ใช่ market-wide turnover, "
        "bid/ask depth หรือสภาพคล่องรับประกัน"
    )
    print(
        "⚠️ TradingView Scanner เป็น endpoint ที่ไม่ได้ประกาศเป็น public API "
        "อย่างเป็นทางการ; หากข้อมูลไม่พร้อมจะแสดง N/A โดยไม่ใช้ค่าเก่าแทน"
    )


main()
PY
