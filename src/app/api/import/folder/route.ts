import { NextResponse } from "next/server";
import fs from "fs";
import { spawn } from "child_process";
import {
  getFolderImportConfig,
  scanImportFolder,
  updateFolderImportConfig,
} from "@/server/lib/folder-import";
import { validateDir } from "@/server/lib/legacy-export";

const fail = (e: unknown) =>
  NextResponse.json({ error: e instanceof Error ? e.message : "invalid" }, { status: 400 });

/** Folder auto-import settings and recent history. */
export async function GET() {
  return NextResponse.json(getFolderImportConfig());
}

export async function PATCH(request: Request) {
  try {
    return NextResponse.json(updateFolderImportConfig(await request.json()));
  } catch (e) {
    return fail(e);
  }
}

/** { action: "scan" } scans now; { action: "open" } opens the folder. */
export async function POST(request: Request) {
  try {
    const { action } = (await request.json()) as { action?: unknown };
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
}
