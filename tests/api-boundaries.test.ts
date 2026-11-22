import { describe, it, expect, beforeAll } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";

// Boundary bodies every mutating route must answer with 4xx (never 5xx): empty, broken JSON, JSON null, wrong shapes.
const BAD_BODIES: (string | undefined)[] = [
  undefined,
  "not json",
  "null",
  "[]",
  "{}",
  '"x"',
  JSON.stringify({ categoryId: "abc", amount: "x" }),
];
const BAD_IDS = ["0", "-1", "999999", "abc", "1.5"];

type Handler = (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
const req = (method: string, body?: string) =>
  new Request("http://127.0.0.1/api/x", {
    method,
    headers: { "content-type": "application/json" },
    body,
  });

beforeAll(() => {
  process.env.PENNY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "penny-bounds-"));
});

async function expect4xx(name: string, h: Handler, method: string, id = "1") {
  for (const body of BAD_BODIES) {
    const res = await h(req(method, body), { params: Promise.resolve({ id }) });
    expect(res.status, `${method} ${name} id=${id} body=${body}`).toBeGreaterThanOrEqual(400);
    expect(res.status, `${method} ${name} id=${id} body=${body}`).toBeLessThan(500);
  }
}

describe("API boundaries: invalid bodies give 4xx, not 500", () => {
  it("budgets PUT", async () => {
    const m = await import("@/app/api/budgets/route");
    await expect4xx("budgets", m.PUT as Handler, "PUT");
  });
  it("budgets PUT rejects non-numeric, negative and infinite amounts", async () => {
    const { PUT } = await import("@/app/api/budgets/route");
    for (const raw of ['"x"', "-1", "1e400", "true"]) {
      const res = await PUT(req("PUT", `{"categoryId":1,"amount":${raw}}`));
      expect(res.status).toBe(400);
    }
  });
  it("categories POST and PATCH", async () => {
    const c = await import("@/app/api/categories/route");
    await expect4xx("categories", c.POST as Handler, "POST");
    const ci = await import("@/app/api/categories/[id]/route");
    for (const id of BAD_IDS) await expect4xx("categories/[id]", ci.PATCH as Handler, "PATCH", id);
  });
  it("transactions/manual POST, PATCH and DELETE", async () => {
    const m = await import("@/app/api/transactions/manual/route");
    await expect4xx("transactions/manual", m.POST as unknown as Handler, "POST");
    for (const id of BAD_IDS) {
      const url = `http://127.0.0.1/api/transactions/manual?id=${id}`;
      for (const body of BAD_BODIES) {
        const res = await m.PATCH(
          new Request(url, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body,
          }),
        );
        expect(res.status, `PATCH id=${id} body=${body}`).toBeGreaterThanOrEqual(400);
        expect(res.status).toBeLessThan(500);
      }
      const del = await m.DELETE(new Request(url, { method: "DELETE" }));
      expect(del.status, `DELETE id=${id}`).toBeGreaterThanOrEqual(400);
      expect(del.status).toBeLessThan(500);
    }
  });
  it("categorize/apply POST", async () => {
    const m = await import("@/app/api/categorize/apply/route");
    await expect4xx("categorize/apply", m.POST as Handler, "POST");
  });
  it("import POST", async () => {
    const m = await import("@/app/api/import/route");
    await expect4xx("import", m.POST as Handler, "POST");
  });
  it("settings PUT", async () => {
    const m = await import("@/app/api/settings/route");
    for (const body of [undefined, "not json", "null", "[]"]) {
      const res = await (m.PUT as Handler)(req("PUT", body), {
        params: Promise.resolve({ id: "" }),
      });
      expect(res.status, String(body)).toBe(400);
    }
  });
  it("setup/ai POST rejects unknown providers", async () => {
    const m = await import("@/app/api/setup/ai/route");
    await expect4xx("setup/ai", m.POST as Handler, "POST");
  });
  it("transactions cash/owners/exclude/[id]", async () => {
    await expect4xx(
      "transactions/cash",
      (await import("@/app/api/transactions/cash/route")).POST as Handler,
      "POST",
    );
    await expect4xx(
      "transactions/owners",
      (await import("@/app/api/transactions/owners/route")).PUT as Handler,
      "PUT",
    );
    const ex = (await import("@/app/api/transactions/[id]/exclude/route")).POST as Handler;
    const tx = await import("@/app/api/transactions/[id]/route");
    for (const id of BAD_IDS) {
      await expect4xx("transactions/[id]/exclude", ex, "POST", id);
      await expect4xx("transactions/[id]", tx.PUT as Handler, "PUT", id);
      await expect4xx("transactions/[id]", tx.PATCH as Handler, "PATCH", id);
    }
  });
});

