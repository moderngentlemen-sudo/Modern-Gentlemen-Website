# Owner handoff checklist

The credential-free application work is implemented and guarded by the full CI
pipeline. These are the remaining launch inputs that code cannot choose or
invent. They are intentionally isolated here so ordinary development does not
block on them.

## Decisions

- [ ] Choose the production checkout experience: Stripe-hosted Checkout or
  Stripe Elements. The current checkout remains explicitly labeled as a demo
  until one is selected; raw card capture is not an option.
- [ ] Choose membership billing terms and lifecycle: recurring vs one-time,
  plan/price ids, trial/refund/cancellation rules, and which successful payment
  events grant or remove membership.
- [ ] Choose the newsletter ESP and approve consent, privacy, double-opt-in and
  unsubscribe wording/workflow. Supabase capture, staff review and safe CSV
  export already work without an ESP.
- [ ] Choose video processing infrastructure (managed provider or an approved
  FFmpeg worker), renditions, poster policy and retention/cost limits. Upload,
  storage, metadata, checksum deduplication and responsive image delivery are
  already implemented.
- [ ] Decide whether any transcript-only header exploration knobs should become
  supported product presets. The compatibility header and arbitrary global
  header templates already reproduce and extend the shipped compositions.

## Credentials and external configuration

- [ ] Supply the production Supabase URL, anonymous key and service-role key.
- [ ] Supply a strong `JOBS_SECRET` and the canonical HTTPS site origin.
- [ ] Supply Stripe keys and webhook signing secret after checkout is chosen.
- [ ] Supply Shopify Admin API credentials for each merchant source that will
  sync. The REST and direct-collection GraphQL adapters are implemented and
  fixture-tested; only a live merchant verification remains.
- [ ] Supply the chosen newsletter/media provider credentials after those
  decisions are made.
- [ ] Add `<production site origin>/**` to Supabase Auth Redirect URLs.

## Production content and rights

- [ ] Approve final copy, products, prices, membership offers and legal pages.
- [ ] Upload licensed production imagery/video and confirm usage rights, alt
  text, credits and focal points.
- [ ] Confirm production navigation, social destinations and account URL.

## Launch operations

- [ ] Apply all checked-in Supabase migrations to the production project.
- [ ] Configure Railway with the documented variables; `npm run deploy:check`
  runs before every production build and rejects missing/placeholder secrets.
- [ ] Run the live Shopify connection check and payment/newsletter/media
  provider smoke tests once their credentials exist.
- [ ] Merge the reviewed pull request to `main`, deploy, then verify recovery
  email, scheduled jobs, checkout/webhooks and public smoke paths.

Everything else—including the builder, templates, imported library, CMS,
catalogue, ingestion review, media library, navigation, theme, preview,
revisions, CI, accessibility, visual regression and performance budgets—is
implemented without requiring these choices.
