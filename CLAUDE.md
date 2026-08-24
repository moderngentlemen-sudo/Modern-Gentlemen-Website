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
├─ app/           (site)/ public routes incl. sign-in, forgot-password
│                 (admin)/ pages, articles, taxonomy, products, media, navigation,
│                 theme, integrations, password
│                 auth/ callback · sign-out · _lib/publicUrl.ts (see the rule below)
│                 sitemap.ts · robots.ts · api/jobs/{publish-scheduled,run-imports}/
├─ components/    sections/ (blocks + registry; the hook prints the true count),
│                 article/, chrome/, store/, ui/,
│                 seo/ (JsonLd), admin/ (ui/, builder/, fields/, media/, history/)
├─ lib/
│  ├─ blocks/     PURE: one defineBlock() manifest per section + validation
│  ├─ domain/     PURE: types, Zod schemas, business rules. No I/O, no React.
│  ├─ db/         client.ts · server.ts · admin.ts · public.ts + repositories,
│  │              and the generated database.types.ts
│  ├─ services/   orchestration + permission checks. TWO cron-fired runners
│  │              live here (scheduledPublishing, scheduledImports); both use
│  │              the service-role client because a schedule has no session.
│  ├─ catalog/    CatalogProvider — the published catalogue, in React context
│  ├─ integrations/  commerce/ — the SourceAdapter interface, TWO adapters
│  │              (xmlFeed.ts, shopify.ts), the shared http.ts (timeout + 20 MB
│  │              streamed cap) and paths.ts (the slash-path walk), plus the
│  │              named feed transforms. A LEAF: no services, no UI.
│  ├─ demo/       home-sections.ts, catalog.ts, editorial.ts, articles.ts,
│  │              category-sections.ts  (SEED + TEST FIXTURES, not what the
│  │              site renders — see the standing rule below)
│  └─ cart/
├─ supabase/      config.toml + migrations/ (all applied to the live project; the
│                 SessionStart hook prints the true count — this line has been
│                 stale twice, so it deliberately no longer names one)
├─ scripts/       seed.ts, create-admin.ts, status.mjs
└─ tests/         e2e/, integration/, visual/, a11y/, perf/, support/, setup/
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
  `lib/blocks/manifests/<type>.ts` **and add it to `manifests/index.ts`**.
  `lib/blocks/conformance.test.ts` fails the build if either half is missing.
  Manifests *describe* components — where the two disagree, the component wins
  and the manifest is the bug.
- **A block may hold other blocks only if its manifest declares a `slot`.**
  Children live in `BlockNode.children` — the structural home `traverse.ts`
  recurses into, and through it `validate.ts`, `media.ts`, `diff.ts` and
  `binding.ts` — never in a field, which would route them around all four at
  once. `validateBlock` refuses children on a manifest without a slot, so every
  other block is *provably* a leaf. `columns` is the only container today.
  ⚠️ Two things about the canvas follow from nesting and are easy to undo by
  accident: `[&_button]:pointer-events-none` is applied to **leaves only**
  (a descendant selector disables every nested block's toolbar, and
  `pointer-events-auto` cannot out-specify it), and each frame's `onMouseDown`
  calls `stopPropagation` so the **innermost** block wins the selection.
- **A `lib/domain` module that a client component imports may not touch a Node
  built-in.** `lib/domain` is pure, so client components import it freely for
  vocabularies and schemas — and that makes any `node:crypto` in one of those
  modules a build failure, `UnhandledSchemeError`, with `tsc`, ESLint and the
  whole unit suite green beforehand (Vitest runs in Node and resolves it
  happily). `lib/domain/contentHash.ts` exists solely to hold the one such
  function away from `ingestion.ts`, which the mapping editor imports;
  `lib/domain/jobs.ts` keeps its `node:crypto` because nothing on a client
  imports it. **The difference is the importer, not the module** — so check both
  ends before adding a Node import to a leaf. This bit a second time and was
  caught in advance: the feed **schedule vocabulary** belonged beside the other
  job constants in `jobs.ts`, and went into `lib/domain/ingestion.ts` instead
  because `SourceEditor.tsx` is a client component. The obvious placement would
  have been `UnhandledSchemeError` with every other gate green.
