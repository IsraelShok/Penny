import { handle, readJson, domainMessage } from "@/server/lib/api-error";
import { NextResponse } from "next/server";
import fs from "fs";
import { spawn } from "child_process";
import {
  getFolderImportConfig,
  scanImportFolder,
  updateFolderImportConfig,
} from "@/server/lib/folder-import";
import { validateDir } from "@/server/lib/legacy-export";

/** A validation key ("notAbsolute") or a malformed body answers 400; disk and database trouble (it carries a code) goes to handle(). */
const fail = (e: unknown) => {
  if (e instanceof Error && "code" in e) throw e;
  return NextResponse.json({ error: domainMessage(e) ?? "invalid" }, { status: 400 });
};

/** Folder auto-import settings and recent history. */
export const GET = handle("import/folder", async () => {
  return NextResponse.json(getFolderImportConfig());
});

export const PATCH = handle("import/folder", async (request: Request) => {
  try {
    return NextResponse.json(updateFolderImportConfig(await readJson(request)));
  } catch (e) {
    return fail(e);
  }
});

/** { action: "scan" } scans now; { action: "open" } opens the folder. */
export const POST = handle("import/folder", async (request: Request) => {
  try {
    const { action } = (await readJson(request)) as { action?: unknown };
    if (action === "scan") return NextResponse.json(await scanImportFolder(true));
    if (action !== "open") throw new Error("invalid action");
    const dir = validateDir(getFolderImportConfig().dir);
    fs.mkdirSync(dir, { recursive: true });
    const cmd =
      process.platform === "win32"
        ? "explorer"
        : process.platform === "darwin"
          ? "open"
          : "xdg-open";
    spawn(cmd, [dir], { detached: true, stdio: "ignore" })
      .on("error", () => {})
      .unref();
    return NextResponse.json(getFolderImportConfig());
  } catch (e) {
    return fail(e);
  }
});
