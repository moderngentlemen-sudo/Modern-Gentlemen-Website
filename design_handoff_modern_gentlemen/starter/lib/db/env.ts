/**
 * Environment access for the data layer.
 *
 * Reads are validated at the point of use and throw a named error rather than
 * letting `undefined!` reach the Supabase client, where it surfaces later as an
 * opaque network failure. `process.env.X` is referenced literally so Next's
 * build-time inlining of NEXT_PUBLIC_* still works — destructuring breaks it.
 *
 * The validation goes past "is it set?" for one reason, learned from a Railway
 * deploy. A key pasted from a **masked** field — the kind a dashboard renders as
 * `eyJhbGci••••••••` — is present, non-empty, and completely unusable: supabase-js
 * puts it in the `apikey` and `Authorization` headers, and `fetch` refuses any
 * header value holding a character above U+00FF. What reaches the log is
 *
 *   TypeError: Cannot convert argument to a ByteString because the character at
 *   index 8 has a value of 8226 which is greater than 255
 *
 * thrown from inside undici and attributed to whichever page happened to render.
 * It names no variable, no value and no fix. A credential that cannot be sent is
 * as broken as one that is missing, so it fails here instead, where the variable
 * has a name.
 */

/** Printable ASCII. Every credential and URL this app takes is within it. */
const PRINTABLE_ASCII = /^[\x20-\x7E]*$/;

function describeCharacter(code: number): string {
  // The three that actually turn up. `•` and `…` come from masked dashboard
  // fields; `*` is someone redacting by hand before pasting into a chat.
  if (code === 0x2022) return "• (a bullet)";
  if (code === 0x2026) return "… (an ellipsis)";
  return `U+${code.toString(16).toUpperCase().padStart(4, "0")}`;
}

/**
 * Exported for `env.test.ts`. The value is never included in a thrown message:
 * this same helper guards `SUPABASE_SERVICE_ROLE_KEY`, and an error string ends
 * up in build logs, in CI output and in bug reports.
 */
export function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. ` +
        `Copy .env.example to .env.local (see 06_SUPABASE.md), or set it in Railway → Variables.`
    );
  }

  // A trailing newline from `echo`, or spaces from a double-click selection.
  // Unambiguous and harmless, so corrected rather than rejected.
  const trimmed = value.trim();

  if (trimmed === "") {
    throw new Error(
      `Environment variable ${name} is only whitespace. ` +
        `Set it to a real value in .env.local, or in Railway → Variables.`
    );
  }

  if (!PRINTABLE_ASCII.test(trimmed)) {
    const index = [...trimmed].findIndex((char) => !PRINTABLE_ASCII.test(char));
    const code = trimmed.codePointAt(index) ?? 0;

    throw new Error(
      `Environment variable ${name} contains ${describeCharacter(code)} at index ${index}, ` +
        `which cannot be sent in an HTTP header. ` +
        `This almost always means the value was copied from a field that masks it — ` +
        `the visible characters come through and the dots come with them. ` +
        `Re-copy it from the source and paste the whole value.`
    );
  }

  // Inner whitespace is not a paste artefact that can be safely repaired: it
  // means two values were concatenated, or part of one was lost.
  if (/\s/.test(trimmed)) {
    throw new Error(
      `Environment variable ${name} contains a space or line break inside it. ` +
        `That usually means two values were pasted together, or the value was truncated.`
    );
  }

  return trimmed;
}

export const supabaseUrl = () =>
  required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

export const supabaseAnonKey = () =>
  required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** Server-only. Bypasses RLS — never reference this from client code. */
export const supabaseServiceRoleKey = () =>
  required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);

export const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * The site's own address, for anything a *third party* will read back.
 *
 * `siteUrl()` above falls back to localhost, which is right for preview links an
 * editor clicks in their own browser and wrong for anything that outlives the
 * request. Canonical tags, `sitemap.xml`, `robots.txt` and JSON-LD all state
 * "this page's real address is X" to a crawler — and a production build that
 * quietly filled those in with `http://localhost:3000` would tell Google that
 * every page on the site lives on a machine it cannot reach. That does not fail
 * loudly, it fails as a slow deindexing nobody connects to a deploy.
 *
 * So in production this refuses the fallback. The build fails, which is the
 * behaviour this repo already chose for a homepage whose content will not load:
 * a loud failure beats a plausible artefact built from a missing value.
 */
export function canonicalSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return required("NEXT_PUBLIC_SITE_URL", configured);

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL is not set. Canonical URLs, the sitemap and robots.txt " +
        "would advertise http://localhost:3000 to crawlers. Set it in Railway → Variables."
    );
  }

  return "http://localhost:3000";
}
