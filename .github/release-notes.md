## What's new in 0.5.0

- **Three new investment houses.** Altshuler Shaham, Phoenix savings and pension, and Excellence Trade sync on their own, with every product as its own asset. Thanks to @IsraelShok.
- **Sync you can leave alone.** Missed runs catch up, short outages retry at 15 minutes, 1 hour and 4 hours, a stuck bank gives up after 10 minutes, and a connection that needs you no longer fails every day.
- **Backups that cannot lose data.** Restore swaps the database in one step and rolls back on failure, works over a damaged database, and keeps the key that opens your saved logins. Backups use a stronger key derivation.
- **More private.** IBANs, phone numbers, long numbers and standing-order names are hidden from cloud AI, and the encryption key file is closed to other users of a Windows computer.
- **Open banking.** Long histories page through to the end or fail clearly, an expired consent tells you to renew it, and errors show in Hebrew.
- **MCP.** Read-only access keeps working with the app lock on, with seven more tools.
- **Telegram.** A reminder when a bank connection stays down.
- **Docker.** To update, run the install command again. Launch scripts moved to `scripts/docker/`.
- **Security fixes** from CodeQL: a release tag can no longer steer the installer path, and HTML statement imports decode safely.

> **Desktop installs of 0.4.0 or older:** updates are now signed with a new key, so download this version once by hand. Updates install automatically again after that.

The full list is in [CHANGELOG.md](https://github.com/Sergey-Bar/Penny/blob/main/CHANGELOG.md).

## Install

Pick one. Your data stays on your computer in every option.

### Windows: desktop app
1. Download **`Penny-Setup-<version>.exe`** below and run it.
2. Windows SmartScreen may warn that the app is not signed: click **More info → Run anyway** (once).
3. Penny opens from the Start menu. Coming from 0.1.0, run this installer once over the old one; from 0.2.0 on, Penny updates itself: when a new version is out it asks to restart (or installs when you close it).

### Mac: desktop app
1. Download the **`.dmg`** for your Mac: `arm64` for Apple Silicon (M1 and newer), `x64` for Intel.
2. Open it and drag Penny to Applications.
3. The app is not notarized by Apple yet, so the first open is blocked. Open **System Settings → Privacy & Security** and click **Open Anyway** (once).
   If macOS says the app is damaged, run `xattr -cr /Applications/Penny.app` in Terminal and open it again.
4. Bank sync uses Google Chrome or Microsoft Edge, so install one of them if you have neither.

### Docker: Windows, Mac or Linux
Needs [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine on Linux). One command downloads the newest release into `~/Penny`, builds it and starts it:
```bash
# Mac / Linux
curl -fsSL https://raw.githubusercontent.com/Sergey-Bar/Penny/main/install-docker.sh | bash
```
```powershell
# Windows (PowerShell)
irm https://raw.githubusercontent.com/Sergey-Bar/Penny/main/install-docker.ps1 | iex
```
Penny opens at http://127.0.0.1:41234. To update later, run the same command again: it backs up your data first and rolls back if the new version fails.

Statement files from banks and investment houses go into the import folder (Settings → Data shows it; in Docker it is `imports/`).
