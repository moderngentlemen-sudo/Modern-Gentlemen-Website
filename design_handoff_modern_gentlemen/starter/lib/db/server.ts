import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Server client — Server Components, Route Handlers and Server Actions.
 *
 * This is the client the admin uses for its writes. It carries the editor's own
 * session, so every mutation is evaluated against RLS as that person. Admin
 * writes deliberately do NOT use the service-role key: a bug in a service
 * cannot then escalate into unrestricted database access, and the policies in
 * supabase/migrations are exercised on every real request rather than only in
 * tests.
 *
 * Next 15: cookies() is async, hence the awaited factory.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot set cookies. Safe to ignore: middleware
          // refreshes the session on the way through. See @supabase/ssr docs.
        }
      },
    },
  });
}