- **An import never publishes, never renames, never rewrites the tree — and a
  schedule is not a way round that.** A scheduled run (`sync_schedule`, hourly at
  most) **stages** proposals and ends at `review`, exactly as the manual button
  does; `applyJob` still needs a person. Apply writes in **bounded batches** and
  is resumable — it marks each item as it writes it — so it runs *as the editor*
  rather than as a background worker, which is what keeps `product.write` and
  `media.write` checked against a real session. `import_jobs.status` still has an
  unused `'queued'`; that is now a decision, not an oversight. A feed
  run stages proposals into `import_items`; `applyJob` is the only thing in
  `lib/services/ingestion.ts` that writes `products`. It creates **drafts**
  (`columnsForApply` never writes `status`), it never writes `slug` on an update
  (the slug is the PDP's URL, and a merchant's rename would break every link to
  it), and it never touches `draft_data`. Money arriving from a feed is guarded
  too: a bare decimal in a pence target is refused, because `145.00` is pounds
  and importing it as 145 pence is silent and live.
- **Layering flows downward only**: `app → services → db`, with `domain`,
  `blocks`, `render` and `integrations` as leaves. `lib/domain` must stay pure.
  ESLint `no-restricted-imports` enforces the boundaries — if it complains, the
  design is wrong, not the rule.
- **The chrome is data now, and one menu drives three renderings.** The header
  nav, the mega-menu and the drawer's accordion are all `header-primary` from
  `menus`/`menu_items`: top-level items are the nav bar, their children are the
  mega-menu's columns (grouped by `options.group`, because a column heading is
  not a link and `menu_item_target_shape` refuses a row with neither a `url` nor
  a `target_id`), and the drawer flattens those same children. Labels are stored
  in title case and the header uppercases in CSS. **A menu is not a document** —
  no `draft_data`, not in `document_table()` — so item writes are live and
  `revalidatePath("/", "layout")` is what publishes them. `visibility` is stored
  and deliberately never applied at render: honouring it needs a session, and
  reading one in the site layout would cost the whole public site static
  rendering.
- **Deleting a document must clear its `media_usages` rows.** `asset_id` cascades;
  `entity_id` carries **no foreign key** — it is polymorphic by design — so the
  database cannot notice the page or article on the other end is gone. Left
  behind, those rows make every asset it referenced permanently undeletable,
  blocked by something that no longer exists. `documents.deleteDocument` calls
  `clearEntityMedia`; any new entity type with a delete path must too.
- **Every migration must be re-runnable, and CI enforces it.** The live project
  records timestamp versions while this repo numbers its files `0001`–`0016`, so
  a GitHub-integration sync sees no overlap and **replays all of them**. That is
  now safe: every `create policy` and `create trigger` is preceded by a
  `drop … if exists`, since Postgres has no `if not exists` for either. The
  `Migrations are idempotent` CI step re-applies every one of them on top of
  themselves and fails if any statement complains. (Deliberately not a count —
  this line has been wrong twice by saying "fourteen" and then "fifteen".) **Anything you add must keep
  that true** — guard new policies and triggers the same way.
  Applying through the Supabase MCP is still the safer habit for a one-off, but
  it is no longer the only safe option.
- **A redirect from a route handler must go through `app/auth/_lib/publicUrl.ts`.**
  Behind Railway's proxy a route handler sees the **container's** address, so
  neither `request.url` nor `request.nextUrl` is the host the browser is on —
  `/auth/callback` shipped `Location: https://localhost:8080/...` to production
  and broke password recovery. `publicUrl` uses `x-forwarded-host`, honoured only
  when it matches `NEXT_PUBLIC_SITE_URL`'s host so a forged header cannot make an
  open redirect. **Middleware is exempt** — its `nextUrl` does reflect the
  original request, which is exactly why this hid for so long. Nothing in the
  test suite can catch it: everything runs single-host with no proxy. `curl -o
  /dev/null -w '%{redirect_url}'` against the live URL finds it in one request.
- **A template frames the page it is assigned to, and the marker decides where.**
  A `documentContent` block in a template marks where the assigned document's own
  sections are spliced in (`lib/blocks/templateContent.ts`), and **the area holding
  that marker is the area that renders** — not one called `main`. That indirection
  is load-bearing: an earlier version keyed the renderer on the name, and renaming
  an area silently unhooked the template from every page using it. Publish
  validation refuses zero markers (the page's sections would vanish) and two (they
  would render twice). Only `page` templates render today — `/article/[slug]` and
  the PDP are fixed components, not block trees.
