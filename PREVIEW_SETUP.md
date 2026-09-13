# Isolated website preview

The optional preview service runs the existing Next.js application behind a
password gate. The production start command and application renderer are unchanged.
Use a separate development branch, hosting service, and Supabase project.

## Render free-tier trial

The repository-root `render.yaml` creates one Node 22 web service on the explicit
`free` plan. It creates no database, disk, worker or paid service. Deploy from
`codex/persistent-preview`, with Blueprint auto-sync disabled during setup and
service auto-deploys off. Use manual deployments of commits that have passed CI.
If a service named `mg-protected-preview` already exists, inspect it before
applying the Blueprint; Render can update resources with a matching name.

During Blueprint creation, supply the four preview database/source variables
marked `sync: false` using the separate preview project's verified values.
Render generates the gateway password and supplies its actual HTTPS origin
through `RENDER_EXTERNAL_URL` at build and runtime. Read the generated password
in the service's Environment settings; the gateway username is `preview`.
No server key is required in the ordinary web-service environment.

- Root directory: design_handoff_modern_gentlemen/starter
- Build: node scripts/check-preview.mjs && npm ci --include=dev && npm run build
- Start: npm run preview:start
- Healthcheck: /_mg-preview/health
- Keep the service on Free. Do not add a payment method or authorize usage
  overages for this trial. A quota-related pause is preferable to an automatic
  charge; do not upgrade without a separate cost decision.

Render's free service has 512 MB RAM and 0.1 CPU. It sleeps after 15 minutes
without inbound traffic and takes about a minute to wake. It has an ephemeral
filesystem, so content and uploads stay in the separate Supabase project.
Do not run keep-alive pings to defeat idle sleep. Verify memory, cold starts,
sign-in, both builders and media playback on the actual free instance before
calling the hosted trial successful. Local measurements are only a feasibility
check. Free service hours, build minutes, bandwidth and outbound traffic limits
still apply; see https://render.com/docs/free.

Full hosted verification still requires the scoped media transfer, the separate
administrator and Auth redirects described below. Do not interpret successful
public-page rendering as authenticated editor or video verification.

## Railway alternative

- Repository root directory: design_handoff_modern_gentlemen/starter
- Config file: design_handoff_modern_gentlemen/starter/railway.preview.json
- Build command: npm run preview:check && npm run build
- Start command: npm run preview:start
- Healthcheck: /_mg-preview/health
- Deploy only after hosting costs have been approved.

## Preview environment

Set these variables only on the preview service (the Render Blueprint supplies
the site origin and generated gateway credentials automatically):

| Variable | Value |
| --- | --- |
| MG_PREVIEW | 1 |
| MG_PREVIEW_SUPABASE_REF | The independently verified preview project reference |
| MG_PREVIEW_SOURCE_SUPABASE_URL | Source site's Supabase HTTPS origin |
| NEXT_PUBLIC_SUPABASE_URL | Preview project's Supabase HTTPS origin |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Preview project's enabled publishable key |
| NEXT_PUBLIC_SITE_URL | The preview service's actual HTTPS origin |
| MG_PREVIEW_USERNAME | Preview access username |
| MG_PREVIEW_PASSWORD | Unique random password of at least 32 characters |

The gateway protects HTML, assets, API routes, and media served by the app.
It preserves session cookies, streamed responses and video byte ranges.
Every response has noindex and no-store headers; robots.txt disallows crawling.
Only robots.txt and a content-free readiness endpoint are available without
the preview password. Expose the hosting provider's public domain on the gateway port only;
Next listens on loopback at the next port.

Supabase public content and public Storage remain governed by their own API/RLS
policies. The gateway does not make published database content private.

Scheduled job endpoints are disabled in the preview. The Next child process
receives no gateway password, service-role key, scheduled-job secret or feed
credentials. Ordinary admin editing still uses the editor's session and RLS.

## Content and media

Import only published document payloads, referenced media metadata, navigation,
theme settings and public taxonomy into the separate project. Initialize preview
drafts from published payloads, clear source user references and schedules, and
omit members, subscribers, form submissions, history and integration credentials.
Keep export files out of git. An initial copy must not overwrite subsequent
editor work; further refreshes need a deliberate reconciliation.

Rewrite source Storage origins to the preview origin in imported documents.
Then, with the preview environment loaded and its server key supplied securely:

    node scripts/copy-preview-media.mjs <published-asset-id> [more-published-asset-ids]

Pass only the asset IDs identified by the published-content export. This reads
those specific preview catalogue rows, fetches source objects publicly,
uploads to preview Storage, and verifies SHA-256 bytes. It never overwrites an
existing object. External and bundled image references remain external references.
Do not import the entire source media library merely to make this script broader.

Use the existing scripts/create-admin.ts with an explicit preview admin email
and password and the preview server key. Configure Supabase Auth's site URL and
allowed redirects for the preview origin. Keep production users and secrets out
of this environment.

## Migration exception and verification

On the initial hosted preview, migration 0012_grants was not executed: automatic
approval review rejected its grants on all current and future tables/sequences.
The project already had the necessary table grants. No override or substitute
blanket grant was used. All other 30 existing migrations were applied.

Checks confirmed that all seven document tables have RLS enabled, anonymous
published-data column access, no anonymous draft-data access, and authenticated
staff read policies. This is a recorded environment exception, not a claim that
31 migrations executed there. Do not automatically replay migrations into the
hosted preview; review unapplied entries individually.

The existing GitHub Actions workflow remains the full regression gate against
disposable seeded databases. It also runs npm run test:preview for the gateway.
Hosted preview smoke checks complement those fixture-based tests; do not run
destructive fixture suites against production or an editor's working preview.

The four admin screenshot references were captured on the authenticated Linux CI
host and visually reviewed. They cover the dashboard and page list in both themes,
masking changing table content. Missing references now fail instead of skipping;
explicit snapshot updates remain a capture-and-review operation. Normal CI compares
against the committed images rather than regenerating them.

Preview routes resolve dynamic story listings after pattern/template composition,
using the public binding sources. A category preview and a template framing that
category therefore render working story links without exposing related drafts.
Route tests cover all three binding contexts and an authenticated E2E checks the
actual category preview. CI prints each E2E test name to help trace server errors
that might otherwise appear between anonymous progress dots.

The editor canvas shows dynamic-content placeholders for unresolved queries,
preserving the stored descriptors and normal selection/reorder/delete controls.
This prevents a full editor reload from rendering an undefined story link before
client error boundaries can run. The site preview resolves the actual stories.
SSR tests cover both storage formats; E2E reloads the editor, checks the public
preview, and preserves an editor screenshot for review.
