## What's new in 0.2.0

- **A budget that follows your month.** Set the day your household month starts (salary day, not the 1st) and budgets, recaps and the monthly history line up with it. Budgets carry over, moves between categories are part of the plan, and the recap has a period picker.
- **Money that comes back is not income.** Paybacks, refunds and reimbursements are matched to the expense they belong to, so they lower the real cost instead of inflating the month's income.
- **A business report.** Mark the business share of a transaction and get a monthly report by category and merchant, with CSV export. Personal screens keep showing only the household share.
- **Smart sheet import.** Paste a table from anywhere (Excel, Google Sheets, a bank file, a list you typed), fix cells in place, get category suggestions and duplicate detection per account, and undo the whole import.
- **Encrypted backup and restore.** One password-protected `.pennybak` file holds the database and the bank encryption key. Restore checks the file before touching anything and keeps a copy of the current database. `npm run backup` does the same from the command line.
- **Longer view.** A lifetime money model to age 90, a coach that turns the month's numbers into ranked advice, and an insurance module with policies, renewals and the payments that match them.
- **More ways in.** Open banking over the Israeli XS2A API, a pension report import from your agent, and a demo household that lets you try every screen without a bank connection.
- **A calmer app.** Real error messages instead of blank screens, guided reviews, and a 2026 design pass across home, settings and the money hub.

## Install

Pick one. Your data stays on your computer in every option.

### Windows: desktop app
1. Download **`Penny-Setup-<version>.exe`** below and run it.
2. Windows SmartScreen may warn that the app is not signed: click **More info → Run anyway** (once).
3. Penny opens from the Start menu. To update later, run the newer installer over the old one.

### Mac: desktop app
1. Download the **`.dmg`** for your Mac: `arm64` for Apple Silicon (M1 and newer), `x64` for Intel.
2. Open it and drag Penny to Applications.
3. The app is not notarized by Apple yet, so the first open is blocked. Open **System Settings → Privacy & Security** and click **Open Anyway** (once).
   If macOS says the app is damaged, run `xattr -cr /Applications/Penny.app` in Terminal and open it again.
4. Bank sync uses Google Chrome or Microsoft Edge, so install one of them if you have neither.

### Docker: Windows, Mac or Linux
Needs [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine on Linux) and git.
```bash
git clone https://github.com/Sergey-Bar/Penny.git
cd Penny
git checkout <version tag>
```
Then start it: **Windows** double-click `Penny-docker.bat`; **Mac / Linux** run `./Penny-docker.sh`.
Penny opens at http://127.0.0.1:41234. To update later: `Penny-update.bat` or `./Penny-update.sh`. Each update backs up your data first and rolls back if the new version fails.

Statement files from banks and investment houses go into the import folder (Settings → Data shows it; in Docker it is `imports/`).
