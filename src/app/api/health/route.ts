import { NextResponse } from "next/server";
import fs from "node:fs";
import pkg from "../../../../package.json";
import path from "node:path";
import { dataDir } from "@/server/lib/data-dir";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    version: pkg.version,
    hasDb: ["penny.db", "spent.db"].some((f) => fs.existsSync(path.join(dataDir(), f))), // legacy: spent.db; read-only, never migrates a DB in use
  });
}
