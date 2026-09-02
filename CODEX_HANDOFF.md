# Modern Gentlemen Website — Codex Handoff

Last updated: 2026-09-02, America/Chicago

This document is a current-session handoff for continuing the Modern Gentlemen website in a new Codex chat. It intentionally records the live regression and temporary diagnostics that are newer than several status statements in `PROGRESS.md`.

## Prompt to paste into the new chat

> Continue work on the Modern Gentlemen website from `CODEX_HANDOFF.md`. Read that file completely, then read `AGENTS.md`, `CLAUDE.md`, `PROGRESS.md`, and `design_handoff_modern_gentlemen/CLAUDE.md` before editing. Work on `main`, as explicitly requested. Confirm that commit `4f048ae` and CI #279 remain the latest verified builder repair, then continue the ordered backlog. Preserve the governing compatibility rule: transformative builder changes are welcome only when every existing design, element, responsive behavior, and public function remains reproducible. Never commit credentials.

## 1. Repository and runtime

- GitHub repository: <https://github.com/moderngentlemen-sudo/Modern-Gentlemen-Website>
- User-required branch: `main`
- Local repository:
  `C:\Users\jason\Documents\Codex\2026-08-29\github-plugin-github-openai-curated-remote\work\Modern-Gentlemen-Website-style-system`
- Next.js application:
  `C:\Users\jason\Documents\Codex\2026-08-29\github-plugin-github-openai-curated-remote\work\Modern-Gentlemen-Website-style-system\design_handoff_modern_gentlemen\starter`
- Framework: Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 3.4.
- Backend: Supabase/Postgres with RLS.
- Payments direction: Stripe; production payment completion still requires external configuration/credentials.
- Hosting: Railway. Its Root Directory must remain `design_handoff_modern_gentlemen/starter`.
- Live application: <https://modern-gentlemen-website-production.up.railway.app>
- Supabase project id: `qnfoztnyxhubnnulpfwt`
- Required Node version: Node 22 or newer.
- Bundled Node in this desktop environment:
  `C:\Users\jason\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`

The app is not at the repository root. Run all npm/package scripts from `design_handoff_modern_gentlemen/starter`.

## 2. Non-negotiable governing rule

The builder and underlying platform may be changed extensively to produce more creative freedom, better design tools, and better performance. However, every existing site design, section, element, responsive behavior, commerce behavior, and public function must remain reproducible in the new system.

Practical consequences:

- Existing high-fidelity section components remain supported beside new low-level primitives.
- Removing a section requires an explicit content migration, a compatibility renderer, and visual proof.
- Unset builder style settings must emit no CSS or wrapper geometry, preserving existing output as a literal no-op.
- Public visual baselines in `design_handoff_modern_gentlemen/handoff/screenshots/` remain the compatibility gate.
- Do not “clean up” public component spacing, class order, typography, corners, or breakpoints without visual evidence and explicit intent.
- Any builder transformation must be able to rebuild the original website, not merely approximate it.

## 3. Resolved regression — historical diagnosis

The project returned to green on 2026-09-02 in GitHub `main` commit `4f048ae81e75dc79736a166d8cbbfbbcfe89f9bc`. CI run #279 passed the complete pipeline: <https://github.com/moderngentlemen-sudo/Modern-Gentlemen-Website/actions/runs/33663217620>.

The previously failing test was:

```text
tests/e2e/builder.spec.ts:434
page builder — drag from the library › swaps two columns by dragging one onto the other
```

The test drags the first of two direct `column` children onto the second and expects the two direct column keys to reverse. It previously remained unchanged on the initial attempt and both retries.

The last failing diagnostic run was:

- Run: CI #278
- Commit: `f750bf11e1dbff24bcc47a12ed02c61c8c2414c3`
- Title: `test: print drag lifecycle diagnostics`
- URL: <https://github.com/moderngentlemen-sudo/Modern-Gentlemen-Website/actions/runs/33656618183>
- Result: failed only in the E2E step.
- Static job: passed Prettier, ESLint, env declaration checks, TypeScript, and unit/component tests.
- Integration job: passed, including migration idempotency.
- Browser job: 81 E2E passed, 1 failed, 1 did not run; 16 visual tests passed; 27 accessibility tests passed; 14 performance tests passed.

