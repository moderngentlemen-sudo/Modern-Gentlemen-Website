import { describe, expect, it } from "vitest";

import { required } from "./env";

/**
 * The real anon key's prefix. Index 8 is `O` — which is the whole point of the
 * masked-paste case below: a value whose index 8 is a bullet is eight real
 * characters followed by mask dots.
 */
const REAL_PREFIX = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";

describe("required", () => {
  it("returns a well-formed value unchanged", () => {
    expect(required("NEXT_PUBLIC_SUPABASE_ANON_KEY", REAL_PREFIX)).toBe(REAL_PREFIX);
  });

  it("names the variable when it is missing", () => {
    expect(() => required("NEXT_PUBLIC_SUPABASE_URL", undefined)).toThrow(
      /Missing environment variable NEXT_PUBLIC_SUPABASE_URL/
    );
    expect(() => required("NEXT_PUBLIC_SUPABASE_URL", "")).toThrow(/Missing environment variable/);
  });

  it("rejects a value copied from a masked field, naming the variable and the index", () => {
    // Exactly what reached Railway: eight visible characters, then mask dots.
    // Unguarded, this reaches `fetch` and throws "Cannot convert argument to a
    // ByteString … at index 8 … value of 8226", from inside undici, attributed
    // to whichever page was rendering. Verified: `new Headers({apikey: masked})`
    // produces that exact message.
    const masked = "eyJhbGci" + "•".repeat(10);

    expect(() => required("NEXT_PUBLIC_SUPABASE_ANON_KEY", masked)).toThrow(
      /NEXT_PUBLIC_SUPABASE_ANON_KEY contains • \(a bullet\) at index 8/
    );
    expect(() => required("NEXT_PUBLIC_SUPABASE_ANON_KEY", masked)).toThrow(/masks it/);
  });

  it("reports an ellipsis and an unnamed code point too", () => {
    expect(() => required("KEY", "abc…def")).toThrow(/… \(an ellipsis\) at index 3/);
    expect(() => required("KEY", "abcédef")).toThrow(/U\+00E9 at index 3/);
  });

  it("never puts the value itself in the message", () => {
    // This helper also guards SUPABASE_SERVICE_ROLE_KEY, and thrown messages end
    // up in build logs, CI output and bug reports.
    const secret = "sb_secret_" + "•".repeat(4) + "REDACTME";
    try {
      required("SUPABASE_SERVICE_ROLE_KEY", secret);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as Error).message).not.toContain("REDACTME");
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it("trims surrounding whitespace rather than rejecting it", () => {
    // A trailing newline from `echo` or a double-click selection is unambiguous.
    expect(required("KEY", `  ${REAL_PREFIX}\n`)).toBe(REAL_PREFIX);
  });

  it("rejects whitespace inside the value", () => {
    // Not repairable: it means two values were pasted together, or one was cut.
    expect(() => required("KEY", "eyJhbGci eyJpc3Mi")).toThrow(/space or line break inside it/);
  });

  it("rejects a value that is only whitespace", () => {
    expect(() => required("KEY", "   ")).toThrow(/only whitespace/);
  });
});

describe("the guard fires before fetch does", () => {
  /**
   * The property that matters is one-directional: **anything `required`
   * accepts must be a legal header value.** That is what stops the opaque
   * ByteString throw reaching a page render.
   *
   * The converse is deliberately false. `Headers` rejects only above U+00FF,
   * so it accepts `é` (U+00E9) quite happily — while a `é` in a JWT is still a
   * corrupt credential that will fail as a 401 somewhere further away. The
   * guard is printable-ASCII and therefore stricter on purpose. Asserting
   * symmetry here was wrong, and the test caught it.
   */
  it("accepts nothing that Headers would reject", () => {
    expect(() => new Headers({ apikey: required("KEY", REAL_PREFIX) })).not.toThrow();
    expect(() => new Headers({ apikey: required("KEY", `  ${REAL_PREFIX}\n`) })).not.toThrow();
  });

  it("rejects what Headers rejects, and some of what it wrongly allows", () => {
    for (const value of ["eyJhbGci" + "•".repeat(4), "abc…def"]) {
      expect(() => required("KEY", value), value).toThrow();
      expect(() => new Headers({ apikey: value }), value).toThrow();
    }

    // Stricter than Headers, and right to be.
    expect(() => required("KEY", "keyé")).toThrow();
    expect(() => new Headers({ apikey: "keyé" })).not.toThrow();
  });
});
