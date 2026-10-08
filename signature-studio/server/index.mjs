// Signature Studio server: serves the built app AND hosts signature images.
// No dependencies, Node 22+. Deployed on Railway with a persistent volume.
//
//   GET  /                         the app (files from ./dist)
//   PUT  /s/<sha256>.<png|jpg|gif> upload an image (Authorization: Bearer <UPLOAD_KEY>)
//   GET  /s/<sha256>.<ext>         public, immutable image
//   GET  /admin/backup.tar         every image as one .tar (Bearer key required)
//   GET  /healthz                  health check
//
// Environment:
//   PORT         port to listen on (Railway sets it)
//   UPLOAD_KEY   required for uploads and backups
//   DATA_DIR     where images are stored. Defaults to the Railway volume
//                (RAILWAY_VOLUME_MOUNT_PATH), else ./.dev-host
//   PUBLIC_URL   optional fixed public origin for image links, e.g. https://img.example.com
//
// Guarantees: keys are content hashes (the body must hash to its name), so
// images are immutable, deduplicated and contain no personal data in their
// path. Only PNG/JPEG/GIF (checked by magic bytes), max 1 MB. Nothing is ever
// overwritten. The server never fetches remote URLs.

import { createServer } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DIST = join(ROOT, "dist");
const DATA_DIR = resolve(process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || join(ROOT, ".dev-host"));
const IMAGES = join(DATA_DIR, "images");
const PORT = Number(process.env.PORT || 8787);
const UPLOAD_KEY = process.env.UPLOAD_KEY || "";
const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const MAX_BYTES = 1024 * 1024;

const IMAGE_PATH = /^\/s\/([0-9a-f]{64})\.(png|jpg|gif)$/;
const IMAGE_MIME = { png: "image/png", jpg: "image/jpeg", gif: "image/gif" };
const STATIC_MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

const SECURITY = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

export function sniff(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "gif";
  return null;
}