### Root cause proven by CI #278

The temporary instrumentation proved that the gesture reaches `onDragEnd`; it is not cancelled. On all three attempts, dnd-kit reports an insertion gap inside the destination column:

```text
[builder:dnd:end] {
  active: <first-column-key>,
  activeKind: block,
  eventOverId: gap:<destination-column-key>:0,
  lastOver: gap:<destination-column-key>:0,
  overId: gap:<destination-column-key>:0
}
```

The test then prints the same `phase: "end"` lifecycle payload from `data-builder-dnd-debug`, but the direct column order does not change.

The same generated active key appeared in the preceding Newsletter move and in the supposed Column move on every retry. The test found the Column button, then converted its box to `page.mouse` coordinates. At those coordinates the first nested Newsletter toolbar covered its parent Column toolbar: both were top-right, and Newsletter's greater depth gave it the higher z-index. The browser therefore started another Newsletter drag and correctly moved Newsletter toward the second column, leaving the direct Column order unchanged.

The correction gives nested toolbars separate depth-based vertical lanes while retaining depth z-index. It also fixes a latent measurement defect: `BuilderLayout` used `useDndContext` above the `DndContext` it returned, so its release-time fallback saw the default/empty rectangle map. The collision callback now retains the live provider-owned map instead. A Canvas unit regression asserts the real `columns → column → newsletter` toolbar depth and lane arrangement.

## 4. Diagnostics cleanup

All temporary `[builder:dnd:*]` and `[builder:test:debug]` console output and the `data-builder-dnd-debug` DOM attribute were removed in `4f048ae`. Do not restore them unless a new bounded diagnostic run genuinely requires them.

## 5. Local and remote Git state

At the original handoff time, before the repair:

```text
local branch: main
local HEAD:   710d631 fix: resolve two-column drops without geometry
local edits:  Builder.tsx and tests/e2e/builder.spec.ts (temporary diagnostics)
```

The local checkout's `origin/main` tracking ref may still be stale. The verified GitHub `main` repair is `4f048ae81e75dc79736a166d8cbbfbbcfe89f9bc`.

Do not push or overwrite either side until reconciling the two histories and preserving the local diagnostic work. Start with read-only inspection and `git fetch origin main`. Avoid destructive reset/checkout operations; existing modifications belong to the current work.

Recent local drag-related commits:

```text
710d631 fix: resolve two-column drops without geometry
83a211d fix: allow horizontal fallback when no droppable is over
2ab614e fix: retain last valid drag collision
10398e7 fix: resolve horizontal drops from final pointer position
596c653 fix: target direct siblings when swapping columns
8ad4b6b fix: import subtree collision helper
29dc688 fix: exclude dragged subtree from column collision
b2ba856 fix: ignore inner gaps while swapping columns
2cccd82 fix: route horizontal gap drops to sibling columns
1248a9d chore: format column order test
e30e62a test: assert column order directly
41b0dbf fix: preserve column swaps with pointer-first gaps
```

Recent remote diagnostic/repair commits include:

```text
f750bf1 test: print drag lifecycle diagnostics
d04bfcd diagnostic lifecycle work
ba8c4e  test console forwarding
de521eb  cancellation logging
82e8c00 diagnostic console logs
78e88e7 normalize EOF line endings
9ebd0e2 restore UTF-8 (temporarily left an EOF formatting issue)
20270f1 accidental binary Builder.tsx commit; superseded and repaired
d290e39 fix: allow horizontal fallback when no droppable is over
```

The binary/encoding incident has been repaired on the remote. Prettier is green in CI #278. The history remains useful context: when using the GitHub connector, update text files with raw UTF-8 content. A prior base64/blob route produced a binary file. Tool output may add one terminal `CRLF`; remove exactly one synthetic terminal newline before a raw file update so Prettier sees one LF at EOF.

Multiple sequential GitHub file writes create multiple commits and CI runs; workflow concurrency cancels older runs. Prefer a single coherent commit for a multi-file fix.

## 6. Last known verification state

CI #279 after the repair:

