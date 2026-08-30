# AGENTS.md — Modern Gentlemen

Deliberately short, and it duplicates as little as possible. Three files already
hold this project's rules; **duplicating them here is how they drift**, which is
a mistake this repository has made and recorded more than once. So this file
points at them, and inlines only the handful of things an agent gets wrong
*before* it has read anything.

## Read these first, in order

1. **`PROGRESS.md`** — build status, decisions log, live known issues. **The
   handoff document; start here.** It opens with a block telling you which of
   its open checkboxes are real work and which are phase history — read that
   before treating any `- [ ]` as a task.
2. **`CLAUDE.md`** (repo root) — the standing rules. Not Claude-specific despite
   the name: it is the architectural contract (money in integer pence, which
   Supabase client each layer uses, block manifests, layering). Breaking one of
   these is how something subtle goes wrong.
3. **`design_handoff_modern_gentlemen/CLAUDE.md`** — the authoritative design
   baseline: tokens, typography, layout, motion, commerce rules. Read it before
   touching anything visual.

The public site is pixel-verified against `design_handoff_modern_gentlemen/handoff/screenshots/`.

## The four things to know before your first command

**1. The app is not at the repository root.** It lives in
`design_handoff_modern_gentlemen/starter` — a Next.js 15 App Router project.
Every `npm` command runs from there. A setup script that runs `npm ci` at the
root finds no `package.json`. `.github/workflows/ci.yml` sets `APP_DIR` at the
top level for this reason.

**2. `npm run build` reads the database.** It prerenders the homepage from the
`pages` table, so **any** build needs a reachable, seeded Supabase project — CI
included. A build failing with *"No published page with slug home"* is a seeding
problem, not a code one; the route throws rather than falling back to demo data
on purpose, because a silent fallback would ship a plausible page from a broken
read.

Three variables are mandatory for `build`, `test:visual`, `test:a11y` and
`test:perf` (all four start a web server against a built site):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   # the sb_publishable_… key — NOT the legacy anon
                                # JWT beside it, which carries "disabled": true
NEXT_PUBLIC_SITE_URL            # any absolute origin; http://localhost:3000 is fine
```

⚠️ **Placeholders do not work.** The site layout reads the database on every
public route, so fake values fail every visual baseline. `.env.example` documents
the rest. `SUPABASE_SERVICE_ROLE_KEY` is needed only by `scripts/seed.ts` and the
signed-in E2E specs.

**3. Never commit secrets.** Real values live only in
`starter/.env.local`, which is gitignored. Use your platform's secret store.

**4. Toolchain pins are deliberate.** Node ≥22. Playwright is pinned to match
preinstalled browsers, and the Supabase CLI is pinned because `latest` resolves
through the GitHub API and once rate-limited CI on a docs-only commit. Bumping
either is a deliberate act, not a tidy-up.

## Before you commit

From `design_handoff_modern_gentlemen/starter`:

```bash
npm run format:check && npm run lint && npm run typecheck && npm test
```

None of those four need credentials. `npm run test:a11y` and `npm run test:perf`
are the fifth and sixth gates and are worth running by hand — they need a built,
seeded site but no admin account, unlike `test:e2e`, which **silently skips
itself** without `E2E_ADMIN_EMAIL` and reports green having run nothing.

`npm run build` before anything that touches routing — Next enforces rules that
surface only at build time.

⚠️ `format:check` walks `starter/` only, so it does **not** cover this file,
`PROGRESS.md`, or the design baseline. All three sit above it and have never been
Prettier-formatted; leave them that way, and do not read a green `format:check`
as covering a docs edit.

**Then update `PROGRESS.md`.** It is the handoff to whoever comes next.

## Two habits this repository learned the hard way

- **Read the source, not a description of it.** Check `pg_policies` rather than
  the previous migration's comment about it; read the column list rather than
  your memory of it; run `git fetch` before trusting any status claim. Several
  entries in the decisions log exist because someone skipped this.
- **Record what a change cost against what it was predicted to cost.** The
  decisions log is written to be read by the next person, including the
  predictions that turned out wrong. That is the most useful part of it.

## Live state

`node design_handoff_modern_gentlemen/starter/scripts/status.mjs` prints the
branch, uncommitted files, migration count and test counts. It is computed rather
than written, so prefer it to any sentence in a document — including this one.
