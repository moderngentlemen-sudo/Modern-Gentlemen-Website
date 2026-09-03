import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = join(__dirname, "../../scripts/check-deploy.mjs");
const valid = {
  NEXT_PUBLIC_SITE_URL: "https://modern-gentlemen.test",
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_abcdefghijklmnopqrstuvwxyz",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_abcdefghijklmnopqrstuvwxyz",
  JOBS_SECRET: "abcdefghijklmnopqrstuvwxyz012345",
};

function run(overrides: Record<string, string | undefined> = {}) {
  const env = { ...process.env };
  for (const name of Object.keys(valid)) delete env[name];
  for (const [name, value] of Object.entries({ ...valid, ...overrides })) {
    if (value === undefined) delete env[name];
    else env[name] = value;
  }
  return spawnSync(process.execPath, [script], { env, encoding: "utf8" });
}

describe("deployment preflight", () => {
  it("accepts a structurally complete production environment without echoing secrets", () => {
    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("structurally ready");
    expect(result.stdout + result.stderr).not.toContain(valid.SUPABASE_SERVICE_ROLE_KEY);
  });

  it("names every missing requirement without printing other values", () => {
    const result = run({ NEXT_PUBLIC_SITE_URL: undefined, JOBS_SECRET: undefined });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("NEXT_PUBLIC_SITE_URL is missing");
    expect(result.stderr).toContain("JOBS_SECRET is missing");
    expect(result.stderr).not.toContain(valid.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  });

  it("rejects non-public origins, placeholders and reused privileged keys", () => {
    const result = run({
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000/path",
      NEXT_PUBLIC_SUPABASE_URL: "https://your-project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: valid.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("NEXT_PUBLIC_SITE_URL must use HTTPS");
    expect(result.stderr).toContain("NEXT_PUBLIC_SUPABASE_URL still contains a placeholder");
    expect(result.stderr).toContain("must differ");
  });

  it("warns that adding Stripe secrets does not enable the demo checkout", () => {
    const result = run({ STRIPE_SECRET_KEY: "sk_test_configured" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("checkout intentionally remains in demo mode");
  });
});
