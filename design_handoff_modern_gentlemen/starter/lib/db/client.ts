"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";
import { fetchForKey } from "./apiKey";

/**
 * Browser client — Client Components only (auth UI, the builder canvas, cart
 * sync). Carries the publishable key, so RLS is what actually constrains it.
 * The service-role key must never reach this file; the ESLint boundary rule in
 * .eslintrc.json enforces that.
 */
export function createClient() {
  const key = supabaseAnonKey();

  // See ./apiKey: a publishable key must not travel as a Bearer token, and a
  // signed-out visitor is exactly when the SDK would send it as one.
  return createBrowserClient<Database>(supabaseUrl(), key, {
    global: { fetch: fetchForKey(key) },
  });
}
