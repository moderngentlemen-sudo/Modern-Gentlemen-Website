// Signature Studio image host: plain-JavaScript copy of src/index.ts for the
// Cloudflare dashboard's online editor (no terminal needed, e.g. on an iPad).
// Generated from src/index.ts with esbuild; edit src/index.ts, not this file.
// Requires: an R2 bucket binding named IMAGES, a secret UPLOAD_KEY, and a
// text variable ALLOWED_ORIGINS. See README.md.

const MAX_BYTES = 1024 * 1024;
const PATH = /^\/s\/([0-9a-f]{64})\.(png|jpg|gif)$/;
const MIME = { png: "image/png", jpg: "image/jpeg", gif: "image/gif" };
function sniff(bytes) {
  if (bytes.length > 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) return "png";
  if (bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpg";
  if (bytes.length > 6 && bytes[0] === 71 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 56) return "gif";
  return null;
}
async function sha256Hex(buf) {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function cors(req, env, write = false) {
  if (!write) return { "Access-Control-Allow-Origin": "*" };
  const origin = req.headers.get("Origin") ?? "";
  const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0] ?? "null",
    "Access-Control-Allow-Methods": "GET, HEAD, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}
function authorized(req, env) {
  return !!env.UPLOAD_KEY && timingSafeEqual(req.headers.get("Authorization") ?? "", `Bearer ${env.UPLOAD_KEY}`);
}
function tarHeader(name, size, mtime) {
  const h = new Uint8Array(512);
  const put = (str, offset) => {
    for (let i = 0; i < str.length; i++) h[offset + i] = str.charCodeAt(i);
  };
  const oct = (n, len) => n.toString(8).padStart(len - 1, "0") + "\0";
  put(name, 0);
  put(oct(420, 8), 100);
  put(oct(0, 8), 108);
  put(oct(0, 8), 116);
  put(oct(size, 12), 124);
  put(oct(Math.floor(mtime / 1e3), 12), 136);
  put("        ", 148);
  put("0", 156);
  put("ustar\0", 257);
  put("00", 263);
  const sum = h.reduce((a, b) => a + b, 0);
  put(sum.toString(8).padStart(6, "0") + "\0 ", 148);
  return h;
}
async function backup(req, env, ctx) {
  const headers = cors(req, env, true);
  if (!authorized(req, env)) return new Response("Unauthorized", { status: 401, headers });
  const { readable, writable } = new TransformStream();
  const write = async () => {
    const w = writable.getWriter();
    try {
      let cursor;
      do {
        const page = await env.IMAGES.list({ prefix: "s/", cursor });
        for (const o of page.objects) {
          const obj = await env.IMAGES.get(o.key);
          if (!obj) continue;
          const data = new Uint8Array(await obj.arrayBuffer());
          await w.write(tarHeader(o.key.slice(2), data.length, o.uploaded.getTime()));
          await w.write(data);
          const pad = (512 - data.length % 512) % 512;
          if (pad) await w.write(new Uint8Array(pad));
        }
        cursor = page.truncated ? page.cursor : void 0;
      } while (cursor);
      await w.write(new Uint8Array(1024));
      await w.close();
    } catch (err) {
      await w.abort(err);
    }
  };
  ctx.waitUntil(write());
  return new Response(readable, {
    headers: {
      ...headers,
      "Content-Type": "application/x-tar",
      "Content-Disposition": `attachment; filename="signature-images-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.tar"`,
      "Cache-Control": "no-store"
    }
  });
}
var src_default = {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const m = PATH.exec(url.pathname);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req, env, true) });
    if (url.pathname === "/admin/backup.tar" && req.method === "GET") return backup(req, env, ctx);
    if (!m) return new Response("Not found", { status: 404 });
    const [, hash, ext] = m;
    const key = `s/${hash}.${ext}`;
    if (req.method === "GET" || req.method === "HEAD") {
      const obj = await env.IMAGES.get(key);
      if (!obj) return new Response("Not found", { status: 404, headers: cors(req, env) });
      const headers = {
        ...cors(req, env),
        "Content-Type": MIME[ext],
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
        ETag: `"${hash}"`
      };
      return new Response(req.method === "HEAD" ? null : obj.body, { headers });
    }
    if (req.method !== "PUT") return new Response("Method not allowed", { status: 405 });
    if (!authorized(req, env)) {
      return new Response("Unauthorized", { status: 401, headers: cors(req, env, true) });
    }
    const len = Number(req.headers.get("Content-Length") ?? "0");
    if (len > MAX_BYTES) return new Response("Too large", { status: 413, headers: cors(req, env, true) });
    const buf = await req.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return new Response("Bad size", { status: 413, headers: cors(req, env, true) });
    const kind = sniff(new Uint8Array(buf, 0, Math.min(16, buf.byteLength)));
    if (kind !== ext) return new Response("Unsupported or mismatched image type", { status: 415, headers: cors(req, env, true) });
    if (await sha256Hex(buf) !== hash) return new Response("Hash mismatch", { status: 422, headers: cors(req, env, true) });
    const publicUrl = `${url.origin}/${key}`;
    const existing = await env.IMAGES.head(key);
    if (!existing) await env.IMAGES.put(key, buf, { httpMetadata: { contentType: MIME[ext], cacheControl: "public, max-age=31536000, immutable" } });
    return Response.json({ url: publicUrl, existed: !!existing }, { status: existing ? 200 : 201, headers: cors(req, env, true) });
  }
};
export {
  src_default as default
};
