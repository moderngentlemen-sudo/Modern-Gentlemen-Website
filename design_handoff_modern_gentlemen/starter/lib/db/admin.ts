import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { supabaseServiceRoleKey, supabaseUrl } from "./env";

/**
 * Service-role client — BYPASSES ROW LEVEL SECURITY.
 *
 * Legitimate callers are narrow and deliberate:
 *   - scheduled ingestion jobs (no user session exists)
 *   - seed and maintenance scripts
 *   - integration-test fixture setup and teardown
 *
 * Everything an editor does goes through lib/db/server.ts instead, under their
 * own session and RLS.
 *
 * Two guards back that up: the runtime browser check below, and the ESLint
 * boundary rule restricting imports to services, API routes, scripts and tests.
 * The `server-only` package would be a stronger, build-time guard, but it
 * throws when imported outside Next — which would break the seed script and
 * integration-test fixtures, both of which legitimately need service-role
 * access with no Next runtime present.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "createAdminClient() must never run in the browser — it bypasses Row Level Security."
    );
  }

  return createSupabaseClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
