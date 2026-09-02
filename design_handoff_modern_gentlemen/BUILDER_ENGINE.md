# Modern Gentlemen Builder Engine

## Governing contract

The builder may become substantially more capable, but a new engine is only a
valid replacement when every current component, page composition, responsive
state, interaction and commerce/editorial function can be reproduced. Existing
sections are first-class engine components, not temporary content to discard.

Controls must affect the public renderer and the canvas before they appear in
the admin. A stored no-op toggle is not an implemented feature.

## Engine v1

Engine v1 normalizes the existing block tree into a component graph with stable
element ids, explicit children, component settings and a universal visual
layer. The adapter round-trips old flat props and all structural metadata, so a
page can enter and leave the engine without losing information.

Every component element can now carry:

- desktop, tablet and mobile overrides (larger screens cascade into smaller
  screens until overridden);
- block, flex and grid layout, direction, 1–6 columns, alignment and
  distribution;
- preset or exact percentage/pixel width, exact height/minimum/maximum sizing,
  gap, padding and margins;
- bounded relative, absolute and sticky positioning, offsets and stack order;
- bounded theme backgrounds and text colors, borders, corner styles, shadows,
  opacity and overflow;
- hover and motion presets; and
- a private Navigator name.

Visibility is renderer-backed rather than metadata-only. A component may be
hidden everywhere or limited to desktop, tablet and/or mobile. The public
renderer removes globally hidden content, emits bounded media-query CSS for
device targeting, and uses `display: contents` so visibility does not disturb
an existing flex or grid composition. The canvas keeps excluded content
selectable and visibly dims it while previewing that device.

The native element set is also live: Heading, Text, Image, Video, Embed, Icon,
Product, Form, Button, Divider and Spacer. They are ordinary registered blocks with manifests, strict
settings and responsive behavior, so they can be composed with Container,
Stack, Columns and every existing high-fidelity section. They extend the
component library; they do not replace or weaken compatibility with the legacy
sections.

Published template assignments now reach every public composition they model.
Page and category trees continue to splice structurally; article and product
assignments opt their detail routes into the document's builder tree; the shop,
header and footer use runtime marker insertion so the existing client store,
menus, search, bag and theme controls remain reproducible. With no published
assignment, each route follows its original fixed path byte-for-byte.

Uncustomized components receive no additional DOM wrapper. Values are selected
from closed vocabularies rather than injected as raw CSS.

The canvas and Navigator now share ordered multi-selection. Modifier selection,
group duplicate/delete/style changes and a direct width handle all write through
the same undoable store and bounded visual model used by the properties panel.
Selecting a container and one of its descendants never duplicates or deletes
the descendant twice, and locked elements remain protected.

The canvas viewport supplies bounded zoom, optional rulers, toggleable
five-percent snapping, a persistent Hand tool and temporary Space-key panning.
Direct resizing snaps within six screen pixels of the canvas or a peer's left,
centre or right geometry and draws the matching live alignment guide. Nested
ancestors and descendants are excluded from peer candidates so a container does
not snap to itself. These controls are editing aids only: they do not dirty a
document, enter undo history or serialize into its payload.

## Claude Design tweak migration

The supplied tweak transcript is treated as a requirements inventory. Its
chosen values describe the current design baseline; alternatives become
optional presets only after their rendering behavior exists.

| Tweak family | Engine destination | State |
|---|---|---|
| Header height, visibility, background, search, theme and bag visibility | Theme → Header | Working |
| Header scale, shrink-on-scroll, shrunk height, divider, icon bubbles and icon hover | Theme → Header | Working; original choices are defaults |
| Global spacing, width, backgrounds, corners, borders, shadows and opacity | Builder → Visual layout/appearance | Working per breakpoint |
| Flex/grid arrangement, gaps, alignment and responsive stacking | Builder → Visual layout | Working per breakpoint |
| Hover/motion treatment | Builder → Visual appearance | Working |
| Site fonts and provider/direct-file webfonts | Theme → Typography/Webfonts | Working |
| Hero size, media, mobile composition and alignment | Hero component manifests | Existing media/height controls; detailed preset migration next |
| Homepage, Latest and Style compositions | Component variants and patterns | Existing canonical variants remain; transcript presets next |
| Burger geometry/hover, nav/dropdown/drawer motion | Theme → Header/Navigation advanced | Catalogued; requires each named renderer preset |
| Sidebar logo/tagline/bubbles, footer tagline | Theme → Navigation/Footer | Catalogued |
| Bag drawer/dropdown/full-page behavior | Theme → Commerce chrome | Catalogued; drawer is current baseline |
| Article template, score, verdict and hero media | Article/template editor | Existing template/content model; detailed preset migration next |
| Category width and shop width | Template area + visual max-width | General width control works; named convenience presets next |
| Dark mode, overlay mode and sharp-corner baseline | Theme tokens + visual appearance | Existing theme and per-element controls; global convenience toggles next |