- **A public image goes through `MediaImage` or `imageUrl.ts`, and it needs a
  `slot`.** `components/ui/MediaImage.tsx` is the public site's `<img>`;
  `optimizedImageUrl`/`backgroundImageUrl` cover the two places `next/image`
  cannot reach — a `<video poster>` and a CSS `background-image`. Two traps, both
  silent. **Leaving `sizes` off** (or picking the wrong `slot`) makes `next/image`
  assume `100vw` and download a viewport-wide file for a thumbnail: nothing
  errors, nothing looks wrong, the bytes just come back — which is how the
  homepage shipped 3,936 KB of images to a phone while every gate was green.
  And **`next/image` throws on a host it is not configured for**, which on a
  public route is a 500 — public image URLs come out of the database and an
  editor can type any URL into one, so `isOptimizableImageSrc` decides and
  anything it refuses (a third-party host, an SVG) renders `unoptimized`.
  `OPTIMIZABLE_IMAGE_HOSTS` and `next.config.mjs`'s `remotePatterns` must agree;
  a unit test reads the config and asserts it. `npm run test:perf` is the gate.
  ⚠️ `fill` is `position: absolute`, so **the parent must be positioned** — a
  `static` parent lets the image escape and cover the wrong box.
- **Never commit secrets.** Real values live only in
  `starter/.env.local` (gitignored). `.env.example` carries placeholder names.

## Before you commit

Run all four from `design_handoff_modern_gentlemen/starter/`:

```bash
npm run format:check && npm run lint && npm run typecheck && npm test
```

**`npm run test:a11y` and `npm run test:perf` are the fifth and sixth gates
worth running by hand**, and the two Playwright suites a session container can
actually execute — they need a built, seeded site but **no credentials**, where
`test:e2e` silently `test.skip`s itself without `E2E_ADMIN_EMAIL` and reports
green having run nothing. `test:a11y` is axe-core over every public route in
both themes plus the overlays' keyboard behaviour; `test:perf` is the image
budget — bytes per route on mobile, and a check that no `<img>` is served more
than 2.5× the width it is painted at. Both have their own CI step.

⚠️ **`format:check` walks `starter/` only, so it does not check this file, or
`PROGRESS.md`, or `design_handoff_modern_gentlemen/CLAUDE.md`** — CI runs it with
`working-directory: design_handoff_modern_gentlemen/starter`. All three sit above
it, none has ever been Prettier-formatted, and `--write` on them would reflow the
lot and bury whatever you changed. **Leave them unformatted**, and do not read a
green `format:check` as covering a docs edit.

`npm run build` before anything that touches routing — Next enforces rules
(such as which symbols a route file may export) that only surface at build time.
It also needs database credentials now; see the standing rule above.

**A fresh container needs `starter/.env.local` before Playwright will run at
all.** `middleware.ts` builds a Supabase client on every request, so without it
the web server never becomes ready and `npm run test:visual` dies on a 120s
timeout whose message says nothing about credentials.

⚠️ **Placeholder values are no longer enough for the visual suite.** This file
said they were, and that stopped being true at Phase 7a: `app/(site)/layout.tsx`
reads `products` — and, since 6b, the menus — on *every* public route, so with a
fake URL and key the layout throws and all 16 baselines fail. The visual suite,
`npm run build` and the E2E suite all need **real** credentials now.

**Exactly three variables make `npm run build`, `npm run test:visual`, `npm run test:a11y` and `npm run test:perf` work** (all four start a web server against a built site, so all four need them):

```
NEXT_PUBLIC_SUPABASE_URL        # Supabase MCP: get_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY   # Supabase MCP: get_publishable_keys — take the
                                # sb_publishable_… one, NOT the legacy anon JWT
                                # beside it, which carries "disabled": true
NEXT_PUBLIC_SITE_URL            # any absolute origin; http://localhost:3000 is fine
```

⚠️ **The third one is new since the SEO phase, and this file previously said two
were enough** — the same mistake it records making about placeholders above.
`canonicalSiteUrl()` refuses its localhost fallback whenever `NODE_ENV` is
production, and **`next build` sets that on a laptop and a CI runner exactly as
it does on Railway.** Without it the build dies on `Failed to collect page data
for /_not-found`, which names neither the variable nor the cause. It cost a CI
run before it was caught; `.env.example` now declares it and `ci.yml` sets it at
the top level.

Only the E2E suite and `scripts/seed.ts` need `SUPABASE_SERVICE_ROLE_KEY`. The
file is gitignored; never commit it.

Then **update `PROGRESS.md`**. A hook will remind you if you forget.
