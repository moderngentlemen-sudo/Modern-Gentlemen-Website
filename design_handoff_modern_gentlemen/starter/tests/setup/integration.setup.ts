import { config } from "dotenv";
import { beforeAll } from "vitest";

/**
 * Integration tests talk to a real Postgres.
 *
 * Preferred: a local Supabase stack (`npx supabase start`), pointed at by
 * SUPABASE_TEST_URL / SUPABASE_TEST_SERVICE_ROLE_KEY. CI does exactly this.
 *
 * Fallback: the remote project via .env.local. That is convenient but shared,
 * so every fixture this suite creates is namespaced with a per-run prefix
 * (see tests/support/fixtures.ts) and removed in teardown. Nothing in this
 * suite ever issues an unscoped DELETE.
 */
config({ path: ".env.local" });
config({ path: ".env.test.local", override: true });

const url = process.env.SUPABASE_TEST_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

beforeAll(() => {
  const missing = [
    ["SUPABASE_TEST_URL / NEXT_PUBLIC_SUPABASE_URL", url],
    ["SUPABASE_TEST_SERVICE_ROLE_KEY / SUPABASE_SERVICE_ROLE_KEY", serviceKey],
    ["SUPABASE_TEST_ANON_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY", anonKey],
  ]
    .filter(([, v]) => !v)
    .map(([name]) => name);

  if (missing.length) {
    throw new Error(
      `Integration tests need a database. Missing: ${missing.join(", ")}.\n` +
        `Run \`npx supabase start\` and export SUPABASE_TEST_URL/…_ANON_KEY/…_SERVICE_ROLE_KEY, ` +
        `or provide .env.local for the remote project.`
    );
  }
});

export const testEnv = {
  get url() {
    return url!;
  },
  get serviceKey() {
    return serviceKey!;
  },
  get anonKey() {
    return anonKey!;
  },
  /** True when pointed at a throwaway local stack — enables destructive resets. */
  get isLocal() {
    return Boolean(url && /localhost|127\.0\.0\.1/.test(url));
  },
};
