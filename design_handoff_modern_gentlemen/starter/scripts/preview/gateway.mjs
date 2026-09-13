import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, request as httpRequest } from "node:http";

const hash = (value) => createHash("sha256").update(value).digest();
const privateHeaders = {
  "cache-control": "private, no-store, max-age=0",
  "x-robots-tag": "noindex, nofollow, noarchive",
  "referrer-policy": "strict-origin-when-cross-origin",
};

function canCacheBuildAsset(request, incoming) {
  // Only canonical, fingerprinted build files can enter the browser cache.
  // Documents, image optimization, uploads, manifests and source maps stay fresh.
  if (!["GET", "HEAD"].includes(request.method) || request.url.includes("?")) return false;
  const path = request.url;
  let expectedType;
  if (
    /^\/_next\/static\/chunks\/(?:[A-Za-z0-9_()[\]-]+\/)*(?:[A-Za-z0-9_-]+-)?[a-f0-9]{16}\.js$/.test(
      path
    )
  ) {
    expectedType = /^(?:application|text)\/javascript$/;
  } else if (/^\/_next\/static\/css\/[a-f0-9]{16}\.css$/.test(path)) {
    expectedType = /^text\/css$/;
  } else if (/^\/_next\/static\/media\/[a-f0-9]{16}(?:-s(?:\.p)?)?\.woff2$/.test(path)) {
    expectedType = /^font\/woff2$/;
  } else {
    return false;
  }
  const headers = incoming.headers;
  const policy = String(headers["cache-control"] || "");
  const maxAge = /(?:^|,)\s*max-age=(\d+)\s*(?:,|$)/i.exec(policy);
  const contentType = String(headers["content-type"] || "")
    .split(";")[0]
    .trim();
  return (
    [200, 304].includes(incoming.statusCode) &&
    !headers["set-cookie"] &&
    !headers.location &&
    !String(headers.vary || "")
      .split(",")
      .some((name) => name.trim() === "*") &&
    /(?:^|,)\s*immutable\s*(?:,|$)/i.test(policy) &&
    !/\b(?:no-store|no-cache)\b/i.test(policy) &&
    Number(maxAge?.[1]) >= 3600 &&
    (expectedType.test(contentType) || (incoming.statusCode === 304 && !contentType))
  );
}

function end(response, status, text, extra = {}) {
  response.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    ...privateHeaders,
    ...extra,
  });
  response.end(text);
}

function stripHopHeaders(headers) {
  const result = { ...headers };
  const connection = String(headers.connection || "").split(",");
  for (const name of [
    ...connection,
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
  ]) {
    delete result[name.trim().toLowerCase()];
  }
  return result;
}

/** Stream requests to loopback Next without changing its renderer or middleware. */
export function createPreviewGateway(config, isReady = () => true) {
  const credentialHash = hash(config.username + ":" + config.password);
  return createServer((request, response) => {
    // Accept origin-form requests only; this is never an open forward proxy.
    if (!request.url?.startsWith("/") || request.url.startsWith("//")) {
      return end(response, 400, "Invalid request");
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, config.site).pathname);
    } catch {
      return end(response, 400, "Invalid request");
    }
    if (pathname === "/_mg-preview/health") {
      return end(response, isReady() ? 200 : 503, isReady() ? "Ready" : "Starting");
    }
    if (pathname === "/robots.txt") {
      return end(response, 200, "User-agent: *\nDisallow: /\n");
    }
    const authorization = request.headers.authorization || "";
    const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(authorization);
    const supplied = match ? Buffer.from(match[1], "base64").toString("utf8") : "";
    if (!match || !timingSafeEqual(hash(supplied), credentialHash)) {
      return end(response, 401, "Preview access required", {
        "www-authenticate": 'Basic realm="MG Preview", charset="UTF-8"',
      });
    }
    if (!isReady()) return end(response, 503, "Starting");
    if (pathname === "/api/jobs" || pathname.startsWith("/api/jobs/")) {
      return end(response, 404, "Not found");
    }
    const headers = stripHopHeaders(request.headers);
    delete headers.authorization;
    delete headers["x-middleware-subrequest"];
    // Use the configured public host for redirects and Server Action origin checks.
    headers.host = config.site.host;
    headers["x-forwarded-host"] = config.site.host;
    headers["x-forwarded-proto"] = "https";
    delete headers["x-forwarded-for"];
    const upstream = httpRequest(
      {
        hostname: "127.0.0.1",
        port: config.upstreamPort,
        path: request.url,
        method: request.method,
        headers,
      },
      (incoming) => {
        const outgoingHeaders = stripHopHeaders(incoming.headers);
        // Next middleware may build absolute redirects from its loopback
        // listener even when forwarded headers describe the public gateway.
        if (outgoingHeaders.location) {
          try {
            const location = new URL(outgoingHeaders.location);
            if (
              ["http:", "https:"].includes(location.protocol) &&
              ["localhost", "127.0.0.1"].includes(location.hostname) &&
              location.port === String(config.upstreamPort)
            ) {
              location.protocol = config.site.protocol;
              location.hostname = config.site.hostname;
              location.port = config.site.port;
              location.username = "";
              location.password = "";
              outgoingHeaders.location = location.href;
            }
          } catch {
            // Relative locations already resolve against the gateway origin.
          }
        }
        delete outgoingHeaders["cdn-cache-control"];
        delete outgoingHeaders["surrogate-control"];
        delete outgoingHeaders["vercel-cdn-cache-control"];
        const responseHeaders = { ...outgoingHeaders, ...privateHeaders };
        if (canCacheBuildAsset(request, incoming)) {
          // Keep shared/CDN caching disabled and bound local retention to one hour.
          // A cache miss still passes through the password gate above.
          responseHeaders["cache-control"] = "private, max-age=3600, must-revalidate";
          responseHeaders.vary = [outgoingHeaders.vary, "Authorization"].filter(Boolean).join(", ");
        }
        response.writeHead(incoming.statusCode || 502, {
          ...responseHeaders,
        });
        incoming.on("error", () => response.destroy());
        incoming.pipe(response);
      }
    );
    upstream.setTimeout(120_000, () => upstream.destroy());
    upstream.on("error", () => {
      if (!response.headersSent) end(response, 502, "Preview temporarily unavailable");
      else response.destroy();
    });
    request.on("aborted", () => upstream.destroy());
    request.on("error", () => upstream.destroy());
    response.on("close", () => {
      if (!response.writableFinished) upstream.destroy();
    });
    request.pipe(upstream);
  });
}
