// electron-builder never copies node_modules through extraResources, but the standalone
// Next.js server needs its traced node_modules next to server.js, so copy them in after packing.
const fs = require("node:fs");
const path = require("node:path");

exports.default = async function afterPack(context) {
  const from = path.join(context.packager.projectDir, ".next", "standalone", "node_modules");
  const resources = context.electronPlatformName === "darwin"
    ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, "Contents", "Resources")
    : path.join(context.appOutDir, "resources");
  fs.cpSync(from, path.join(resources, "server", "node_modules"), { recursive: true, dereference: true });
  // The hashed external links under .next/node_modules are real folders in the build (see build-desktop.mjs), but copy them too in case they were skipped.
  const links = path.join(context.packager.projectDir, ".next", "standalone", ".next", "node_modules");
  if (fs.existsSync(links)) fs.cpSync(links, path.join(resources, "server", ".next", "node_modules"), { recursive: true, dereference: true });
  if (context.electronPlatformName === "darwin") adHocSign(path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`));
};

/**
 * Ad-hoc signature (no Apple Developer ID yet), so Apple Silicon runs the app. electron-builder's own signing walks
 * every folder ending in .app, and a server package has a plain JS folder named chrome.app, so sign here instead:
 * native modules one by one, then Electron's helpers and frameworks, then the app. Never --deep.
 */
function adHocSign(app) {
  const { execFileSync } = require("node:child_process");
  const sign = (p) => execFileSync("codesign", ["--force", "--sign", "-", p], { stdio: "inherit" });
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() && !e.isSymbolicLink() ? walk(p) : /\.(node|dylib)$/.test(e.name) ? [p] : [];
  });
  walk(path.join(app, "Contents", "Resources")).forEach(sign);
  const frameworks = path.join(app, "Contents", "Frameworks");
  for (const e of fs.readdirSync(frameworks)) sign(path.join(frameworks, e));
  sign(app);
}
