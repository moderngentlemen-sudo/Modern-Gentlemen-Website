#!/usr/bin/env node
/**
 * Asserts that every environment variable the code reads is declared in
 * `.env.example`.
 *
 * PROGRESS.md records the same failure three times, and names the fix:
 *
 *   "a variable nothing reads is a variable nobody notices is missing"
 *
 *   * JOBS_SECRET — absent from .env.example for four phases
 *   * SUPABASE_SERVICE_ROLE_KEY — absent from Railway for eight
 *   * NEXT_PUBLIC_SITE_URL — absent from both .env.example and ci.yml until the
 *     SEO phase made something read it
 *
 * and then: "Worth a deployment checklist that asserts every variable the app
 * can need, rather than the ones today's code paths happen to touch — that is
 * the change that would have caught all three at once, and it is still not
 * written." This is that, and it is deliberately a *script* rather than a
 * document: a checklist nothing executes has exactly the weakness it exists to
 * fix. It found a fourth instance on its first run (SEED_ADMIN_EMAIL and
 * SEED_ADMIN_PASSWORD, read by scripts/create-admin.ts).
 *
 * Deliberately plain .mjs with zero dependencies, like scripts/status.mjs: it
 * runs in CI's fast job, before anything is installed beyond `npm ci`, and needs
 * no secrets, no database and no network.
 *
 *   node scripts/check-env.mjs          exit 1 if anything is read but undeclared
 *   node scripts/check-env.mjs --json   machine-readable
 *
 * WHAT THIS DOES NOT COVER, stated so nobody mistakes it for completeness: it is
 * a regex over source text, not a resolved reference graph. A dynamic read —
 * `process.env[name]` — is invisible to it. Nothing in this codebase does that
 * today; if something starts to, this check silently stops covering it.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const STARTER = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Where application, script and test code lives. */
const ROOTS = ["app", "lib", "components", "scripts", "tests", "middleware.ts"];

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mjs", ".js", ".jsx"]);
const SKIP_DIRECTORIES = new Set(["node_modules", ".next", "dist", "coverage"]);

/**
 * Names that are never declared in `.env.example`, with the reason each is
 * exempt. Kept short on purpose — a long ignore list hollows the check out until
 * it passes by construction.
 */
const IGNORED = {
  NODE_ENV: "set by Next and by the test runner; never configured by hand",
  CI: "set by GitHub Actions itself",
  PORT: "supplied by the host (Railway) or defaulted by Playwright's webServer",
  E2E_BASE_URL: "opt-in override for pointing the E2E suite at a running server",
  // `lib/db/env.ts` documents the pattern as `process.env.X` in a doc comment,
  // and `env.test.ts` repeats it. Neither is a real variable.
  X: "a placeholder in the env.ts doc comment, not a variable",
};

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRECTORIES.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (SOURCE_EXTENSIONS.has(entry.slice(entry.lastIndexOf(".")))) out.push(full);
  }
  return out;
}

function sourceFiles() {
  const out = [];
  for (const root of ROOTS) {
    const full = join(STARTER, root);
    try {
      if (statSync(full).isDirectory()) out.push(...walk(full));
      else out.push(full);
    } catch {
      // A root that does not exist is not an error — the layout has changed
      // before (lib/queries.ts, lib/supabase/) and will again.
    }
  }
  return out;
}

/**
 * Strip comments before scanning.
 *
 * Without this the doc comment in `lib/db/env.ts` — which explains the pattern
 * by writing `process.env.X` in prose — reads as a variable named X. Crude but
 * sufficient: this only ever removes text, so the worst case is a missed read,
 * and a missed read in a comment is exactly what we want missed.
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function readsByVariable(files) {
  const reads = new Map();

  for (const file of files) {
    const source = stripComments(readFileSync(file, "utf8"));
    for (const match of source.matchAll(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
      const name = match[1];
      if (!reads.has(name)) reads.set(name, new Set());
      reads.get(name).add(relative(STARTER, file));
    }
  }

  return reads;
}

/**
 * Declared names from `.env.example`, **including commented-out ones**.
 *
 * A commented declaration still documents the variable, and at least one is
 * commented deliberately (`ESP_API_KEY`, for an integration that is optional).
 * Requiring it to be uncommented would defeat that choice.
 */
function declaredVariables() {
  const text = readFileSync(join(STARTER, ".env.example"), "utf8");
  const declared = new Set();

  for (const line of text.split("\n")) {
    const match = /^\s*#?\s*([A-Z][A-Z0-9_]*)\s*=/.exec(line);
    if (match) declared.add(match[1]);
  }

  return declared;
}

const reads = readsByVariable(sourceFiles());
const declared = declaredVariables();

const undeclared = [];
for (const [name, files] of [...reads].sort(([a], [b]) => a.localeCompare(b))) {
  if (name in IGNORED || declared.has(name)) continue;
  undeclared.push({ name, files: [...files].sort() });
}

const unread = [...declared].filter((name) => !reads.has(name)).sort((a, b) => a.localeCompare(b));

if (process.argv.includes("--json")) {
  process.stdout.write(JSON.stringify({ undeclared, unread }, null, 2) + "\n");
} else if (undeclared.length === 0) {
  process.stdout.write(`✓ every variable the code reads is declared in .env.example\n`);
  if (unread.length > 0) {
    // Not a failure. Stripe is declared ahead of a payments phase that is out of
    // scope by decision, and deleting a forward-looking declaration to satisfy a
    // linter would be the wrong trade.
    process.stdout.write(`  declared and not read yet (fine): ${unread.join(", ")}\n`);
  }
} else {
  process.stderr.write(
    `\n${undeclared.length} environment variable(s) are read by the code and NOT declared in .env.example:\n\n`
  );
  for (const { name, files } of undeclared) {
    process.stderr.write(`  ${name}\n`);
    for (const file of files) process.stderr.write(`      read by ${file}\n`);
  }
  process.stderr.write(
    `\nAdd each to design_handoff_modern_gentlemen/starter/.env.example with a line\n` +
      `saying what reads it and how it fails when unset. A variable nothing declares\n` +
      `is a variable nobody notices is missing — this repo has paid for that lesson\n` +
      `three times (JOBS_SECRET, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL).\n`
  );
  process.exit(1);
}
