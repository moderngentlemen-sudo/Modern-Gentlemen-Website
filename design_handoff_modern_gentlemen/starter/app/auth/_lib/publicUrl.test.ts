import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { publicUrl } from "./publicUrl";

/**
 * These reproduce the live bug rather than restating the implementation.
 *
 * `INTERNAL` is what Railway hands a route handler: the container's own address,
 * which is what `request.nextUrl` reports and what the deployed `/auth/callback`
 * was putting in its `Location` header.
 */
const INTERNAL = "https://localhost:8080";
const PUBLIC_HOST = "modern-gentlemen-website-production.up.railway.app";

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
});

function request(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`${INTERNAL}${path}`, { headers });
}

describe("publicUrl", () => {
  it("uses the forwarded host instead of the internal origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = `https://${PUBLIC_HOST}`;

    const url = publicUrl(request("/auth/callback", { "x-forwarded-host": PUBLIC_HOST }), "/admin");

    expect(url.toString()).toBe(`https://${PUBLIC_HOST}/admin`);
  });

  it("drops the internal port rather than carrying it onto the public host", () => {
    process.env.NEXT_PUBLIC_SITE_URL = `https://${PUBLIC_HOST}`;

    const url = publicUrl(request("/auth/callback", { "x-forwarded-host": PUBLIC_HOST }), "/admin");

    // The regression this guards: the URL `host` setter keeps an existing port
    // when the new host omits one, which would produce …railway.app:8080.
    expect(url.port).toBe("");
    expect(url.host).toBe(PUBLIC_HOST);
  });

  it("keeps the query string", () => {
    process.env.NEXT_PUBLIC_SITE_URL = `https://${PUBLIC_HOST}`;

    const url = publicUrl(
      request("/auth/callback", { "x-forwarded-host": PUBLIC_HOST }),
      "/sign-in",
      "?error=invalid_code"
    );

    expect(url.toString()).toBe(`https://${PUBLIC_HOST}/sign-in?error=invalid_code`);
  });

  it("takes the first entry of a proxy chain", () => {
    process.env.NEXT_PUBLIC_SITE_URL = `https://${PUBLIC_HOST}`;

    const url = publicUrl(
      request("/auth/callback", { "x-forwarded-host": `${PUBLIC_HOST}, inner.internal` }),
      "/admin"
    );

    expect(url.host).toBe(PUBLIC_HOST);
  });

  it("ignores a forwarded host that is not ours, so this is not an open redirect", () => {
    process.env.NEXT_PUBLIC_SITE_URL = `https://${PUBLIC_HOST}`;

    const url = publicUrl(
      request("/auth/callback", { "x-forwarded-host": "evil.example" }),
      "/admin"
    );

    expect(url.host).not.toBe("evil.example");
    expect(url.toString()).toBe(`${INTERNAL}/admin`);
  });

  it("falls back to the request's own origin when nothing is forwarded", () => {
    process.env.NEXT_PUBLIC_SITE_URL = `https://${PUBLIC_HOST}`;

    // Local dev and the E2E suite: no proxy, and `nextUrl` is already right.
    expect(publicUrl(request("/auth/callback"), "/admin").toString()).toBe(`${INTERNAL}/admin`);
  });
});
