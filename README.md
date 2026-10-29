# Payment reconciliation

`payments.jsonl` is an export of payment events from a payments provider, one JSON object per line. The reconciliation script is meant to work out how much money was actually collected, but it doesn't work.

Fix it, in Python (`reconcile.py`) or JavaScript (`reconcile.js`), whichever you prefer. When it's right, it prints a code. Paste that code into the application form.

## How the data works

- Each line is one event: `txn_id`, `status` (`success`, `failed` or `pending`), `amount` in naira, `currency`, and `ts` (when it happened, UTC).
- A payment can be attempted more than once. Every attempt has the same `txn_id`. Only the latest attempt for each `txn_id` counts.
- A payment counts as collected only if its latest attempt is `success`.
- The export comes from a production system and isn't perfectly clean. Ignore lines that can't be read, and events without a `txn_id`. Every other event is valid and must be counted correctly.
- `expected.txt` holds the number of successful payments the finance team counted by hand. The script checks itself against it.

## What to submit

1. Fork this repo, fix the script, and commit your fix to your fork.
2. Run it. Paste the code it prints into the form.
3. Paste the link to your fork into the form.

---

## Bugs Identified & Corrections Made

### 1. Unhandled Syntax Errors on Corrupted Lines
- **Why it failed**: `payments.jsonl` contains raw, dirty export data with malformed rows (such as truncated strings and unescaped control characters after `{"txn_id": "`). The original script ran `JSON.parse(line)` directly without error handling, which crashed Node immediately with a fatal `SyntaxError`.
- **Correction**: Wrapped the parsing step in a `try ... catch` block to safely catch parse errors and skip unreadable lines as specified.

### 2. Missing Deduplication ("Latest Attempt" Rule)
- **Why it failed**: The starter code incremented the count and total on every line where `event.status === "success"`. However, multiple payment attempts can share the same `txn_id`, and only the latest attempt (by timestamp `ts`) counts. The naive approach caused both double-counting of retried successes and miscounting of transactions that succeeded early but ultimately failed.
- **Correction**: Tracked events in a `Map` keyed by `txn_id`, comparing timestamps (`Date.parse(event.ts)`) so only the most recent attempt is retained before aggregating results.

### 3. Missing `txn_id` Validation
- **Why it failed**: The original script did not check if `event.txn_id` was present, allowing corrupt or headless records into the logic.
- **Correction**: Added an explicit check (`!event || !event.txn_id`) to ignore any records lacking a transaction identifier.

### 4. Comma-Formatted Amount Strings (`NaN` Total)
- **Why it failed**: Several amount values in the export are formatted as strings with thousand-separator commas (e.g. `"55,707.77"`). The starter code called `Number(event.amount)`, which returns `NaN` in JavaScript when commas are present. Adding `NaN` to the running total caused `total` to permanently become `NaN` (`KOYA-NaN`).
- **Correction**: Added a `parseAmount` sanitization helper that strips out comma characters (`amount.replace(/,/g, "")`) before converting to a float.

### 5. Memory Efficiency (Stream Processing)
- **Enhancement**: The original code read the entire file into memory at once with `fs.readFileSync().split("\n")`. For production-scale datasets, this causes heavy memory spikes. The script was updated to use Node's `readline` with `fs.createReadStream`, processing lines in a streaming fashion with minimal, constant memory overhead.
