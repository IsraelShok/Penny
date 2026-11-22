// One exact case per rule, so a rule that is dropped or loosened fails here (found by Stryker).
import { it, expect, vi } from "vitest";
import { redact, redactKnownSecrets } from "@/server/lib/redact";

it("each rule replaces exactly what it names", () => {
  expect(redact("key sk-ant-abcdefghijklmnop1234 end")).toBe("key [key] end");
  expect(redact("bot 123456:ABCdefGHIjklMNOpqrSTUvwxYZ0123456789 end")).toBe("bot [token] end");
  expect(redact("Authorization: Bearer abc.def")).toBe("Authorization [redacted]");
  expect(redact("Bearer abc.def")).toBe("Bearer [redacted]");
  expect(redact("bearer=xyz")).toBe("bearer [redacted]");
  expect(redact('{"password":"hunter2","otp":"9"}')).toBe(
    '{"password":"[redacted]","otp":"[redacted]"}',
  );
  expect(redact("u?id=abc&num=12")).toBe("u?id=[redacted]&num=[redacted]");
  expect(redact("mail dana.cohen+x@mail.co.il now")).toBe("mail [email] now");
  expect(redact("card 4580 1234 5678 9012 ok")).toBe("card [number] ok");
  expect(redact("card 4580-1234-5678 ok")).toBe("card [number] ok");
  expect(redact("id 123456789 acc 12345")).toBe("id [number] acc [number]");
  // What must stay: dates, short numbers and amounts.
  expect(redact("on 14/11/2026 paid 120.50 for 4 items")).toBe(
    "on 14/11/2026 paid 120.50 for 4 items",
  );
});

it("known secrets are replaced verbatim, but never ones too short to replace safely", () => {
  expect(redactKnownSecrets("login failed for 1234/Passw0rd", ["Passw0rd", "1234"])).toBe(
    "login failed for [redacted]/[redacted]",
  );
  expect(redactKnownSecrets("a 123 b", ["123"])).toBe("a 123 b");
});

it("phone access lists only private IPv4 addresses of this machine", async () => {
  vi.resetModules();
  vi.doMock("os", async (orig) => {
    const real = (await orig()) as typeof import("os");
    const ifaces = {
      lo: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
      eth: [
        { address: "192.168.1.20", family: "IPv4", internal: false },
        { address: "172.20.0.5", family: "IPv4", internal: false },
        { address: "172.32.0.5", family: "IPv4", internal: false },
        { address: "8.8.8.8", family: "IPv4", internal: false },
        { address: "fe80::1", family: "IPv6", internal: false },
      ],
      wifi: [{ address: "10.0.0.7", family: "IPv4", internal: false }],
    };
    const m = { ...real, networkInterfaces: () => ifaces };
    return { ...m, default: m };
  });
  const { lanAddresses } = await import("@/server/lib/lan-access");
  expect(lanAddresses()).toEqual(["192.168.1.20", "172.20.0.5", "10.0.0.7"]);
  vi.doUnmock("os");
});
