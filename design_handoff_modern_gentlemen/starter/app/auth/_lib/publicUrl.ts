import type { NextRequest } from "next/server";

import { canonicalSiteUrl } from "@/lib/db/env";

/**
 * Build a redirect URL on the host the **browser** is actually on.
 *
 * ⚠️ `request.nextUrl` is not that host behind a proxy, and this cost a live
 * bug. Both auth routes used to redirect via `request.nextUrl.clone()` with a
 * comment explaining that `new URL(..., request.url)` "can carry the internal
 * origin behind a proxy" — a correct diagnosis with the wrong remedy, because on
 * Railway **both** of them are the internal origin. The deployed
 * `/auth/callback` was emitting `Location: https://localhost:8080/...`, which is
 * unreachable from a browser, so password recovery ended on the same
 * "localhost refused to connect" it was built to fix.
 *
 * Middleware does not have the problem — its `nextUrl` reflects the original
 * request — which is why the sign-in gate always redirected correctly and made
 * the route-handler case look impossible.
 *
 * `x-forwarded-host` is what the proxy says the browser used, so that is the
 * answer. It is also attacker-supplied in principle: anything that reaches the
 * app with a forged header would otherwise turn these routes into open
 * redirects. So it is honoured **only when it matches the host we already know
 * is ours** (`NEXT_PUBLIC_SITE_URL`), and ignored otherwise. That keeps the
 * original intent — the user stays on the host they arrived on, because auth
 * cookies are host-scoped — while making it true in the deployment that broke it.
 *
 * With no forwarded header (local dev, the E2E suite) it falls back to
 * `nextUrl`, which is correct there and preserves the localhost-vs-127.0.0.1
 * behaviour the original comment was protecting.
 */
export function publicUrl(request: NextRequest, pathname: string, search = ""): URL {
  const fallback = request.nextUrl.clone();
  fallback.pathname = pathname;
  fallback.search = search;

  // A proxy chain appends; the first entry is the client-facing host.
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (!forwarded) return fallback;

  let canonical: URL;
  try {
    canonical = new URL(canonicalSiteUrl());
  } catch {
    // No configured origin to check against — refuse to trust the header.
    return fallback;
  }

  if (forwarded.toLowerCase() !== canonical.host.toLowerCase()) return fallback;

  // Built from the canonical origin rather than by mutating `fallback`: the
  // URL `host` setter leaves an existing port in place when the new host omits
  // one, which would keep :8080 on the public hostname.
  return new URL(`${pathname}${search}`, canonical.origin);
}
