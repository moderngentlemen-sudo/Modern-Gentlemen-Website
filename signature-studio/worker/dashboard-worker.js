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
var src_default = {
  async fetch(req, env) {
    const url = new URL(req.url);
    const m = PATH.exec(url.pathname);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req, env, true) });
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
    const auth = req.headers.get("Authorization") ?? "";
    if (!env.UPLOAD_KEY || !timingSafeEqual(auth, `Bearer ${env.UPLOAD_KEY}`)) {
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
