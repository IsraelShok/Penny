# Importing statement files

For accounts Penny can't sync, or months the bank no longer shows:

- **Upload:** Settings → Accounts & import → "Import a file", then pick the account.
- **Import folder:** Penny watches a folder (shown on the same page; `./imports` in Docker) with one subfolder per account, such as `max (1234)`. A file dropped there is imported and moved to `imported/`, or to `failed/` with a note saying why. For an account Penny doesn't sync, create a folder with its name.

A transaction that arrives from both sync and a file is stored once (same account and amount, at most a day apart). The synced copy wins and keeps your category, notes and tags.

## Smart sheet import

Settings → Accounts & import → Import files → "Smart sheet import". Paste a table as it is, from Excel or Google Sheets to a bank file or a list you typed. A header row is detected on its own (date, description, amount, type, account, category, tags, owner, business percentage, memo), and without one Penny asks you to map columns. Every cell is editable in place, Enter moves down, Ctrl+D copies the cell above, and you can download a CSV template or copy the header row.

The account you pick per row decides how it is saved: on cash it becomes a manual transaction you can always edit, and on a real account it enters like a file import so the next sync does not duplicate it. A transaction that already exists on that account (same amount, one day apart) is marked and skipped, but you can include it again. Categories are suggested from merchants you have already taught, and after saving you can undo the whole import at once.

## Pension report import

An agent's or advisor's periodic report (pension, study fund, provident and the insurance in it) can be imported as JSON: Settings → Accounts & import → Pension, study funds and investments → "Import pension report". Each product lands in assets with its value from the report date, its management fees and monthly deposit, and each policy lands in insurance. The report is validated against its own total, and importing the same report again updates instead of duplicating. Penny does not read PDFs; any tool that extracts the data to JSON following [the example](../public/pension-report.example.json) works, and the full format is in [pension-report.md](pension-report.md).
