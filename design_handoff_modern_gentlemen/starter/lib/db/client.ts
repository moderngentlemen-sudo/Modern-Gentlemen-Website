"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Browser client — Client Components only (auth UI, the builder canvas, cart
 * sync). Carries the publishable key, so RLS is what actually constrains it.
 * The service-role key must never reach this file; the ESLint boundary rule in
 * .eslintrc.json enforces that.
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
}
