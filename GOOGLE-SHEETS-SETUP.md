# Google Sheets and data setup

## Data flow

The Google Sheet is the read-only source for the latest MPTM signals produced
by the CFD Gold Apps Script. `update.sh` downloads a new XLSX snapshot on every
run, validates its structure, and never substitutes an older snapshot when a
download fails. The CLI does not call or refresh the Apps Script itself; check
`LAST_CANDLE` and `UPDATED` in the report to assess the signal timestamps.

For Liquidity, the CLI separately queries TradingView's CFD Scanner using the
configured TradingView symbol for current-week turnover, and reads Avg Turnover
20D from a TradingView Pine CSV export. The scanner's historical weekly offsets
are not reliable for retrieving all four bars, so the workflow does not derive
the 20-day proxy from scanner history.

Current-week turnover proxy:

`current 1W close × current 1W volume`

Avg Turnover 20D proxy:

`sum(weekly close × weekly volume for 4 completed bars) / 20`

The 20-day formula follows the estimate convention used by
[TFOSvS](https://github.com/TimeFrameLab/TFOSvS). To produce the CSV, open the
mapped TradingView symbol on a 1W chart, add
[tradingview-cfd-gold-liquidity.pine](./tradingview-cfd-gold-liquidity.pine),
export chart data, and save it as
`downloads/tradingview-liquidity/<AKA>.csv` (for example,
`downloads/tradingview-liquidity/XAU.csv`). Keep the
`TFOS_AVG_TURNOVER_20D_USD_DAY` column. If the file or value is missing, the
report shows `⚫ N/A` and a warning rather than reusing old data.

Refresh the Pine CSV for the analysis run you want; the CLI does not validate
the export's timestamp or confirm that it includes the latest weekly bar.

Both are provider-specific proxies, not market-wide turnover, order-book
depth, or guaranteed liquidity measures. The current weekly bar may be
incomplete; TradingView/OANDA volume may differ from another CFD provider.

## Configure

1. Create a read-only Google Sheets copy containing only the CFD symbols and
   required MPTM output; do not publish personal or portfolio information.
2. Make the spreadsheet readable by link and copy `.env.example` to `.env`.
3. Set `SET_DATA_URL` and, if needed, `SET_DATA_SHEET`.
4. Set `TRADINGVIEW_SYMBOL_MAP` as comma-separated `AKA=EXCHANGE:SYMBOL`
   entries. The default is `XAU=OANDA:XAUUSD`. Verify each symbol exists in
   TradingView's CFD market before adding it.
5. Ensure the sheet contains the required columns below. The header may occur
   within its first 10 rows.

Required columns:

`AKA`, `ACTION`, `BIAS(W)`, `SETUP(D)`, `ENTRY_ZONE(4H)`,
`ENTRY_TRIGGER(1H)`, `PRICE`, `RSI(W)`, `RSI(D)`, `RSI(1H)`,
`MACD_HIST_DELTA(W)`, `LAST_CANDLE`, `UPDATED`

`AKA` values must be unique and must match the left side of
`TRADINGVIEW_SYMBOL_MAP`. `LAST_CANDLE` and `UPDATED` come from the MPTM
producer; the CLI reports them but does not claim to validate their freshness.

## Install and run

Python 3.9 or later is required.

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cp .env.example .env
# Edit .env and set SET_DATA_URL
./update.sh
./update.sh UPDATE/XAU
./candidate.sh
```

The source snapshot is stored at `downloads/All-CFD-MTFS.xlsx` and the UPDATE
report at `downloads/All-CFD-MTFS_output.xlsx`; both are ignored by Git.
Pine exports belong in `downloads/tradingview-liquidity/` and are also ignored.
The report workbook contains `Latest Snapshot`, append-only `Master Signal
Log`, and `REF.` sheets, including separate current-week and Avg Turnover 20D
proxy columns. Candidate reports are printed to the terminal.

TradingView Scanner is accessed without copied browser cookies or account
credentials. Its scanner endpoint is not a published public API and may change
or become unavailable. A failed request or invalid CSV is reported; no old
Liquidity value is used as a fallback.
