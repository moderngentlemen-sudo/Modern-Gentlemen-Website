// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const KEY = "test-key-0123456789";
// 1×1 transparent PNG.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
const HASH = createHash("sha256").update(PNG).digest("hex");

let server;
let base;
let dir;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "ss-server-"));
  process.env.DATA_DIR = dir;
  process.env.UPLOAD_KEY = KEY;
  const mod = await import("./index.mjs");
  server = await mod.start(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((r) => server.close(r));
  await rm(dir, { recursive: true, force: true });
});

const put = (path, body, key = KEY) =>
  fetch(`${base}${path}`, { method: "PUT", body, headers: { "Content-Type": "image/png", ...(key ? { Authorization: `Bearer ${key}` } : {}) } });

describe("image host", () => {
  it("refuses uploads without the right key", async () => {
    expect((await put(`/s/${HASH}.png`, PNG, null)).status).toBe(401);
    expect((await put(`/s/${HASH}.png`, PNG, "wrong-key-0123456789")).status).toBe(401);
  });

  it("refuses bodies that don't match their name or type", async () => {
    expect((await put(`/s/${"0".repeat(64)}.png`, PNG)).status).toBe(422);
    expect((await put(`/s/${HASH}.jpg`, PNG)).status).toBe(415);
    const text = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>");
    const h = createHash("sha256").update(text).digest("hex");
    expect((await put(`/s/${h}.png`, text)).status).toBe(415);
  });

  it("refuses oversized uploads", async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(1024 * 1024 + 10)]);
    const h = createHash("sha256").update(big).digest("hex");
    expect((await put(`/s/${h}.png`, big)).status).toBe(413);
  });

  it("stores an image once and serves it publicly and immutably", async () => {
    const first = await put(`/s/${HASH}.png`, PNG);
    expect(first.status).toBe(201);
    expect((await first.json()).url).toBe(`${base}/s/${HASH}.png`);
    const again = await put(`/s/${HASH}.png`, PNG);
    expect(again.status).toBe(200);
    expect((await again.json()).existed).toBe(true);

    const res = await fetch(`${base}/s/${HASH}.png`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true);
  });

  it("uses forwarded headers for the public address (Railway proxy)", async () => {
    const h = createHash("sha256").update(Buffer.concat([PNG, Buffer.from([0])])).digest("hex");
    const res = await fetch(`${base}/s/${h}.png`, {
      method: "PUT",
      body: Buffer.concat([PNG, Buffer.from([0])]),
      headers: { Authorization: `Bearer ${KEY}`, "X-Forwarded-Proto": "https", "X-Forwarded-Host": "studio.example.com" },
    });
    expect((await res.json()).url).toBe(`https://studio.example.com/s/${h}.png`);
  });

  it("returns 404 for missing images", async () => {
    expect((await fetch(`${base}/s/${"a".repeat(64)}.png`)).status).toBe(404);
  });

  it("backs up every image as a tar archive, key required", async () => {
    expect((await fetch(`${base}/admin/backup.tar`)).status).toBe(401);
    const res = await fetch(`${base}/admin/backup.tar`, { headers: { Authorization: `Bearer ${KEY}` } });
    expect(res.status).toBe(200);
    const tar = Buffer.from(await res.arrayBuffer());
    expect(tar.length % 512).toBe(0);
    expect(tar.toString("latin1")).toContain(`${HASH}.png`);
    expect(tar.subarray(257, 262).toString("ascii")).toBe("ustar");
  });
});

describe("app hosting", () => {
  it("answers the health check", async () => {
    const res = await fetch(`${base}/healthz`);
    expect(res.status).toBe(200);
  });

  it("never serves files outside the app folder", async () => {
    for (const p of ["/../package.json", "/%2e%2e/package.json", "/..%2fpackage.json", "/server/index.mjs"]) {
      const res = await fetch(`${base}${p}`);
      const body = await res.text();
      expect(body, p).not.toContain("signature-studio");
      expect(body, p).not.toContain("UPLOAD_KEY");
    }
  });
});
