# Modern Gentlemen signature sections

The 24 approved sections are registered in the existing Original and Canvas builders. Open a page, article, category or template, then search **Signature collection** in **Add a section**. Each entry starts with **MG ·** and has a live design preview.

The collection includes The Cover Story, The Dispatch Desk, The Style Forecast, The Capsule Wardrobe, The Watch Vault, The Collector Comparison, The Open Road, The Garage Notes, The Great Escapes, 48 Hours Well Spent, The Hotel Register, The Chef's Counter, The Cellar Notes, After Hours, The Cultural Radar, The Screening Notes, In Good Company, Makers & Methods, The Art of Living Well, The Daily Practice, The Residence, Modern Gentlemen Presents, A Brand Perspective and The Considered Reading List.

All sections support editable copy, feature and entry images, image descriptions and credits, optional destinations, site-theme or dark treatment, spacing and image focal point. The interview and reading-list sections use keyboard-accessible native disclosures; the comparison uses semantic table headers. Partner stories retain a visible disclosure.

The illustrative picker media is preview-only. New documents start with editable copy and no unapproved photography or invented destinations. Editors supply their own media and destinations through the existing controls before publishing. The collection adds reusable sections; it does not rewrite published compositions or add coordinate templates to the separate native HTML Studio.

## Implementation

- `lib/blocks/mgSignatureSections.ts`: stable identities, descriptions and insertion defaults.
- `lib/blocks/manifests/mgSignatureSections.ts`: the editable field contract.
- `components/sections/MGSignatureSections.tsx` and its scoped CSS module: public rendering.
- `components/admin/builder/signaturePreview.ts`: picker illustrations, independent of saved data.
- Existing manifest, renderer and picker registrations make the collection available without a database migration, configuration change or new dependency.

## Verification

The approved design preview was checked at desktop, tablet and phone widths, in light and dark themes, with no overflow or gallery WCAG A/AA violations. The implementation was then applied additively to live `main` at `7ea2a002a054f5b7b79b500b1bcc0d2ad75a31ef`; offline preview infrastructure and unrelated unreleased work were not brought into the release.

Local format, lint and TypeScript checks pass. Of 2,947 unit/component checks, 2,943 passed in the initial sandbox run; all four deployment-preflight subprocess checks passed when rerun outside the sandbox. There were no source changes needed for that environment limitation.

`tests/e2e/signatureSections.spec.ts` exercises all 24 insertions, editing through both builders, save/reopen, real publish validation, anonymous public rendering, responsive overflow, theme accessibility and keyboard disclosures. It writes only to the isolated CI stack and deletes its fixture through the editor. The existing full CI retains the production build, database integration, E2E, visual, accessibility and performance gates. Consult the pull request checks for their release result.
