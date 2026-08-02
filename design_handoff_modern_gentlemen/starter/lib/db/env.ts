/**
 * Environment access for the data layer.
 *
 * Reads are validated at the point of use and throw a named error rather than
 * letting `undefined!` reach the Supabase client, where it surfaces later as an
 * opaque network failure. `process.env.X` is referenced literally so Next's
 * build-time inlining of NEXT_PUBLIC_* still works — destructuring breaks it.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. ` +
        `Copy .env.example to .env.local (see 06_SUPABASE.md), or set it in Railway → Variables.`
    );
  }
  return value;
}

export const supabaseUrl = () =>
  required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

export const supabaseAnonKey = () =>
  required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** Server-only. Bypasses RLS — never reference this from client code. */
export const supabaseServiceRoleKey = () =>
  required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);

export const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
