"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client — for use in Client Components (auth UI, cart sync,
 * the section-builder admin canvas). Reads the public anon key; RLS enforces
 * what this client is allowed to do. Never use the service-role key here.
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
