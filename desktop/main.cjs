// Penny desktop: starts the bundled Next.js server with Electron's own Node and shows it in a window.
// No Node install, no terminal. Data lives in the per-user app folder; scrapers use the installed Chrome or Edge.
const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

// The data folder is named after the product.
app.setName("Penny");
app.setPath("userData", path.join(app.getPath("appData"), "Penny"));

let server = null;
let win = null;

if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

/** The installed Chrome or Edge, so the bank scrapers need no browser download. */
function findBrowser() {
  const candidates =
    process.platform === "win32"
      ? [
          path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Google\\Chrome\\Application\\chrome.exe"),
          path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Google\\Chrome\\Application\\chrome.exe"),
          path.join(process.env.LOCALAPPDATA || "", "Google\\Chrome\\Application\\chrome.exe"),
          path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Microsoft\\Edge\\Application\\msedge.exe"),
          path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Microsoft\\Edge\\Application\\msedge.exe"),
        ]
      : process.platform === "darwin"
        ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]
        : ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  return candidates.find((p) => p && fs.existsSync(p)) || null;
}

/** A free port on localhost, so a second app or dev server never clashes. */
function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

async function waitFor(url, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (r.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function start() {
  // Packaged: the server ships in resources/server. In development: the standalone build in the repo.
  const serverDir = app.isPackaged
    ? path.join(process.resourcesPath, "server")
    : path.join(__dirname, "..", ".next", "standalone");
  const entry = path.join(serverDir, "server.js");
  if (!fs.existsSync(entry)) {
    dialog.showErrorBox("Penny", `The app files are missing (${entry}). Reinstall Penny.`);
    return app.quit();
  }
  const port = await freePort();
  const dataDir = path.join(app.getPath("userData"), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const browser = findBrowser();

  server = spawn(process.execPath, [entry], {
    cwd: serverDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      PENNY_DATA_DIR: dataDir,
      ...(browser ? { PUPPETEER_EXECUTABLE_PATH: browser } : {}),
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const log = fs.createWriteStream(path.join(app.getPath("userData"), "server.log"), { flags: "a" });
  server.stdout.pipe(log);
  server.stderr.pipe(log);
  server.on("exit", (code) => {
    if (!app.isQuitting) dialog.showErrorBox("Penny", `Penny stopped unexpectedly (code ${code}). Details: ${path.join(app.getPath("userData"), "server.log")}`);
  });

  const url = `http://127.0.0.1:${port}`;
  win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 380,
    show: false,
    title: "Penny",
    backgroundColor: "#f5f5fa",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  // Links to other sites open in the user's browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (!target.startsWith(url)) shell.openExternal(target);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, target) => {
    if (!target.startsWith(url)) {
      e.preventDefault();
      shell.openExternal(target);
    }
  });
  win.once("ready-to-show", () => win.show());

  if (!(await waitFor(`${url}/api/health`))) {
    dialog.showErrorBox("Penny", "Penny did not start in time. Try opening it again.");
    return app.quit();
  }
  await win.loadURL(url);
}

app.whenReady().then(start);
app.on("before-quit", () => {
  app.isQuitting = true;
  if (server && !server.killed) server.kill();
});
app.on("window-all-closed", () => app.quit());