- Full unit suite passed: 1,807/1,807.
- Focused builder suites passed: 200/200 across 6 files.
- Local TypeScript and Prettier checks passed after the UTF-8/EOF repair.
- Production build passed in GitHub Actions.
- Integration tests and migration idempotency passed against local Supabase.
- All 83 E2E tests passed, including Column reorder persistence and fixture cleanup.
- All 16 visual, 27 accessibility, and 14 performance tests passed.

Known non-failing warnings:

- Next.js image-quality warning for quality `70`.
- A React test `act(...)` warning in an InsertMenu test.

Full local E2E could not be reproduced in the Codex desktop environment because the local Supabase CLI/Docker stack was unavailable. GitHub Actions is the authoritative E2E environment until that dependency is present.

## 7. Commands

From a normal development machine with Node/npm on `PATH`:

```bash
cd design_handoff_modern_gentlemen/starter
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
npm run test:e2e
npm run test:visual
npm run test:a11y
npm run test:perf
```

The four credential-free pre-commit gates are:

```bash
npm run format:check && npm run lint && npm run typecheck && npm test
```

In the current Codex desktop environment, `npm` is not on `PATH`. Run local module CLIs through the bundled Node executable, for example:

```powershell
$node = 'C:\Users\jason\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
Set-Location 'C:\Users\jason\Documents\Codex\2026-08-29\github-plugin-github-openai-curated-remote\work\Modern-Gentlemen-Website-style-system\design_handoff_modern_gentlemen\starter'
& $node '.\node_modules\prettier\bin\prettier.cjs' --check .
& $node '.\node_modules\eslint\bin\eslint.js' . --max-warnings=0
& $node '.\node_modules\typescript\bin\tsc' --noEmit
& $node '.\node_modules\vitest\vitest.mjs' run --project=unit
```

Computed status command from the repository root:

```powershell
& $node 'design_handoff_modern_gentlemen/starter/scripts/status.mjs'
```

At handoff it reported 27 migrations, 1,113 unit test declarations, 83 E2E declarations, two uncommitted files, and that `PROGRESS.md` lagged code changes.

Important testing caveats:

- `npm run build` reads the database while prerendering. It needs a reachable, seeded Supabase project.
- E2E silently skips signed-in coverage when `E2E_ADMIN_EMAIL` is missing. A green zero-test/partial run is not proof.
- Visual, accessibility, and performance runs require a built site backed by seeded Supabase data.
- Do not casually bump Playwright or Supabase CLI pins; both are deliberate CI compatibility choices.

## 8. Environment variables and credentials

Do not place values in this handoff, source files, commits, console output, or chat messages.

