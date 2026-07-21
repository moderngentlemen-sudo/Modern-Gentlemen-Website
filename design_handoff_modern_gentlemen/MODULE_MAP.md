# MODULE_MAP — Section Library → React blocks

Maps every module in `design_files/Modern Gentlemen Section Library.dc.html` to a block component in `starter/components/sections/` (+ its Sanity schema). The library groups modules as: **1–68** section blocks, **69–115** hero treatments, **116–125** full-fidelity "Vogue" editorial heroes.

The strategy (see `05_SECTION_BUILDER.md`) is **one component per structural archetype, variants via props** — not 125 separate components. 13 block types are built; the rest map onto them by variant. Build the remaining `TODO` archetypes the same way as you need them.

## Built blocks
| Library # (name) | Block `_type` | Notes / variant |
|---|---|---|
| 01 Editorial Split Hero | `heroCoverStar` / `featureSplit` | Hero = heroCoverStar; inline = featureSplit `variant:"imageRight"` |
| 02 Category Rail | `twoUpCategory` | 2-up; extend to N-up if needed |
| 03 The Index (numbered list) | `numberedIndex` | — |
| 04 Long-Read Feature | `featureSplit` | `variant:"overlap"` |
| 05 The Store (commerce row) | `productRow` | `group` or curated `slugs` |
| 06 Contributor Spotlight | `testimonials` | single-quote variant |
| 07 Manifesto Pull-Quote | `storyBand` | full-bleed quote |
| 08 By the Numbers | `statsBand` | — |
| 09 The Archive | `latestGrid` | `variant:"mosaic"` |
| 10 Social Gallery | `latestGrid` | `variant:"mosaic"`, square tiles — TODO dedicated `socialGallery` if lightbox needed |
| 11 The Debate | `interview` | two-voice framing |
| 12 The Field Guide | `numberedIndex` | with meta column |
| 13 Spec Comparison | TODO `specTable` | 2–3 column spec grid |
| 14 Dispatch Banner | `newsletter` | — |
| 15 The Interview | `interview` | — |
| 16 A Brief History (timeline) | `timeline` | — |
| 17 Letter from the Editor | `interview` | single long entry, or `storyBand` |
| 18 Member Voices | `testimonials` | — |
| 19 The Briefing | `numberedIndex` | — |
| 20 Featured Series | `latestGrid` | `variant:"threeCol"` |
| 21 Start Here | `numberedIndex` | — |
| 22 Current Issue | `featureSplit` | cover image + TOC |
| 23 Membership Tiers | TODO `membershipTiers` | reuse the /membership page tier cards |
| 24 The Calendar | `timeline` | date-led entries |
| 25 Destinations | `latestGrid` | image cards |
| 26 Editors' Desk | `testimonials` | contributor cards |
| 27 Cover Takeover | `heroCoverStar` | `mobileHeight:"fullscreen"` |
| 28 The Drop | `productRow` | curated `slugs` |

## Remaining ranges (same recipe)
- **29–68** — further section variants. Each is a restyle of one archetype above; map it to the nearest block + a new `variant` value rather than a new component. Add the enum value to that block's schema when you use it.
- **69–115** — hero treatments → all fold into `heroCoverStar` with layout props (add `variant` as they diverge). The 10 hand-built showcase heroes **116–125** ("Vogue") are the exception: port those at full fidelity as dedicated components (`heroVogue01`…) since they're the marquee pieces.

## How to add one
1. Open the module in the Section Library file; identify its archetype.
2. If an existing block covers it → add a `variant` value (component + schema `options.list`).
3. If genuinely new → new component in `components/sections/`, register in `registry.ts`, add schema in `sanity/schemas/blocks/`, wire into `schemas/index.ts` `blockTypes`, add a row here.
