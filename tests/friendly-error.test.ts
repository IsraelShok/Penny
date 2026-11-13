import { describe, expect, it } from "vitest";
import { friendlyError } from "@/lib/api";

describe("friendlyError", () => {
  it("keeps the server's text when it is already in the UI language", () => {
    expect(friendlyError(400, JSON.stringify({ error: "phone must be an Israeli number" }), "en")).toBe("phone must be an Israeli number");
    expect(friendlyError(400, JSON.stringify({ error: "הסכום לא תקין" }), "he")).toBe("הסכום לא תקין");
  });
  it("explains by status when the server spoke the other language", () => {
    expect(friendlyError(400, JSON.stringify({ error: "invalid amount" }), "he")).toContain("לא תקינים");
    expect(friendlyError(500, "Internal Server Error", "he")).toContain("השתבש");
  });
  it("never shows an HTML error page", () => {
    expect(friendlyError(502, "<html>Bad gateway</html>", "en")).toContain("Something went wrong");
  });
  it("has a message for a dropped connection", () => {
    expect(friendlyError("network", "", "he")).toContain("אין חיבור");
  });
});
