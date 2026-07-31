import "server-only";

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
 * own session and RLS. Two guards back that up: `server-only` makes importing
 * this from a Client Component a build error, and the ESLint boundary rule
 * restricts imports to services, API routes, scripts and tests.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