describe("API boundaries: text, ids and profiles", () => {
  const json = (method: string, body: unknown, headers: Record<string, string> = {}) =>
    new Request("http://127.0.0.1/api/x", {
      method,
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });

  it("category names: 40 chars ok, 41 rejected, duplicate 409, markup stored as plain text", async () => {
    const { POST } = await import("@/app/api/categories/route");
    const { DELETE } = await import("@/app/api/categories/[id]/route");
    const ok = await POST(json("POST", { name: "א".repeat(40), kind: "expense" }));
    expect(ok.status).toBeLessThan(300);
    const created = (await ok.json()) as { id: number };
    expect((await POST(json("POST", { name: "א".repeat(41), kind: "expense" }))).status).toBe(400);
    expect((await POST(json("POST", { name: "א".repeat(40), kind: "expense" }))).status).toBe(409);
    const xss = await POST(json("POST", { name: "<img src=x onerror=alert(1)>", kind: "expense" }));
    expect(xss.status).toBeLessThan(300);
    const x = (await xss.json()) as { id: number; name: string };
    expect(x.name).toBe("<img src=x onerror=alert(1)>");
    for (const c of [created, x])
      await DELETE(new Request("http://127.0.0.1/api/x", { method: "DELETE" }), {
        params: Promise.resolve({ id: String(c.id) }),
      });
  });

  it("profiles: invalid ids 404, the last profile cannot be deleted, a bad x-profile-id never 500s", async () => {
    const p = await import("@/app/api/profiles/[id]/route");
    for (const id of BAD_IDS) {
      const res = await p.DELETE(new Request("http://127.0.0.1/api/x", { method: "DELETE" }), {
        params: Promise.resolve({ id }),
      });
      expect(res.status, id).toBeGreaterThanOrEqual(400);
      expect(res.status, id).toBeLessThan(500);
    }
    const list = (await (await (await import("@/app/api/profiles/route")).GET()).json()) as {
      id: number;
    }[];
    if (list.length === 1) {
      const res = await p.DELETE(new Request("http://127.0.0.1/api/x", { method: "DELETE" }), {
        params: Promise.resolve({ id: String(list[0].id) }),
      });
      expect(res.status).toBe(409);
    }
    const s = await import("@/app/api/settings/route");
    for (const h of ["abc", "-1", "0", "999999", "1e400"]) {
      const res = await s.GET(
        new Request("http://127.0.0.1/api/settings", { headers: { "x-profile-id": h } }),
      );
      expect(res.status, h).toBeLessThan(500);
    }
  });
});

describe("delete-all transactions requires explicit confirmation", () => {
  it("refuses without the confirm token and accepts with it", async () => {
    const { DELETE } = await import("@/app/api/data/transactions/route");
    for (const body of [undefined, "{}", '{"confirm":"yes"}', "null"]) {
      expect((await DELETE(req("DELETE", body))).status).toBe(400);
    }
    const ok = await DELETE(req("DELETE", JSON.stringify({ confirm: "delete-all-transactions" })));
    expect(ok.status).toBe(200);
  });
});
