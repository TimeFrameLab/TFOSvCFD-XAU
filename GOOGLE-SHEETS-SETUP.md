# Google Sheets and data setup

## Data flow

The Google Sheet is the read-only source for the latest MPTM signals produced
by the CFD Gold Apps Script. `update.sh` downloads a new XLSX snapshot on every
run, validates its structure, and never substitutes an older snapshot when a
download fails. The CLI does not call or refresh the Apps Script itself; check
`LAST_CANDLE` and `UPDATED` in the report to assess the signal timestamps.

For price-volume activity, the CLI separately queries TradingView's CFD Scanner
using the configured TradingView symbol for current weekly activity and its
30D average traded-value field.

Current-week activity proxy:

`current 1W close × current 1W volume`

Average traded value (30D):

`AvgValue.Traded_30d` (read directly from TradingView CFD Scanner)

The 30D traded-value field is read directly from TradingView; the workflow
does not reconstruct it from monthly candles or divide it by 20. Its
definition and source data are provider-specific and are not guaranteed to
match a broker's traded value or represent market-wide turnover. The current
weekly candle may be incomplete. The workflow does not use Pine CSV or OANDA
credentials.

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
The report workbook contains `Latest Snapshot`, append-only `Master Signal
Log`, and `REF.` sheets, including separate current-week activity and average
traded-value 30D columns. Existing 4W/20D log history is preserved in legacy
sheets when the previous report workbook is available at migration; values
are not converted to the new TradingView 30D field. Candidate reports are
printed to the terminal.

TradingView Scanner is accessed without copied browser cookies or account
credentials. Its scanner endpoint is not a published public API and may change
or become unavailable. A failed request is reported; no old Liquidity value
is used as a fallback.