Core runtime variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SITE_URL
```

Privileged/server variables:

```text
SUPABASE_SERVICE_ROLE_KEY
JOBS_SECRET
```

Signed-in E2E setup additionally needs the admin test identity variables documented by the CI workflow and `.env.example`, including `E2E_ADMIN_EMAIL` and its password counterpart.

The known admin email is `welcome@moderngentlemen.co`; its password is deliberately not in this document or the repository.

Use the Supabase publishable key expected by the project, not an obsolete disabled legacy anon JWT. Keep local values in `starter/.env.local` and production values in the relevant platform secret stores.

## 9. Database and deployment status

- Supabase schema has 27 repository migrations.
- The live project was last verified through migration `0026`.
- `0027_form_submissions.sql` must be applied before native published forms can accept live submissions.
- Every migration must be idempotent. CI reapplies migrations to enforce this.
- The Supabase GitHub integration must point its Supabase directory to `design_handoff_modern_gentlemen/starter/supabase`, not the repository root.
- Supabase Redirect URLs must include the live Railway origin for auth/password recovery.
- Railway must use the app directory as its root and must hold the production environment variables.
- A build failure saying no published page exists for slug `home` indicates missing/unreachable seed data, not a reason to add a demo fallback.

Public forms are a security boundary: the Form element posts bounded scalar fields to `/api/forms`, applies caller/global rate limits and a honeypot, and writes through the anonymous Supabase client. Do not replace this with a service-role browser path or expose storage details.

## 10. Architecture and standing contracts

Important directories under `starter/`:

```text
app/                    Next.js public and admin routes, auth, API jobs
components/sections/    High-fidelity public sections and registry
components/admin/       Admin UI, builder, fields, media, history
components/chrome/      Header, navigation, overlays, footer
components/store/       Storefront components
lib/blocks/             Pure block manifests, validation, traversal/render support
lib/domain/             Pure types, schemas, and business rules
lib/db/                 Public/session/service clients and repositories
lib/services/           Permission-aware orchestration and scheduled runners
lib/integrations/       XML and Shopify source adapters
lib/demo/               Seed/test fixtures only; never public runtime data
lib/cart/               Cart contracts/provider
supabase/migrations/     Idempotent database migrations
scripts/                Seed, admin provisioning, status
tests/                  Unit, integration, E2E, visual, a11y, performance
```

Layering flows downward: `app → services → db`; `domain`, `blocks`, render helpers, and integrations are leaves. ESLint enforces important boundaries.

Critical contracts:

- Money is integer pence. Convert only through the domain money utilities.
- Admin writes use the editor's session and RLS, not the service-role client.
- Public routes read through `lib/db/public.ts`, not the cookie-reading server client, to preserve static rendering.
- `lib/demo/` feeds seeds and tests only. Editing it does not directly edit live content.
- Each section requires both a registered React component and a block manifest registered in the manifest index.
- Nested children live only in `BlockNode.children`; a block may contain children only when its manifest declares a slot.
- A block cannot be moved into its own subtree.
- Client-imported domain modules must not import Node built-ins.
- Imports stage reviewable drafts; they never publish, rename existing slugs, or bypass human apply.
- Deleting document entities must clear polymorphic `media_usages` rows.
- Auth route-handler redirects must use `app/auth/_lib/publicUrl.ts` behind Railway's proxy.
- Templates use a `documentContent` marker; marker location, not an area name such as `main`, controls composition.
- Public database image URLs need optimization-host validation; arbitrary hosts must render unoptimized instead of throwing.

## 11. Builder capabilities already implemented

The admin builder is well beyond a simple section list. Existing capabilities include:

- Nested block trees and structural traversal.
- Layout primitives: container, stack, columns, and column.
- Add/library rail and navigator/hierarchy rail.
- Click insertion and drag insertion from the library.
- Nested insertion gaps and cross-container movement.
- Block-on-block sorting and horizontal column reordering work in unit coverage; one real-browser forward swap remains regressed as described above.
- Duplicate, delete, lock, hide, and visibility controls.
- Multi-selection and grouped operations, skipping locked elements.
- Undo/redo with bounded/coalesced history.
- Autosave and dirty-state tracking.
- Desktop, tablet, and mobile responsive editing.
- Canvas zoom, rulers, grid, resize snapping, and viewport preferences that do not publish.
- Finite, bounded exact sizing and offsets.
- Spacing, surface, border, corner, shadow, opacity, overflow, hover, and motion controls.
- Dynamic bindings and binding-source resolution.
- Reusable responsive style classes.
- Templates with named areas and `documentContent` composition markers.
- Synced and detachable patterns.
- Preview, validation, publish, scheduling, snapshots, revision history, comparison, rollback, and autosave flows.
- Low-level native blocks: Heading, Text, Image, Video, Embed, Icon, Product, Form, Button, Divider, and Spacer.
- Safe bounded Markdown rendering for rich editorial strings; raw HTML is not interpreted.
- Featured media models for image, GIF, video, embed, and ordered gallery presentation.
- Draft preview support and fixed compatibility paths for page, category, article, product, shop, header, and footer templates.

## 12. Theme, typography, and design customization

Theme editing is available at `/admin/theme`.

Implemented customization includes:

- Editable color tokens with the verified original values as defaults/fallbacks.
- Font-role mapping for body, headings, editorial accents, labels/meta, and navigation.
- Thirteen built-in/platform font choices.
- Up to twelve named custom webfonts in the theme payload.
- HTTPS provider stylesheet support.
- Direct WOFF, WOFF2, TTF, and OTF webfont URL support.
- Explicit fallback category, supported weight, and style metadata.
- Custom content width and desktop/mobile gutters.
- Header height, scroll behavior, background behavior, search/theme/bag controls, scale, compact-on-scroll, divider, icon bubbles, and icon-hover settings.
- Existing v1–v4 theme payloads gain newer defaults at read time.
- Claude Design tweak inventory mapped to bounded options only where renderer behavior exists.

Original default typography remains:

- Space Grotesk for body/headings.
- Instrument Serif for editorial accents.
- IBM Plex Mono for labels/meta/counts.
- Futura/Century Gothic/Trebuchet stack for navigation.

The original visual defaults must remain a no-op when no custom setting is selected.

## 13. Section library

All 145 entries from the supplied standalone Modern Gentlemen Section Library mockup were made native/selectable builder presets.

- `heroStudio` covers entry 001 and entries 069–125.
- `sectionStudio` covers entries 002–068 and 126–145.

These are shared archetypes with per-preset data/options, not 145 unrelated screenshot-hardcoded React files. Treat them as a compatibility and creativity library: settings may be expanded, but current presets must continue to render.

## 14. Admin routes

Primary admin destinations:

```text
/admin
/admin/pages
/admin/articles
/admin/products
/admin/categories
/admin/templates
/admin/patterns
/admin/media
/admin/navigation
/admin/theme
/admin/integrations
/admin/taxonomy
```

Builder/editing routes:

```text
/admin/pages/[id]
/admin/articles/[id]/builder
/admin/products/[id]/builder
/admin/categories/[id]
/admin/templates/[id]
/admin/patterns/[id]
```

## 15. Public CMS, commerce, and platform features already implemented

- Database-backed public pages, articles, categories, products, shop, and site chrome.
- Page/article/category/product template assignment with compatibility fallback.
- Header, mega-menu, drawer, footer, search, theme control, and bag/cart experiences.
- Nested database-driven menus with page/category/product/external targets.
- Media library, public media usage tracking, optimization routing, and deletion protection.
- Draft/published states, strict validation, immutable revisions, named snapshots, compare, rollback, and scheduled publishing.
- Auth, password recovery, permission-aware admin shell, RBAC, and RLS.
- Forty-four permissions on the provisioned admin role at last verification.
- Dynamic category/article bindings.
- Store catalogue, product detail, bag/cart, checkout flow, membership pricing rules, and integer-pence calculations.
- Newsletter capture and native form submission path.
- WooCommerce-style XML ingestion adapter and Shopify JSON adapter behind a shared source abstraction.
- Paginated imports, proposal/review/apply workflow, status/error reporting, scheduled import runner, and bounded/resumable applies.
- SEO metadata, sitemap, robots, and structured data support.
- Visual regression, WCAG 2.2 AA axe coverage, and performance budgets in CI.

## 16. Accepted limitations and items that need verification

Some `PROGRESS.md` items are historical and contradict newer code. Verify in source and tests before treating them as open.

Accepted or deliberately bounded behavior:

- dnd-kit's approximately 50 ms post-drop click suppression window.
- An empty `columns` row is intentionally publish-invalid because its slot requires at least one child.
- Hover previews have an accepted mount cost.
- Fresh environments need real database credentials and seed data.
- Builder viewport preferences are editor-only and never publish.

Items whose current state should be verified rather than inferred from older prose:

- Device visibility: older notes say it is stored but not rendered, while newer builder work says responsive visibility is implemented. Read the current renderer/tests before changing it.
- Precise dropping into non-empty containers: older backlog text calls this open, but recent builder code and E2E setup implement nested gap insertion. Treat the prose as stale unless tests prove otherwise.
- Migration/live status: repository has `0027`; live was verified only through `0026`.

## 17. Remaining product and engineering work

After the E2E regression is fixed and CI is green, use this recommended order:

1. Reconcile current docs with code and update `PROGRESS.md` so the live regression/repair and test counts are accurate.
2. Add reusable entrance and scroll-animation states, respecting `prefers-reduced-motion` and preserving zero-style output when unset.
3. Add one-click “save selection as pattern.”
4. Add document duplication for pages/templates/layouts.
5. Add a global keyboard command palette.
6. Expose media tagging in the admin.
7. Add conditional navigation rules, with a design that does not accidentally make the public layout dynamic through session access.
8. Add Shopify collection import/mapping as a first-class sync stream.
9. Add explicit E2E scenarios for featured-video creation, responsive/device visibility publishing, revision restore, and any remaining critical flows.
10. Add production credential verification for a real Shopify merchant connection when credentials are supplied.
11. Finish real Stripe payment/webhook configuration and production acceptance when credentials/business decisions are supplied.
12. Rate-limit `resolve_preview`; migration `0026` provides `rate_limit_hit()`/the shared rate-limit mechanism, but decide the correct preview-link identity key.
13. Improve the ingestion runner so a long import does not hold one server action open for its full duration.
14. Audit the role-less authenticated `draft_data` read boundary across document tables and, if still open, design the security-definer read path before altering 41+ admin read sites.

Brand/business decisions and external configuration are not safe to invent. Ask before choosing final production payment, merchant, email-delivery, analytics, legal copy, domain/DNS, or deployment-secret values.

## 18. Definition of green before feature work resumes

Do not resume additive development until all of the following are true:

- The two direct columns reverse in the real Playwright E2E test and remain reversed after save/reload.
- The serial cleanup test runs and deletes its fixture page.
- Temporary console and DOM diagnostics are removed.
- Prettier, ESLint, TypeScript, and the full unit suite pass.
- Integration and migration-idempotency tests pass.
- Production build passes against seeded Supabase.
- E2E, visual, accessibility, and performance jobs pass in GitHub Actions.
- Local and GitHub `main` have been reconciled without losing either the functional changes or diagnostic evidence.
- `PROGRESS.md` is updated to describe the actual state.

## 19. Source-of-truth reading order

Read these in order at the start of the new chat:

1. `CODEX_HANDOFF.md` — this live handoff and regression state.
2. `AGENTS.md` — repository operating instructions.
3. `CLAUDE.md` — architectural contracts; despite the name, it applies to every agent.
4. `PROGRESS.md` — extensive history and known issues; verify stale claims against code.
5. `design_handoff_modern_gentlemen/CLAUDE.md` — authoritative design baseline.
6. `ORIGINAL_SCOPE_AUDIT.md` — original requested backend/admin scope and status.
7. `EXECUTION_PLAN.md` — original implementation and verification plan.
8. `design_handoff_modern_gentlemen/BUILDER_ENGINE.md` — builder/tweak contract.
9. `design_handoff_modern_gentlemen/IMPLEMENTATION_BRIEF.md` — original delivery brief.
10. `design_handoff_modern_gentlemen/01_ARCHITECTURE.md`
11. `design_handoff_modern_gentlemen/05_SECTION_BUILDER.md`
12. `design_handoff_modern_gentlemen/06_SUPABASE.md`
13. `design_handoff_modern_gentlemen/MODULE_MAP.md`
14. `design_handoff_modern_gentlemen/HANDOFF_CHECKLIST.md`
15. `design_handoff_modern_gentlemen/VERIFICATION_REPORT.md`

Prefer computed/live evidence over prose:

- run `scripts/status.mjs`;
- inspect `git status`, local commits, and GitHub's actual `main` tip;
- read current source and migrations;
- inspect the latest GitHub Actions jobs/logs;
- run the applicable test suites.

## 20. Working discipline

- Preserve unrelated user changes in a dirty worktree.
- Use patch-based edits and review diffs before committing.
- Never use destructive resets or checkouts to reconcile the current divergence.
- Never commit secrets or `.env.local`.
- Keep changes small enough to diagnose, but avoid creating many connector commits that repeatedly cancel CI.
- Add or update focused tests for every fix, then run the full proportional suite.
- When a section is added, register both its renderer and manifest.
- When behavior affects public visuals, compare against the retained screenshots.
- When behavior affects authoring, prove both the editor state and persisted/reloaded state.
- Record what was predicted, what was actually changed, and what verification cost in `PROGRESS.md`.

The immediate goal is not “make the assertion pass somehow.” It is to make column drag behavior semantically correct in the real browser, preserve cycle safety and nested insertion, remove the temporary observability code, and return the entire pipeline to green before continuing the builder roadmap.
