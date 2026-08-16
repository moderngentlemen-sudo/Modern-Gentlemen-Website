/**
 * The header rule for Supabase's modern API keys — one definition, four clients.
 *
 * `sb_publishable_…` and `sb_secret_…` are **not JWTs**. The platform rejects
 * them on `Authorization: Bearer`, where it tries to parse them as a token and
 * answers `Invalid JWT`; they belong on the `apikey` header alone. The legacy
 * `anon` and `service_role` keys *are* JWTs and must keep their Bearer, so the
 * rule is keyed on the key's format rather than applied unconditionally.
 *
 * ⚠️ **`supabase-js` will not do this for us on the REST path.** Version 2.111.0
 * defines the guard (`omitApiKeyAsBearer`) and passes it *only* to the Edge
 * Functions fetch; `this.fetch`, which every `.from()` query goes through, keeps
 * the Bearer fallback whatever the key format. This was found the expensive
 * way — a `sb_secret_…` key in Railway turned every scheduled-publish run into
 * an HTTP 500.
 *
 * It lives here rather than in `admin.ts` because the same trap is waiting for
 * the anon → publishable swap, and that one would take out the *public site*
 * rather than one cron route: `public.ts`, `server.ts` and `client.ts` all send
 * requests with no session token whenever the visitor is signed out, which is
 * precisely when the SDK falls back to the key as a Bearer.
 *
 * `@supabase/ssr` spreads `...options.global` into `createClient`, so
 * `createServerClient` and `createBrowserClient` accept this the same way the
 * plain client does.
 */

export function isNewFormatKey(key: string): boolean {
  return key.startsWith("sb_secret_") || key.startsWith("sb_publishable_");
}

/**
 * Wraps `base` so the SDK's Bearer fallback is removed for a modern key.
 *
 * `supabase-js` builds the headers *before* handing them to `global.fetch`: it
 * sets `apikey`, then sets `Authorization: Bearer <session token ?? the key>`.
 * Only the verbatim key is stripped here — a genuine user token survives
 * untouched, because removing one would silently downgrade that request from
 * the user's own identity to the key's.
 */
function fetchWithoutKeyAsBearer(key: string, base: typeof fetch): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    return base(input, { ...init, headers });
  };
}

/**
 * The `global.fetch` a client should use for this key, or `undefined` to leave
 * the SDK alone.
 *
 * Returning `undefined` for a legacy JWT is what lets this ship *ahead* of any
 * key swap: against today's keys it changes nothing at all.
 */
export function fetchForKey(key: string, base: typeof fetch = fetch): typeof fetch | undefined {
  return isNewFormatKey(key) ? fetchWithoutKeyAsBearer(key, base) : undefined;
}
