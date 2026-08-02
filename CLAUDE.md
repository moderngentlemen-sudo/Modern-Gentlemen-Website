# CLAUDE.md — Modern Gentlemen (repo root)

Deliberately short. The details live in the two files below; this exists so a
session that auto-loads only the repo root still knows the rules it cannot
afford to break.

## Read these first, in order

1. **`PROGRESS.md`** — build status, what is done, what is next, the decisions
   log, and known gotchas. **This is the handoff document. Start here.**
2. **`design_handoff_modern_gentlemen/CLAUDE.md`** — the authoritative design
   baseline: tokens, typography, layout, motion, commerce rules. Read it every
   session before touching anything visual. Its "Framework decision" section is
   superseded (the data layer is Supabase, not Sanity/Shopify); everything about
   design in it is still binding.

A `SessionStart` hook prints live repo state automatically. Run it any time with
`node design_handoff_modern_gentlemen/starter/scripts/status.mjs`.

## Where things are

**The app is not at the repo root.** It lives in
`design_handoff_modern_gentlemen/starter/` — a Next.js 15 App Router project.
All npm commands run from there. Railway's Root Directory must stay set to it,
and the Supabase GitHub integration's **Supabase directory** must be set to
`design_handoff_modern_gentlemen/starter/supabase` — pointed at the repo root it
finds no migrations and reports that as success.

```
design_handoff_modern_gentlemen/starter/
├─ app/           routes: public site, /admin, /sign-in, /auth
├─ components/    sections/ (22 blocks + registry), article/, chrome/, store/, ui/
├─ lib/
│  ├─ blocks/     PURE: one defineBlock() manifest per section + validation
│  ├─ domain/     PURE: types, Zod schemas, business rules. No I/O, no React.
│  ├─ db/         Supabase clients + generated database.types.ts
│  ├─ services/   orchestration + permission checks
│  └─ cart/, catalog.ts, editorial.ts, articles.ts  (demo data, being migrated)
├─ supabase/             config.toml + migrations/ 0001–0013 (0013 not yet applied)
├─ scripts/       seed.ts, create-admin.ts, status.mjs
└─ tests/         e2e/, setup/
```

## Standing rules

These are expensive to rediscover. Break them and something subtle goes wrong.

- **Money is integer pence.** `lib/domain/money.ts` is the only place that
  converts. Never do arithmetic on pounds-as-float — a 15% member discount on
  £145 is £21.75, and only exact integer maths reproduces that.
- **Admin writes use the editor's own session against RLS**
  (`lib/db/server.ts`), never the service-role client. `lib/db/admin.ts` is for
  scripts, scheduled jobs and test fixtures only. An ESLint rule enforces this.
- **Do not restyle or reformat the design components.** The public site is
  pixel-verified against `design_handoff_modern_gentlemen/handoff/screenshots/`.
  Section components take *additive* prop changes only. No Tailwind class
  reordering, no "tidying".
- **A section block is not done until it has a manifest.** Build the component,
  register it in `components/sections/registry.ts`, then write
  `lib/blocks/manifests/<type>.ts`. `lib/blocks/conformance.test.ts` fails the
  build if either half is missing. Manifests *describe* components — where the
  two disagree, the component wins and the manifest is the bug.
- **Layering flows downward only**: `app → services → db`, with `domain`,
  `blocks`, `render` and `integrations` as leaves. `lib/domain` must stay pure.
  ESLint `no-restricted-imports` enforces the boundaries — if it complains, the
  design is wrong, not the rule.
- **Never commit secrets.** Real values live only in
  `starter/.env.local` (gitignored). `.env.example` carries placeholder names.

## Before you commit

Run all four from `design_handoff_modern_gentlemen/starter/`:

```bash
npm run format:check && npm run lint && npm run typecheck && npm test
```

`npm run build` before anything that touches routing — Next enforces rules
(such as which symbols a route file may export) that only surface at build time.

Then **update `PROGRESS.md`**. A hook will remind you if you forget.
