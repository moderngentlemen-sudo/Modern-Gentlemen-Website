#!/usr/bin/env node
/**
 * Fail a production deployment before `next build` when its runtime contract is
 * incomplete. Values are never printed: deployment logs may be widely visible.
 */

const REQUIRED = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "JOBS_SECRET",
];

const PLACEHOLDER = /(?:your[-_ ]|example|\.\.\.|<.+>|•|…)/i;

function configured(name) {
  const value = process.env[name]?.trim() ?? "";
  if (!value) return { name, problem: "is missing" };
  if (PLACEHOLDER.test(value)) return { name, problem: "still contains a placeholder" };
  if (!/^[\x20-\x7e]+$/.test(value) || /\s/.test(value)) {
    return { name, problem: "contains whitespace or non-ASCII masked characters" };
  }
  return { name, value };
}

function publicOrigin(name, value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return `${name} must use HTTPS`;
    if (url.username || url.password) return `${name} must not contain embedded credentials`;
    if (url.pathname !== "/" || url.search || url.hash) return `${name} must be an origin only`;
    return null;
  } catch {
    return `${name} must be a valid absolute URL`;
  }
}

const results = new Map(REQUIRED.map((name) => [name, configured(name)]));
const errors = [...results.values()].flatMap((result) =>
  "problem" in result ? [`${result.name} ${result.problem}`] : []
);

for (const name of ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_SUPABASE_URL"]) {
  const result = results.get(name);
  if (result && "value" in result) {
    const problem = publicOrigin(name, result.value);
    if (problem) errors.push(problem);
  }
}

for (const name of ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "JOBS_SECRET"]) {
  const result = results.get(name);
  if (result && "value" in result && result.value.length < 24) {
    errors.push(`${name} is implausibly short`);
  }
}

const anon = results.get("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const service = results.get("SUPABASE_SERVICE_ROLE_KEY");
if (anon && service && "value" in anon && "value" in service && anon.value === service.value) {
  errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must differ");
}

if (errors.length > 0) {
  process.stderr.write("Deployment preflight failed:\n");
  for (const error of errors) process.stderr.write(`- ${error}\n`);
  process.exit(1);
}

process.stdout.write("✓ deployment environment is structurally ready\n");

if (
  ["STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"].some(
    (name) => process.env[name]
  )
) {
  process.stdout.write(
    "! Stripe variables are present, but checkout intentionally remains in demo mode until the payment flow and webhook are implemented.\n"
  );
}
