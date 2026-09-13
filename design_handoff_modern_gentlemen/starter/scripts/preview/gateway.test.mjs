import assert from "node:assert/strict";
import { createServer, request as httpRequest } from "node:http";
import { after, before, test } from "node:test";
import { previewConfig } from "./config.mjs";
import { createPreviewGateway } from "./gateway.mjs";

const env = {
  MG_PREVIEW: "1",
  MG_PREVIEW_SUPABASE_REF: "aaaaaaaaaaaaaaaaaaaa",
  MG_PREVIEW_SOURCE_SUPABASE_URL: "https://bbbbbbbbbbbbbbbbbbbb.supabase.co",
  NEXT_PUBLIC_SUPABASE_URL: "https://aaaaaaaaaaaaaaaaaaaa.supabase.co",
  NEXT_PUBLIC_SITE_URL: "https://preview.mg.test",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_fixture_only_123456789",
  MG_PREVIEW_USERNAME: "preview",
  MG_PREVIEW_PASSWORD: "fixture-password-only-01234567890123456789",
};

test("preview needs only its public app credentials and separate access gate", () => {
  assert.equal(previewConfig(env).upstreamPort, 8081);
});
for (const name of Object.keys(env)) {
  test("startup fails closed without " + name, () => {
    assert.throws(() => previewConfig({ ...env, [name]: "" }));
  });
}
test("rejects a source database as the preview target", () => {
  assert.throws(() =>
    previewConfig({ ...env, MG_PREVIEW_SOURCE_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL })
  );
});
test("rejects a database that does not match the independently configured reference", () => {
  assert.throws(() =>
    previewConfig({ ...env, NEXT_PUBLIC_SUPABASE_URL: env.MG_PREVIEW_SOURCE_SUPABASE_URL })
  );
});
for (const url of [
  "http://preview.mg.test",
  "https://user:password@preview.mg.test",
  "https://preview.mg.test/private",
  "https://preview.mg.test?token=bad",
]) {
  test("rejects unsafe site origin " + url, () => {
    assert.throws(() => previewConfig({ ...env, NEXT_PUBLIC_SITE_URL: url }));
  });
}
test("rejects weak gateway credentials and invalid ports", () => {
  assert.throws(() => previewConfig({ ...env, MG_PREVIEW_PASSWORD: "short" }));
  assert.throws(() => previewConfig({ ...env, MG_PREVIEW_USERNAME: "user:injection" }));
  assert.throws(() => previewConfig({ ...env, PORT: "65535" }));
});

let upstream;
let gateway;
let port;
let ready = true;
let upstreamRequests = 0;
const assetReplies = new Map();
const chunkPath = "/_next/static/chunks/main-15f9a5313c282223.js";
const assetHeaders = {
  "content-type": "application/javascript; charset=UTF-8",
  "cache-control": "public, max-age=31536000, immutable",
  "cdn-cache-control": "public, max-age=31536000",
  "surrogate-control": "max-age=31536000",
  "vercel-cdn-cache-control": "public, max-age=31536000",
  vary: "Accept-Encoding",
  etag: '"build-asset"',
};
const auth =
  "Basic " +
  Buffer.from(env.MG_PREVIEW_USERNAME + ":" + env.MG_PREVIEW_PASSWORD).toString("base64");

const listen = (server) => new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const close = (server) => new Promise((resolve) => server.close(resolve));
function get(path, headers = {}, method = "GET", body = "") {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ hostname: "127.0.0.1", port, path, headers, method }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () =>
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString(),
        })
      );
    });
    req.on("error", reject);
    req.end(body);
  });
}
before(async () => {
  upstream = createServer((req, res) => {
    upstreamRequests++;
    const asset = assetReplies.get(req.url);
    if (asset) {
      res.writeHead(asset.status ?? 200, { ...assetHeaders, ...asset.headers });
      return res.end("/* build asset */");
    }
    if (req.url === "/admin") {
      res.writeHead(307, {
        location: "https://localhost:" + upstream.address().port + "/sign-in?next=%2Fadmin",
      });
      return res.end();
    }
    if (req.url === "/external") {
      res.writeHead(302, { location: "https://external.mg.test/story" });
      return res.end();
    }
    if (req.url === "/clip.mp4") {
      res.writeHead(206, {
        "content-range": "bytes 2-5/10",
        "accept-ranges": "bytes",
        "content-length": 4,
        "cache-control": "public, max-age=31536000",
        "cdn-cache-control": "public, max-age=31536000",
      });
      res.write("23");
      return setImmediate(() => res.end("45"));
    }
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      res.writeHead(200, { "set-cookie": ["session=rotated; HttpOnly", "theme=dark"] });
      res.end(
        JSON.stringify({
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: Buffer.concat(chunks).toString(),
        })
      );
    });
  });
  await listen(upstream);
  gateway = createPreviewGateway(
    {
      ...previewConfig(env),
      upstreamPort: upstream.address().port,
    },
    () => ready
  );
  await listen(gateway);
  port = gateway.address().port;
});
after(async () => {
  await close(gateway);
  await close(upstream);
});

