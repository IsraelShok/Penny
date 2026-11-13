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
};
