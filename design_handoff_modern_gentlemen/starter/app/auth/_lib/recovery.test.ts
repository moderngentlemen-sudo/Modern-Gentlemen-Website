import { afterEach, describe, expect, it, vi } from "vitest";

import { markRecoverySession, RECOVERY_COOKIE } from "./recovery";

/**
 * The one property of this cookie that fails silently.
 *
 * ⚠️ A `secure` cookie sent over http is **discarded by the browser with no
 * error anywhere**, and the symptom is not "a cookie is missing" — it is
 * `/admin/password` asking a recovering user for the password they came there
 * because they do not have. Nothing else in the suite would catch that: the flag
 * is set on a response no assertion reads, and the failure only appears in a
 * browser that was served over http.
 */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (siteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = siteUrl;
});

function capture() {
  const set = vi.fn();
  markRecoverySession({ cookies: { set } } as unknown as Parameters<typeof markRecoverySession>[0]);
  return set.mock.calls[0];
}

describe("markRecoverySession", () => {
  it("is not secure when the site is served over http", () => {
    // ⚠️ The case `process.env.NODE_ENV === "production"` gets wrong: `next
    // start` sets production on a laptop exactly as it does on Railway, so that
    // condition would set `secure` on a plain-http origin and the browser would
    // drop the cookie. The scheme is what `secure` means.
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";

    const [name, value, options] = capture();
    expect(name).toBe(RECOVERY_COOKIE);
    expect(value).toBe("1");
    expect(options.secure).toBe(false);
  });

  it("is secure when the site is served over https", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://modern-gentlemen.example";
    expect(capture()[2].secure).toBe(true);
  });

  it("falls back to secure when the origin cannot be read", () => {
    // The safe direction: a cookie that is dropped is recoverable by asking for
    // the password, a cookie sent in the clear is not recoverable at all.
    process.env.NEXT_PUBLIC_SITE_URL = "not a url";
    expect(capture()[2].secure).toBe(true);
  });

  it("is httpOnly, lax and short-lived", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://modern-gentlemen.example";
    const options = capture()[2];

    // httpOnly keeps it away from page script; lax keeps a cross-site request
    // from riding it; the TTL keeps the exemption from outliving the visit on a
    // shared machine. It is also cleared on the first successful change, so this
    // is the backstop rather than the mechanism.
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
    expect(options.maxAge).toBe(15 * 60);
  });
});