for (const path of ["/", "/admin", chunkPath, "/_next/image?url=x", "/clip.mp4"]) {
  test("requires preview access for " + path, async () => {
    const count = upstreamRequests;
    const res = await get(path);
    assert.equal(res.status, 401);
    assert.match(res.headers["www-authenticate"], /Basic/);
    assert.match(res.headers["x-robots-tag"], /noindex/);
    assert.match(res.headers["cache-control"], /no-store/);
    assert.equal(upstreamRequests, count);
  });
}
test("rejects incorrect and malformed credentials", async () => {
  for (const authorization of ["Basic eDp5", "Bearer anything", "Basic !broken"]) {
    assert.equal((await get("/", { authorization })).status, 401);
  }
});
test("health reveals only readiness, while robots excludes every route", async () => {
  ready = false;
  assert.equal((await get("/_mg-preview/health")).status, 503);
  assert.equal((await get("/", { authorization: auth })).status, 503);
  ready = true;
  assert.equal((await get("/_mg-preview/health")).body, "Ready");
  assert.equal((await get("/robots.txt")).body, "User-agent: *\nDisallow: /\n");
});
test("Railway's underscore health URL reports readiness without revealing content", async () => {
  ready = false;
  const starting = await get("/_mg_preview/health");
  assert.equal(starting.status, 503);
  assert.equal(starting.body, "Starting");
  ready = true;
  const result = await get("/_mg_preview/health");
  assert.equal(result.status, 200);
  assert.equal(result.body, "Ready");
  assert.match(result.headers["cache-control"], /no-store/);
  assert.match(result.headers["x-robots-tag"], /noindex/);
  assert.equal((await get("/_mg_preview/health/private")).status, 401);
});
test("preserves action bodies, session cookies and query strings while stripping gateway secrets", async () => {
  const result = await get(
    "/admin/actions?draft=1",
    {
      authorization: auth,
      cookie: "session=original",
      origin: env.NEXT_PUBLIC_SITE_URL,
      "x-forwarded-host": "attacker.test",
      "x-forwarded-proto": "http",
      "x-middleware-subrequest": "middleware",
      "content-type": "text/plain",
    },
    "POST",
    "draft content"
  );
  const echoed = JSON.parse(result.body);
  assert.equal(echoed.method, "POST");
  assert.equal(echoed.url, "/admin/actions?draft=1");
  assert.equal(echoed.body, "draft content");
  assert.equal(echoed.headers.cookie, "session=original");
  assert.equal(echoed.headers.authorization, undefined);
  assert.equal(echoed.headers["x-middleware-subrequest"], undefined);
  assert.equal(echoed.headers.host, "preview.mg.test");
  assert.equal(echoed.headers["x-forwarded-host"], "preview.mg.test");
  assert.equal(echoed.headers["x-forwarded-proto"], "https");
  assert.equal(echoed.headers.origin, env.NEXT_PUBLIC_SITE_URL);
  assert.deepEqual(result.headers["set-cookie"], ["session=rotated; HttpOnly", "theme=dark"]);
});
test("streams partial video responses and overrides upstream public caching", async () => {
  const result = await get("/clip.mp4", { authorization: auth, range: "bytes=2-5" });
  assert.equal(result.status, 206);
  assert.equal(result.body, "2345");
  assert.equal(result.headers["content-range"], "bytes 2-5/10");
  assert.equal(result.headers["accept-ranges"], "bytes");
  assert.match(result.headers["cache-control"], /no-store/);
  assert.equal(result.headers["cdn-cache-control"], undefined);
  assert.equal(result.headers["referrer-policy"], "strict-origin-when-cross-origin");
});
test("scheduled jobs stay unavailable even to an authenticated preview visitor", async () => {
  for (const path of [
    "/api/jobs/run-imports",
    "/%61pi/jobs/publish-scheduled",
    "/api%2fjobs/run-imports",
  ]) {
    assert.equal((await get(path, { authorization: auth })).status, 404);
  }
});
test("refuses forward-proxy requests", async () => {
  assert.equal((await get("https://attacker.test/", { authorization: auth })).status, 400);
  assert.equal((await get("//attacker.test/", { authorization: auth })).status, 400);
});

