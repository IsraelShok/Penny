import { describe, expect, it } from "vitest";
import { redact, redactError } from "@/server/lib/redact";

describe("redact", () => {
  it("removes secrets, emails and long numbers", () => {
    const s = redact(
      'fail {"password":"hunter2"} id=123456789 sk-ant-api03-abcdefghijklmnopqrstuv me@x.co 1234-5678-9012-3456 bot 123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsawq',
    );
    expect(s).not.toMatch(/hunter2|123456789|abcdefghij|me@x\.co|9012|AAHdq/);
  });

  it("keeps amounts and dates", () => {
    expect(redact("שופרסל 120.50 on 2026-11-06")).toBe("שופרסל 120.50 on 2026-11-06");
  });

  it("redacts error messages", () => {
    expect(redactError(new Error("account 9876543 locked"))).toBe("Error: account [number] locked");
  });
});
