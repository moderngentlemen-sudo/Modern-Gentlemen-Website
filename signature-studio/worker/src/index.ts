/**
 * Signature Studio image host — Cloudflare Worker + R2.
 *
 *   PUT  /s/<sha256>.<png|jpg|gif>   upload (Authorization: Bearer <UPLOAD_KEY>)
 *   GET  /s/<sha256>.<ext>           public, immutable, CORS-enabled
 *   HEAD /s/<sha256>.<ext>
 *   GET  /admin/backup.tar           every image as one .tar (Authorization: Bearer <UPLOAD_KEY>)
 *
 * Guarantees:
 *  - Keys are content hashes: the body must hash to the key, so objects are
 *    immutable and deduplicated, and paths carry no personal data.
 *  - Only PNG / JPEG / GIF (verified by magic bytes), max 1 MB.
 *  - The Worker never fetches remote URLs (no SSRF surface).
 *  - Nothing is ever deleted or overwritten by uploads.
 */

export interface Env {
  IMAGES: R2Bucket;
  UPLOAD_KEY: string;
  /** Comma-separated origins allowed to upload (e.g. https://studio.example.com). */
  ALLOWED_ORIGINS?: string;
}

const MAX_BYTES = 1024 * 1024;
const PATH = /^\/s\/([0-9a-f]{64})\.(png|jpg|gif)$/;
const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", gif: "image/gif" };

function sniff(bytes: Uint8Array): string | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length > 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "gif";
  return null;
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function cors(req: Request, env: Env, write = false): Record<string, string> {
  if (!write) return { "Access-Control-Allow-Origin": "*" };
  const origin = req.headers.get("Origin") ?? "";
  const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0] ?? "null",
    "Access-Control-Allow-Methods": "GET, HEAD, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function authorized(req: Request, env: Env): boolean {
  return !!env.UPLOAD_KEY && timingSafeEqual(req.headers.get("Authorization") ?? "", `Bearer ${env.UPLOAD_KEY}`);
}

/** One ustar header block for a file. */
function tarHeader(name: string, size: number, mtime: number): Uint8Array {
  const h = new Uint8Array(512);
  const put = (str: string, offset: number) => {
    for (let i = 0; i < str.length; i++) h[offset + i] = str.charCodeAt(i);
  };
  const oct = (n: number, len: number) => n.toString(8).padStart(len - 1, "0") + "\0";
  put(name, 0);
  put(oct(0o644, 8), 100);
  put(oct(0, 8), 108);
  put(oct(0, 8), 116);
  put(oct(size, 12), 124);
  put(oct(Math.floor(mtime / 1000), 12), 136);
  put("        ", 148);
  put("0", 156);
  put("ustar\0", 257);
  put("00", 263);
  const sum = h.reduce((a, b) => a + b, 0);
  put(sum.toString(8).padStart(6, "0") + "\0 ", 148);
  return h;
}

/** Stream every stored image as a .tar archive (upload key required). */
async function backup(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const headers = cors(req, env, true);
  if (!authorized(req, env)) return new Response("Unauthorized", { status: 401, headers });
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const write = async () => {
    const w = writable.getWriter();
    try {
      let cursor: string | undefined;
      do {
        const page = await env.IMAGES.list({ prefix: "s/", cursor });
        for (const o of page.objects) {
          const obj = await env.IMAGES.get(o.key);
          if (!obj) continue;
          const data = new Uint8Array(await obj.arrayBuffer());
          await w.write(tarHeader(o.key.slice(2), data.length, o.uploaded.getTime()));
          await w.write(data);
          const pad = (512 - (data.length % 512)) % 512;
          if (pad) await w.write(new Uint8Array(pad));
        }
        cursor = page.truncated ? page.cursor : undefined;
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
      "Content-Disposition": `attachment; filename="signature-images-${new Date().toISOString().slice(0, 10)}.tar"`,
      "Cache-Control": "no-store",
    },
  });
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
        ETag: `"${hash}"`,
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
    if ((await sha256Hex(buf)) !== hash) return new Response("Hash mismatch", { status: 422, headers: cors(req, env, true) });

    const publicUrl = `${url.origin}/${key}`;
    const existing = await env.IMAGES.head(key);
    if (!existing) await env.IMAGES.put(key, buf, { httpMetadata: { contentType: MIME[ext], cacheControl: "public, max-age=31536000, immutable" } });
    return Response.json({ url: publicUrl, existed: !!existing }, { status: existing ? 200 : 201, headers: cors(req, env, true) });
  },
};
