# Signature Studio v1.5.1 — Stabilization pass

Scope is intentionally limited to reliability fixes. Subscription, billing, team-workspace and agency-suite work is paused.

## Fixed

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
```

The browser harnesses are offline production-module tests. They do not substitute for live Supabase authentication, real Gmail paste/installation, or recipient rendering in Outlook/Apple Mail.

## Production policy

Do not deploy this branch to the production Signature Studio service until the regression suite is green and the remaining live smoke tests are recorded.
