import { it, expect } from "vitest";
import { toCsv } from "@/lib/csv";
import { allowedMemberRoute } from "@/server/lib/user-access";
import { escapeXml } from "../scripts/service/paths.mjs";

it("neutralises formula-looking text in CSV but keeps signed numbers", () => {
  expect(toCsv([["=HYPERLINK(1)", "@x", "+cmd", "-84.90", -5, "סופר"]])).toBe(
    "'=HYPERLINK(1),'@x,'+cmd,-84.90,-5,סופר",
  );
});

it("lets members read the bell and the pivot", () => {
  expect(allowedMemberRoute("/api/notifications", "GET", "viewer")).toBe(true);
  expect(allowedMemberRoute("/api/pivot", "GET", "viewer")).toBe(true);
  expect(allowedMemberRoute("/api/pivot", "POST", "editor")).toBe(false);
});

it("escapes paths for the XML service templates", () => {
  expect(escapeXml(`C:\Tom & Ann <"x">`)).toBe("C:\Tom &amp; Ann &lt;&quot;x&quot;&gt;");
});
