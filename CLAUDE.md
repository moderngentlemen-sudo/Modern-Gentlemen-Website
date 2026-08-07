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
├─ app/           (site)/ public routes · (admin)/ pages, articles, taxonomy, products, media
├─ components/    sections/ (22 blocks + registry), article/, chrome/, store/, ui/,
│                 admin/ (ui/, builder/, fields/, media/, history/)
├─ lib/
│  ├─ blocks/     PURE: one defineBlock() manifest per section + validation
│  ├─ domain/     PURE: types, Zod schemas, business rules. No I/O, no React.
│  ├─ db/         client.ts · server.ts · admin.ts · public.ts + repositories,
│  │              and the generated database.types.ts
│  ├─ services/   orchestration + permission checks
│  ├─ catalog/    CatalogProvider — the published catalogue, in React context
│  ├─ demo/       home-sections.ts, catalog.ts, editorial.ts, articles.ts,
│  │              category-sections.ts  (SEED + TEST FIXTURES, not what the
│  │              site renders — see the standing rule below)
│  └─ cart/
├─ supabase/      config.toml + migrations/ 0001–0015 (0015 NOT yet applied)
├─ scripts/       seed.ts, create-admin.ts, status.mjs
└─ tests/         e2e/, integration/, visual/, support/, setup/
```

## Standing rules

These are expensive to rediscover. Break them and something subtle goes wrong.

- **Money is integer pence.** `lib/domain/money.ts` is the only place that
  converts. Never do arithmetic on pounds-as-float — a 15% member discount on
  £145 is £21.75, and only exact integer maths reproduces that.
- **Admin writes use the editor's own session against RLS**
  (`lib/db/server.ts`), never the service-role client. `lib/db/admin.ts` is for
  scripts, scheduled jobs and test fixtures only. An ESLint rule enforces this.
- **Public routes read through `lib/db/public.ts`, never `server.ts`.** The
  difference is one property: the public client touches no cookies. `server.ts`
  calls `cookies()`, and **any route that awaits `cookies()` is opted out of
  static rendering by Next** — so using it on a public page silently turns a
  static file into a per-request render. No error, no failing test, no visual
  diff; the site just gets slower and nobody notices. RLS still applies to the
  public client as `anon`, which is what keeps drafts unreachable.
- **`lib/demo/` is seed and test data, not runtime data — with no exceptions
  left.** Since Phase 7c *every* public route reads Supabase. Each module there
  is what `scripts/seed.ts` seeds **from**, and the fixture the tests compare the
  database **against**. Editing one changes what a fresh database gets seeded
  with — it does not change what the live site shows. That indirection is the
  point: it is what makes `tests/integration/publicCatalog.test.ts` and
  `publicEditorial.test.ts` assertions rather than tautologies.
- **A category page is a document with a bound listing.** `/[category]` renders
  `categories.published_data` through `SectionRenderer`, and its `featuredLead`
  and `articleGrid` hold `$bind` descriptors resolved against the `articles`
  table by `lib/services/bindingSources.ts` — the Supabase `BindingSource`, which
  lives in `lib/services` and **not** at `lib/blocks/sources/supabase.ts`, a path
  ESLint forbids and this repo's notes wrongly promised for three phases. The
  consequence to remember: **publishing an article changes two pages**, its own
  and its category's, which is why `revalidatePublicArticle` revalidates both.
- **The build reads the database.** `npm run build` prerenders the homepage from
  `pages`, so **any** build needs a reachable, seeded project — Railway and CI
  included (CI has a `Seed content` step for this). A build failing with *"No
  published page with slug home"* is a seeding problem, not a code one. The
  route throws rather than falling back to demo data on purpose: a silent
  fallback would ship a plausible page from a broken read.
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
- **Deleting a document must clear its `media_usages` rows.** `asset_id` cascades;
  `entity_id` carries **no foreign key** — it is polymorphic by design — so the
  database cannot notice the page or article on the other end is gone. Left
  behind, those rows make every asset it referenced permanently undeletable,
  blocked by something that no longer exists. `documents.deleteDocument` calls
  `clearEntityMedia`; any new entity type with a delete path must too.
- **Every migration must be re-runnable, and CI enforces it.** The live project
  records timestamp versions while this repo numbers its files `0001`–`0014`, so
  a GitHub-integration sync sees no overlap and **replays all of them**. That is
  now safe: every `create policy` and `create trigger` is preceded by a
  `drop … if exists`, since Postgres has no `if not exists` for either. The
  `Migrations are idempotent` CI step re-applies all fourteen on top of
  themselves and fails if any statement complains. **Anything you add must keep
  that true** — guard new policies and triggers the same way.
  Applying through the Supabase MCP is still the safer habit for a one-off, but
  it is no longer the only safe option.
- **Never commit secrets.** Real values live only in
  `starter/.env.local` (gitignored). `.env.example` carries placeholder names.

## Before you commit

Run all four from `design_handoff_modern_gentlemen/starter/`:

```bash
npm run format:check && npm run lint && npm run typecheck && npm test
```

`npm run build` before anything that touches routing — Next enforces rules
(such as which symbols a route file may export) that only surface at build time.
It also needs database credentials now; see the standing rule above.

**A fresh container needs `starter/.env.local` before Playwright will run at
all.** `middleware.ts` builds a Supabase client on every request, so without it
the web server never becomes ready and `npm run test:visual` dies on a 120s
timeout whose message says nothing about credentials. Placeholder values are
enough for the visual suite — public routes render from demo modules and never
reach the database. `npm run build` and the E2E suite need real ones. The file
is gitignored; never commit it.

Then **update `PROGRESS.md`**. A hook will remind you if you forget.
