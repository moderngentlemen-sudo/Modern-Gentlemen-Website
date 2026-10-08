# Signature Studio v1.5.2 — Email asset stabilization candidate

Scope is intentionally limited to reliability fixes. Subscription, billing, team-workspace and agency-suite work is paused.

## v1.5.2 candidate changes

- One rendered-image inventory drives Full/Reply processing, including built-in
  logos/socials, custom artwork, preserved templates and QR. Hidden parents and
  unused/text-only social artwork do not publish. Missing required images fail.
- A shared email asset pipeline rasterizes processed artwork, hashes final PNG
  bytes, publishes create-only owner-scoped objects and verifies anonymous GET,
  MIME, decoded dimensions, limits and exact bytes before accepting final HTML.
- Original editable source data and old publication mappings remain intact.
  New metadata records content hash, owner, host and last successful verification.
- Copy current/Full/Reply, dual setup, guided install and designer direct install
  use a stable snapshot and fresh verified markup. Account/project/revision and
  operation guards reject stale results. The oldest legacy editor refuses its
  obsolete Gmail/publication paths and directs users to the unified workspace.
- Email Readiness distinguishes preparation, public verification, clipboard and
  pending Gmail installation. Explicit permission applies only to the selected
  snapshot/variants. Clipboard denial offers a fresh-gesture copy action.
- No production deployment, backend/schema/policy change, storage overwrite,
  object deletion, billing change, or agent-triggered restore occurred.

## Hosting diagnosis, 2026-10-07

Verified remote baseline: `signature-studio-v1` at
`0986073c8d5e6677837d2dae6dd5c06e70ce8d0b`, package 1.5.1. The fix is isolated on
`fix/signature-studio-email-assets`. Root instructions and application handoffs
were read before editing; the unrelated Next.js website is outside this change.

Railway's live public config and Variables UI both identify Supabase project
`fcewdnplakcscrtgxqdr` (MG Cloud Preview), on the organization's Free plan.
Initial unauthenticated checks failed DNS. During this session the dashboard
reported **Project is restoring**, then **Healthy**. The agent did not start
restoration. No prior INACTIVE status is presented as a newly verified fact.

After recovery, Railway `/healthz`, Supabase `/auth/v1/health`, and an empty
`signature_projects` Data API query each returned HTTP 200. `signature-assets`
is public with four authenticated owner-folder policies. INSERT WITH CHECK,
SELECT USING, UPDATE USING/WITH CHECK and DELETE USING compare the first folder
to the authenticated JWT subject, and constrain the bucket. No policies changed.
Bucket MIME is currently Any and its unset file limit inherits 50 MB; this client
enforces stricter PNG publication and 5 MiB limits. Server-side restriction would
require separate operational review, and is not claimed as enforced by this fix.

Both existing stored images were retrieved without cookies, keys or bearer
headers: HTTP 200, image/png, valid decoded 184 × 184 PNGs (6,664 and 5,116 bytes).
The existing recipe-derived names are not actual-byte hashes. They are retained
unchanged. The exact URLs in the user's installed Gmail signature are uninspected.
Free-plan pausing and long-term retention remain operational release concerns.

## Acceptance status

Final local gates: **23 syntax checks, 298/298 Node tests, 41/41 unified browser
groups, 40/40 block browser groups, 34/34 alignment groups and 3/3 simulated
designer OAuth cases passed**. No Node tests were skipped. The previous 224-test
baseline was freshly rerun, not reused from historical documentation.
Additional browser tests use real image decoders, canvas and controller code with
simulated hosting and clipboard. They are not real Gmail or Supabase write tests.

Still required before release: a durable hosting arrangement, authorized preview
deployment, real default/custom-logo new-message and reply recipient checks,
at least one external email client, explicit production approval and verified
deployment/rollback. This candidate is not declared fully accepted or deployed.

See [EMAIL_ASSET_RUNBOOK.md](EMAIL_ASSET_RUNBOOK.md) for recovery, hosting policy,
consent, diagnostic commands, URL continuity and rollback instructions.

## Previous v1.5.1 fixes retained

- Quick-hide in Layers preserves the prior `both`, `full`, or `reply` visibility state and restores it when shown again.
- The visibility restore marker survives project normalization/save/reopen.
- Connected fields that have been separated into ordinary blocks still respect the global profile visibility switches.
- Hidden parent containers cannot leak nested content into exported HTML.
- Explicit block visibility is authoritative for Full and Reply variants; the unified renderer no longer applies a second implicit rule that suppressed non-core reply fragments.
- Copy Full / Copy Reply waits for the active image-preparation pass before generating markup.
- Variant generation clones the document rather than mutating the master project.
- The existing “None” inline separator remains covered by regression tests and retains readable whitespace.

## Verification gates

Run from `signature-studio-v1/`:

```
npm run check
npm test
python tests/unified_browser.py
python tests/alignment_browser.py
python tests/blocks_browser.py
python tests/design_export_browser.py
```

The browser harnesses are offline production-module tests. They do not substitute for live Supabase authentication, real Gmail paste/installation, or recipient rendering in Outlook/Apple Mail.

## Production policy

Do not deploy this branch to the production Signature Studio service until the regression suite is green and the remaining live smoke tests are recorded.


## Preview deployment

The stabilization build may be loaded on an isolated Railway preview service for acceptance testing. The production `signature-studio-v1` service remains unchanged until explicit merge/deploy authorization.