function authorized(req) {
  if (!UPLOAD_KEY) return false;
  const given = Buffer.from(req.headers.authorization || "");
  const expected = Buffer.from(`Bearer ${UPLOAD_KEY}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY, ...headers });
  res.end(body);
}

function publicOrigin(req) {
  if (PUBLIC_URL) return PUBLIC_URL;
  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || `localhost:${PORT}`).split(",")[0].trim();
  return `${proto}://${host}`;
}

function readBody(req, limit) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error("too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolveBody(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function exists(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

// --- images ---------------------------------------------------------------------

async function handleImage(req, res, hash, ext) {
  const file = join(IMAGES, `${hash}.${ext}`);
  if (req.method === "GET" || req.method === "HEAD") {
    if (!(await exists(file))) return send(res, 404, "Not found", { ...CORS, "Content-Type": "text/plain" });
    const { size } = await stat(file);
    res.writeHead(200, {
      ...SECURITY,
      ...CORS,
      "Content-Type": IMAGE_MIME[ext],
      "Content-Length": size,
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: `"${hash}"`,
      "Content-Security-Policy": "default-src 'none'",
    });
    if (req.method === "HEAD") return res.end();
    return createReadStream(file).pipe(res);
  }
  if (req.method !== "PUT") return send(res, 405, "Method not allowed", CORS);
  if (!authorized(req)) return send(res, 401, "Unauthorized", CORS);
  if (Number(req.headers["content-length"] || 0) > MAX_BYTES) return send(res, 413, "Too large", CORS);
  let body;
  try {
    body = await readBody(req, MAX_BYTES);
  } catch (err) {
    return send(res, err.status || 400, "Bad upload", CORS);
  }
  if (!body.length) return send(res, 400, "Empty upload", CORS);
  if (sniff(body) !== ext) return send(res, 415, "Unsupported or mismatched image type", CORS);
  if (createHash("sha256").update(body).digest("hex") !== hash) return send(res, 422, "Hash mismatch", CORS);
  const url = `${publicOrigin(req)}/s/${hash}.${ext}`;
  const existed = await exists(file);
  if (!existed) {
    // Write atomically so a reader never sees a half-written image.
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, body);
    await rename(tmp, file);
  }
  return send(res, existed ? 200 : 201, JSON.stringify({ url, existed }), { ...CORS, "Content-Type": "application/json" });
}

// --- backup (ustar archive of every image) --------------------------------------

function tarHeader(name, size, mtime) {
  const h = Buffer.alloc(512, 0);
  const put = (str, offset, len) => h.write(str, offset, len, "ascii");
  const oct = (n, len) => n.toString(8).padStart(len - 1, "0") + "\0";
  put(name, 0, 100);
  put(oct(0o644, 8), 100, 8);
  put(oct(0, 8), 108, 8);
  put(oct(0, 8), 116, 8);
  put(oct(size, 12), 124, 12);
  put(oct(Math.floor(mtime / 1000), 12), 136, 12);
  put("        ", 148, 8);
  put("0", 156, 1);
  put("ustar\0", 257, 6);
  put("00", 263, 2);
  let sum = 0;
  for (const b of h) sum += b;
  put(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8);
  return h;
}

async function handleBackup(req, res) {
  if (!authorized(req)) return send(res, 401, "Unauthorized", CORS);
  const names = (await readdir(IMAGES)).filter((n) => /^[0-9a-f]{64}\.(png|jpg|gif)$/.test(n)).sort();
  res.writeHead(200, {
    ...SECURITY,
    ...CORS,
    "Content-Type": "application/x-tar",
    "Content-Disposition": `attachment; filename="signature-images-${new Date().toISOString().slice(0, 10)}.tar"`,
    "Cache-Control": "no-store",
  });
  for (const name of names) {
    const data = await readFile(join(IMAGES, name));
    const { mtimeMs } = await stat(join(IMAGES, name));
    res.write(tarHeader(name, data.length, mtimeMs));
    res.write(data);
    const pad = (512 - (data.length % 512)) % 512;
    if (pad) res.write(Buffer.alloc(pad, 0));
  }
  res.end(Buffer.alloc(1024, 0));
}

// --- the app (static files from ./dist) ------------------------------------------

async function handleStatic(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed");
  let rel;
  try {
    rel = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, "");
  } catch {
    return send(res, 400, "Bad request");
  }
  let file = resolve(DIST, rel || "index.html");
  if (file !== DIST && !file.startsWith(DIST + sep)) return send(res, 404, "Not found");
  if (!(await exists(file))) {
    // The app has a single page; anything unknown without an extension gets it.
    if (extname(file)) return send(res, 404, "Not found", { "Content-Type": "text/plain" });
    file = join(DIST, "index.html");
    if (!(await exists(file))) return send(res, 503, "The app has not been built. Run npm run build.", { "Content-Type": "text/plain" });
  }
  const isAsset = file.includes(`${sep}assets${sep}`);
  const { size } = await stat(file);
  res.writeHead(200, {
    ...SECURITY,
    "Content-Type": STATIC_MIME[extname(file)] || "application/octet-stream",
    "Content-Length": size,
    // Built assets have content hashes in their names; index.html must stay fresh.
    "Cache-Control": isAsset ? "public, max-age=31536000, immutable" : "no-cache",
  });
  if (req.method === "HEAD") return res.end();
  createReadStream(file).pipe(res);
}

// --- server -----------------------------------------------------------------------

export async function start(port = PORT) {
  await mkdir(IMAGES, { recursive: true });
  const server = createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url || "/", "http://x");
      if (req.method === "OPTIONS") return send(res, 204, null, CORS);
      if (pathname === "/healthz") return send(res, 200, "ok", { "Content-Type": "text/plain", "Cache-Control": "no-store" });
      const m = IMAGE_PATH.exec(pathname);
      if (m) return await handleImage(req, res, m[1], m[2]);
      if (pathname.startsWith("/s/")) return send(res, 404, "Not found", CORS);
      if (pathname === "/admin/backup.tar") return await handleBackup(req, res);
      return await handleStatic(req, res, pathname);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) send(res, 500, "Server error");
      else res.end();
    }
  });
  await new Promise((r) => server.listen(port, "0.0.0.0", r));
  console.log(`Signature Studio on port ${port} · images in ${IMAGES}${UPLOAD_KEY ? "" : " · UPLOAD_KEY not set: uploads disabled"}`);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) start();
