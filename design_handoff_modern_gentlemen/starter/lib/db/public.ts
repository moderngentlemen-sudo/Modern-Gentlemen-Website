import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Public read client — anonymous, session-free, safe to use during static
 * rendering.
 *
 * This exists because of one property `server.ts` cannot have: it reads no
 * cookies. `createClient()` there calls `cookies()`, and any route that awaits
 * `cookies()` is **opted out of static rendering by Next** — every request
 * renders on the server. That is correct for the admin, where the answer
 * genuinely depends on who is asking. It is wrong for the public site, where
 * every visitor sees the same published page and the site has been 65 static
 * files since Track A.
 *
 * So the public site reads through this instead, stays statically rendered, and
 * is refreshed by `revalidatePath` when an editor publishes. Fast pages and
 * no deploy step, which is the whole reason the publishing machinery writes a
 * `published_data` payload separate from the draft.
 *
 * **RLS still applies**, as `anon`. The policies from `0003`–`0005` are what
 * make this safe: `using (status = 'published' or is_staff())` on pages,
 * articles and products, and an anonymous caller is not staff. A draft cannot
 * come back through this client — the guarantee is in the database, not in the
 * queries written on top of it.
 *
 * Not `@supabase/ssr`: that package exists to move a session between cookies
 * and the client, and there is deliberately no session here. The plain
 * `supabase-js` client is the honest expression of "no user".
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    auth: {
      // Nothing here should ever look at, refresh or persist a session. On the
      // server there is no storage to persist to, and leaving these on makes a
      // shared module-level client behave differently depending on who called
      // it last.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
