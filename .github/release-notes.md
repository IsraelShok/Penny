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