test("rewrites Next loopback redirects to the configured preview origin", async () => {
  const result = await get("/admin", { authorization: auth });
  assert.equal(result.status, 307);
  assert.equal(result.headers.location, "https://preview.mg.test/sign-in?next=%2Fadmin");
});

test("preserves deliberate external redirect destinations", async () => {
  const result = await get("/external", { authorization: auth });
  assert.equal(result.status, 302);
  assert.equal(result.headers.location, "https://external.mg.test/story");
});

test("allows private one-hour browser caching for fingerprinted build files", async () => {
  for (const [path, type] of [
    [chunkPath, "application/javascript; charset=UTF-8"],
    ["/_next/static/chunks/app/(admin)/admin/page-5d24891b9175f8a9.js", "text/javascript"],
    ["/_next/static/css/9fff25ee68667291.css", "text/css; charset=UTF-8"],
    ["/_next/static/media/d3ebbfd689654d3a-s.p.woff2", "font/woff2"],
  ]) {
    assetReplies.set(path, { headers: { "content-type": type } });
    for (const method of ["GET", "HEAD"]) {
      const res = await get(path, { authorization: auth }, method);
      assert.equal(res.status, 200);
      assert.equal(res.headers["cache-control"], "private, max-age=3600, must-revalidate");
      assert.equal(res.headers.vary, "Accept-Encoding, Authorization");
      assert.equal(res.headers.etag, '"build-asset"');
      assert.match(res.headers["x-robots-tag"], /noindex/);
      for (const name of ["cdn-cache-control", "surrogate-control", "vercel-cdn-cache-control"]) {
        assert.equal(res.headers[name], undefined);
      }
    }
  }
});

test("preserves conditional requests and private caching on a static 304", async () => {
  assetReplies.set(chunkPath, { status: 304, headers: { "content-type": "" } });
  const res = await get(chunkPath, { authorization: auth, "if-none-match": '"build-asset"' });
  assert.equal(res.status, 304);
  assert.equal(res.body, "");
  assert.equal(res.headers["cache-control"], "private, max-age=3600, must-revalidate");
  // Knowing the path and ETag never bypasses gateway authentication.
  const count = upstreamRequests;
  assert.equal((await get(chunkPath, { "if-none-match": '"build-asset"' })).status, 401);
  assert.equal(upstreamRequests, count);
});

test("keeps documents, uploads, dynamic URLs and ambiguous paths out of the cache", async () => {
  for (const path of [
    "/admin",
    "/api/search?q=style",
    "/_next/image?url=photo.jpg",
    "/media/15f9a5313c282223.js",
    "/_next/static/chunks/main.js",
    "/_next/static/build-id/_buildManifest.js",
    chunkPath + ".map",
    chunkPath + "?draft=1",
    chunkPath + "?",
    "/_next/static/chunks/../chunks/main-15f9a5313c282223.js",
    "/_next/static/chunks/%2e%2e/chunks/main-15f9a5313c282223.js",
    "/_next/static/chunks%2fmain-15f9a5313c282223.js",
  ]) {
    assetReplies.set(path, {});
    const res = await get(path, { authorization: auth });
    assert.equal(res.status, 200, path);
    assert.match(res.headers["cache-control"], /no-store/, path);
  }
});

test("never caches static-path errors, redirects, session responses or unsafe upstream policy", async () => {
  for (const fixture of [
    { status: 404 },
    { status: 500 },
    { status: 302, headers: { location: "/sign-in" } },
    { status: 206 },
    { headers: { "set-cookie": "session=rotated; HttpOnly" } },
    { headers: { "content-type": "text/html" } },
    { headers: { vary: "*" } },
    { headers: { "cache-control": "public, max-age=31536000" } },
    { headers: { "cache-control": "private, no-store, max-age=31536000, immutable" } },
    { headers: { "cache-control": "no-cache, max-age=31536000, immutable" } },
    { headers: { "cache-control": "max-age=60, immutable" } },
  ]) {
    assetReplies.set(chunkPath, fixture);
    const res = await get(chunkPath, { authorization: auth });
    assert.match(res.headers["cache-control"], /no-store/);
  }
  assetReplies.set(chunkPath, {});
  const res = await get(chunkPath, { authorization: auth }, "POST", "data");
  assert.match(res.headers["cache-control"], /no-store/);
});