“Catalogued” means the source requirement is retained here, not that a control
has been exposed. This distinction prevents an editor from offering choices the
public site silently ignores.

## Reusable global style classes (v1.2)

Theme payload v6 adds `styleClasses`, a bounded library of named visual recipes.
Each class has a stable lowercase id plus the same responsive `styles` and
interaction `effects` vocabulary used by an individual builder element. Class
definitions cannot contain arbitrary CSS, another class reference or an
element-only Navigator name.

Publishing the theme emits selectors such as
`[data-mg-style~="feature-card"]`. A builder element stores only that safe id at
`visual.styleClass`; its existing local responsive values remain separate. The
local selector repeats its scoped data attribute so it always outranks the
global class, independent of stylesheet insertion order. This creates a clear
cascade:

1. built-in component composition and global theme variables;
2. the published reusable style class;
3. the element's local responsive overrides.

There is no migration. Payloads from theme v1-v5 parse with an empty class
library, unstyled legacy blocks still return their child directly, and a
class-only block gets one wrapper but no redundant local `<style>` element.

## Semantic component defaults (v1.3)

Theme payload v7 adds a bounded semantic layer for public buttons, cards and
form fields. Shared renderers opt in through additive `mg-button`, `mg-card`,
`mg-card-media` and `mg-form-field` hooks; publishing emits their shape, case,
border, fill, focus, shadow and interaction rules from closed vocabularies.
Reduced-motion preferences disable transforms and transitions.

The original sharp button/card/field geometry, uppercase buttons, hairline
card/field borders, transparent field fill and product-card image zoom are the
defaults. Older payloads acquire those values field by field, so this layer is
design-preserving until an operator changes and publishes it. The cascade is:

1. global theme variables and semantic component defaults;
2. a published reusable style class;
3. local responsive element overrides.

No database migration is required because the versioned settings live in the
existing theme JSONB document.

## Query-aware editorial feed (v1.4)

The first Schematic theme extraction is a native `editorialFeed` block. It does
not copy the theme's PHP or depend on Canvas/Powerkit: its `items` field uses the
builder's existing `$bind` contract and the published Supabase article source.
Editors can therefore combine category, issue and lead filters with sort,
limit and offset, or switch back to a literal ordered card list.

One component and one manifest reproduce the eleven discovered Posts renderer
families: Horizontal 1–5, Standard 1–4 and Tile 1–2. Layout is independent from
content and exposes image, tag, excerpt, author and reading-time visibility,
six image ratios, three card treatments, three title scales and an optional
view-all action. Existing editorial sections remain registered unchanged; the
new feed is an additive high-flexibility option rather than a migration.

### Archive and responsive controls (v1.5)

The feed can behave as a complete archive: show all stories, paginate with
accessible numbered controls, progressively reveal fixed batches, or use an
Intersection Observer for infinite reveal while retaining a keyboard-operable
manual fallback. Batch size, pager labels, fallback copy and the empty state
are all authored in the manifest. A view-all link remains a separate action.

Layout settings independently override mobile, tablet and desktop columns,
row and column gaps, horizontal image width and placement, optional separators
and per-card read-more copy. Preset values preserve every original composition;
an editor can always return each override to “Use layout preset.”

## Article presentation overrides (v1.6)

Article Details keeps the twenty existing hero/body templates as the default,
then adds a document-level presentation layer. An editor may choose Standard,
Large, Large Media, Full Bleed, Title Only or None without changing the body
template, and may independently choose the template, compact or large title
scale. “Use template” is the explicit compatibility setting.

These settings live in `hero.presentation` beside featured media in the
existing versioned article payload. Merge helpers preserve every unrelated
hero field and the builder section tree. The public reader uses only published
data, so saving a draft presentation cannot leak it to the live article.

## Next engine layers

1. Add reusable symbols, component states and named responsive breakpoints
   without permitting arbitrary stored CSS.
2. Continue the transcript and Schematic extraction with header/navigation
   presets and footer composition in small renderer-backed groups.
3. Add migration fixtures and visual baselines for every current page before a
   native primitive is allowed to replace an existing component.
