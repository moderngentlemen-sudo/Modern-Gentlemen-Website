/**
 * Every Supabase client must apply the modern-key header rule.
 *
 * This exists because the rule was shipped for one client, then a second, and
 * `middleware.ts` was still missed — it builds its own `createServerClient`
 * with its own cookie plumbing, so it inherits nothing from `lib/db/server.ts`.
 * It runs on every matched request and calls `auth.getUser()`, which makes it
 * the worst place to have an uncovered client.
 *
 * A per-client unit test would not have caught that: the gap was a *file nobody
 * thought of*, not a wrong assertion in a file someone did. So this asserts the
 * property across the source instead — find everything that constructs a
 * Supabase client, and require it to reference `fetchForKey`.
 *
 * ⚠️ **Same limitation `scripts/check-env.mjs` states about itself**: this is a
 * regex over source text, not a resolved reference graph. It would miss a client
 * built through an indirection. Nothing does that today; if something starts to,
 * this check silently stops covering it.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const STARTER = resolve(__dirname, "../..");

/** Where application code lives. `scripts/` is excluded deliberately — see below. */
const ROOTS = ["app", "components", "lib", "middleware.ts"];

const SKIP_DIRS = new Set(["node_modules", ".next", "test-results", "playwright-report"]);

/**
 * Matches the *import* of a client constructor rather than the call site.
 *
 * The first version of this matched calls, and missed `lib/db/admin.ts` —
 * which imports `createClient as createSupabaseClient`, so the call reads
 * `createSupabaseClient<Database>(…)` and no amount of matching `createClient(`
 * finds it. An import cannot be renamed out of recognition the same way: the
 * original name is always on the left of the `as`.
 */
const IMPORTS_CONSTRUCTOR =
  /import\s*\{[^}]*\b(createClient|createServerClient|createBrowserClient)\b[^}]*\}\s*from\s*"@supabase\/(supabase-js|ssr)"/s;

function walk(path: string, out: string[] = []): string[] {
  const stats = statSync(path);
  if (stats.isFile()) {
    if (/\.tsx?$/.test(path)) out.push(path);
    return out;
  }
  for (const entry of readdirSync(path)) {
    if (SKIP_DIRS.has(entry)) continue;
    walk(join(path, entry), out);
  }
  return out;
}

function clientConstructionSites(): string[] {
  const files: string[] = [];
  for (const root of ROOTS) walk(join(STARTER, root), files);

  return files.filter((file) => {
    // A test may construct a client with a deliberately fake key.
    if (/\.test\.tsx?$/.test(file)) return false;

    return IMPORTS_CONSTRUCTOR.test(readFileSync(file, "utf8"));
  });
}

describe("modern-key header rule coverage", () => {
  it("finds the clients it is supposed to be guarding", () => {
    // If this drops to zero the walk is broken and every assertion below would
    // pass vacuously — the same failure mode `--passWithNoTests` produces in the
    // integration suite, and this repo has been caught by that three times.
    const sites = clientConstructionSites().map((f) => relative(STARTER, f));

    expect(sites.length, `found: ${sites.join(", ")}`).toBeGreaterThanOrEqual(5);
    for (const expected of [
      "lib/db/admin.ts",
      "lib/db/public.ts",
      "lib/db/server.ts",
      "lib/db/client.ts",
      "middleware.ts",
    ]) {
      expect(sites, `${expected} should be recognised as a client site`).toContain(expected);
    }
  });

  it("requires every one of them to apply fetchForKey", () => {
    const offenders = clientConstructionSites()
      .filter((file) => !readFileSync(file, "utf8").includes("fetchForKey"))
      .map((file) => relative(STARTER, file));

    expect(
      offenders,
      "these construct a Supabase client without the modern-key header rule — " +
        "a publishable or secret key would be sent as a Bearer token and refused. " +
        "See lib/db/apiKey.ts"
    ).toEqual([]);
  });
});
