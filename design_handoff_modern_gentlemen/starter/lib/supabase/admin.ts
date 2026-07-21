import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — SERVER ONLY. Bypasses RLS. Use exclusively in
 * trusted server code: the Stripe webhook (writing orders, flipping is_member),
 * admin mutations, and seed/maintenance scripts. NEVER import this into a
 * Client Component or expose the key to the browser.
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient() must never run in the browser.");
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
