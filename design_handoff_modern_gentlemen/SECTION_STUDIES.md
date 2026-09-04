# MG section studies — mockup-to-builder index

These 36 additive options use their own namespace, **MG Study 01–36**. They do
not replace or renumber the original Section Library or Section Studio presets.
Search `MG Study` or a study's name in **Add a section**, hover/focus to preview,
and click or drag to insert. Each instance has independent copy, media, links,
tone, mobile image/text order and image focal-point controls. The existing
builder's design frame adds spacing, typography, visibility and other overrides.

The picker renders the actual component with explicitly illustrative sample
media from existing project assets. Those preview props never enter inserted
documents. Inserted sections contain editable placeholder text and no images,
destinations, prices, launch dates or partner claims. Select owner-approved
content before publication. Membership and film actions require an authored
destination; they do not invent purchases or video playback. Study 31 uses the
existing real newsletter API, including throttled, failed and pending states.

| Study | Name | Registered type |
|---|---|---|
| 01 | Editorial Index | `mgStudy01` |
| 02 | Collector’s Edit | `mgStudy02` |
| 03 | Destination Dossier | `mgStudy03` |
| 04 | Inside the Atelier | `mgStudy04` |
| 05 | Private Gathering | `mgStudy05` |
| 06 | Reading Path | `mgStudy06` |
| 07 | The Lead & the Brief | `mgStudy07` |
| 08 | The Typographic Statement | `mgStudy08` |
| 09 | The Editor’s Letter | `mgStudy09` |
| 10 | The Double Exposure | `mgStudy10` |
| 11 | The Category Crossroads | `mgStudy11` |
| 12 | The Weekend Reading Room | `mgStudy12` |
| 13 | The Wardrobe Equation | `mgStudy13` |
| 14 | The Material Study | `mgStudy14` |
| 15 | The Object in Profile | `mgStudy15` |
| 16 | The Comparison Edit | `mgStudy16` |
| 17 | The Seasonal Lookbook | `mgStudy17` |
| 18 | The Daily Ritual | `mgStudy18` |
| 19 | The City Field Notes | `mgStudy19` |
| 20 | The Room with a View | `mgStudy20` |
| 21 | The Address Book | `mgStudy21` |
| 22 | The Long Way Home | `mgStudy22` |
| 23 | The Table Setting | `mgStudy23` |
| 24 | The Architectural Detail | `mgStudy24` |
| 25 | The Conversation Portrait | `mgStudy25` |
| 26 | The Culture Calendar | `mgStudy26` |
| 27 | The Screening Room | `mgStudy27` |
| 28 | The Reading Shelf | `mgStudy28` |
| 29 | The Creative Process | `mgStudy29` |
| 30 | The Photo Essay | `mgStudy30` |
| 31 | The Correspondence | `mgStudy31` |
| 32 | The Membership Invitation | `mgStudy32` |
| 33 | The Experience Triptych | `mgStudy33` |
| 34 | The Partnership Canvas | `mgStudy34` |
| 35 | The Manifesto Strip | `mgStudy35` |
| 36 | The Next Chapter | `mgStudy36` |

## Implementation and verification

- Descriptor: `starter/lib/blocks/sectionStudies.ts`.
- Validated, independently registered manifests: `starter/lib/blocks/manifests/sectionStudies.ts`.
- Renderer and scoped layouts: `starter/components/sections/SectionStudies.tsx` and its CSS module.
- Picker-only illustrative media: `starter/components/admin/builder/studyPreview.ts`.
- Unit coverage: all 36 labels, insertion, preview isolation, authored media/content,
  media-usage tracking, empty entries, safe links and real newsletter responses.
- Browser coverage: `starter/tests/e2e/sectionStudies.spec.ts`, strictly restricted
  to a local Supabase test stack. Creates/removes only its uniquely named fixture,
  checks all studies at 390px and 1440px in both themes for overflow and WCAG
  violations, and attaches representative screenshots for review.
- Existing section files, stored pages, theme tokens and public route assignments
  are unchanged. No database migration or production-content write is required.
- Generated boards are visual references, not pixel-exact executable specifications.
  Final image crops and composition fidelity require browser review with real content;
  unit passes alone do not certify visual equivalence.

## Additional mockups — not implemented or activated

Coming-soon variants are separately labeled CS01–CS20 so they cannot be confused
with section studies. No coming-soon page is activated by this change.

| IDs | Concepts |
|---|---|
| CS01–CS04 | The Masthead; Split Tailoring; Panoramic Arrival; Red Statement |
| CS05–CS08 | After Hours; Architectural Pause; A Letter to You; Objects of Interest |
| CS09–CS12 | The Quiet Frame; Black Tie; Column Culture; Red Margin |
| CS13–CS16 | Contact Sheet; Manifesto; The Window; Atelier Notes |
| CS17–CS20 | Horizon Line; Index of Intent; The Portrait; The Invitation |
| UI01–UI06 | Article Page; Search Modal; Mega-menu; Member Dashboard; Event Detail; Editorial Footer |


## Studio consolidation and coming-soon starters

New insertions now use **MG design studio**, then **Studio design** to choose
MG 01–36. **Preview design** mounts only the selected variant. Switching changes
only the variant, preserving authored fields and supporting Undo. Color treatment
can follow the design default or use a manual override. Legacy individual study
blocks remain editable and renderable, preserving saved pages and patterns.

For coming-soon pages, use **Pages → New page → Coming soon design**. For a reusable
frame, use **Templates → New template**, kind **page**, and select CS01–CS20.
Both paths create drafts. Customize the resulting Coming soon studio in the
builder; the template path also retains a Page content marker, so assigning it
never discards the page's own sections. Publish and assign using the existing
controls when ready. Creating a starter does not put the live homepage into a
maintenance mode and does not hide global header/footer navigation.

All 20 stable IDs and labels live in `starter/lib/blocks/comingSoon.ts`.
Signup is off by default. Enable it only when you want to use the site's existing
newsletter endpoint. No countdown, launch date, price, or generated photograph
is inserted by a starter. Preview-only bundled imagery does not enter drafts.
Photographic fidelity depends on selecting final media; the source boards are
raster concepts rather than standalone source photographs.

The media audit found 108 photographic occurrences across the 13 boards: 84
unobstructed, 24 with overlaid text or interface elements. `mockup-photo-crops.json`
records candidate extraction metadata, not approved crops or uploaded assets.
Native resolution is limited, and conservative overlay-free bounds sometimes
exclude substantial subject details. Exact cropping vs reconstruction is pending
owner direction; upload additionally needs website admin sign-in.
