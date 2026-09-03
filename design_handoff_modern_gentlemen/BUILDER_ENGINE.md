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

Existing block drags now expose the same valid insertion gaps as library drags.
An editor can move a block to an exact position inside a non-empty container;
slot allow-lists and horizontal layout declarations still suppress invalid
gaps, and a dragged container's own branch is excluded so a cycle cannot be
created. The operation continues through the path-aware `moveInto` action, so
undo, validation and autosave retain the same guarantees as every other tree
edit.

## Claude Design tweak migration

The supplied tweak transcript is treated as a requirements inventory. Its
chosen values describe the current design baseline; alternatives become
optional presets only after their rendering behavior exists.

| Tweak family                                                                        | Engine destination                 | State                                                                    |
| ----------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| Header height, visibility, background, search, theme and bag visibility             | Theme → Header                     | Working                                                                  |
| Header scale, shrink-on-scroll, shrunk height, divider, icon bubbles and icon hover | Theme → Header                     | Working; original choices are defaults                                   |
| Global spacing, width, backgrounds, corners, borders, shadows and opacity           | Builder → Visual layout/appearance | Working per breakpoint                                                   |
| Flex/grid arrangement, gaps, alignment and responsive stacking                      | Builder → Visual layout            | Working per breakpoint                                                   |
| Hover, motion and viewport entrance treatment                                       | Builder → Visual appearance        | Working locally and through reusable classes                             |
| Site fonts and provider/direct-file webfonts                                        | Theme → Typography/Webfonts        | Working                                                                  |
| Hero size, media, mobile composition and alignment                                  | Hero component manifests           | Existing media/height controls; detailed preset migration next           |
| Homepage, Latest and Style compositions                                             | Component variants and patterns    | Existing canonical variants remain; transcript presets next              |
| Burger geometry/hover, nav/dropdown/drawer motion                                   | Theme → Header/Navigation advanced | Catalogued; requires each named renderer preset                          |
| Sidebar logo/tagline/bubbles, footer tagline                                        | Theme → Navigation/Footer          | Catalogued                                                               |
| Bag drawer/dropdown/full-page behavior                                              | Theme → Commerce chrome            | Catalogued; drawer is current baseline                                   |
| Article template, score, verdict and hero media                                     | Article/template editor            | Existing template/content model; detailed preset migration next          |
| Category width and shop width                                                       | Template area + visual max-width   | General width control works; named convenience presets next              |
| Dark mode, overlay mode and sharp-corner baseline                                   | Theme tokens + visual appearance   | Existing theme and per-element controls; global convenience toggles next |

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

## Reusable viewport animation (v1.4)

Builder payload v3 and theme payload v9 extend the existing bounded `effects`
vocabulary with Fade, Rise, Slide left, Slide right and Scale entrances,
one-time or repeating viewport activation, and five sequencing delays. The
same fields live in a local element or in a reusable style class, so a global
animation recipe remains one published definition while local effects can
override it with the visual engine's existing selector cascade.

One document-level observer reads safe CSS custom properties emitted by those
recipes. It handles the initial page, elements inserted later and an existing
canvas element whose styling changes. A revealed element settles after its
delay and duration so hover transitions do not inherit a stale entrance delay.
The server never hides content: no JavaScript, no Intersection Observer and
reduced-motion preferences all fail open to visible content, and reduced motion
retains any authored opacity while removing reveal transforms and transitions.
No database migration is required; both additions are optional on read.

## Query-aware editorial feed (v1.5)

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

## Header compositions (v1.7)

Theme → Header exposes Balanced, Centered Logo and Navigation Left. Balanced is
the compatibility composition. Centered Logo partitions the existing primary
menu around the brand; Navigation Left keeps one menu beside the brand. All
three reuse the same menu tree, mega-menu state, mobile drawer and action
cluster, so switching composition cannot orphan navigation functionality.

The header CTA is an optional label/destination pair. Internal paths and HTTPS
URLs are accepted; unsafe stored schemes are ignored at the public read
boundary and rejected by the admin write schema. Composition remains
independent from initial/compact height, smart scrolling, background and icon
controls. Version-7 payloads read as Balanced without a data migration.

## Entry template overrides (v2.0)

Page and article editing surfaces expose the assignment hierarchy at the point
where an editor works on the record. Each record may explicitly inherit its
content-type template or choose one published template of the matching kind.
The inheritance option names the current live default without copying its id
into an entry assignment, so a later site-wide change still reaches inheriting
records. Entry assignments continue to outrank content-type assignments.

Draft templates remain visible when already selected so stored state is never
silently discarded, but cannot be newly saved as a live override. The service
rechecks the entry, the template kind, publication state and permissions rather
than trusting the picker. Removing an override clears only that entry target;
it never unassigns the chosen template from other records.

## Typed binding conditions (v1.9)

Dynamic fields retain the original strict-equality `filter` map permanently,
then add an optional bounded `where` expression. Up to eight typed conditions
may match all or any of their members. Text supports equality, containment and
prefix/suffix checks; numbers support equality and ordered comparisons; every
field supports presence checks. The editor derives its operators and value
control from the source field vocabulary, so a boolean never becomes the string
`"true"` and a numeric comparison cannot be authored against text.

The demo and Supabase sources share one evaluator. Existing filters are ANDed
with a new expression, old payloads therefore keep their exact meaning, and a
query with no `where` key follows the same path as before. Conditions are a
closed schema with a maximum size; no stored JavaScript, SQL fragment or raw
expression language reaches the renderer.

## Footer controls (v2.1)

Theme payload v10 moves the compatibility footer's composition and optional
content behind renderer-backed controls. Responsive columns reproduce the
existing desktop/mobile behavior exactly; Always stacked and Centered stack add
bounded alternatives. Editors may show or hide the tagline and social row,
change their copy, and configure each existing social mark with an HTTPS URL or
an empty value that hides only that destination.

Footer navigation and legal links deliberately remain menu-managed. Published
footer templates remain the higher-level composition tool and may frame or hide
the compatibility marker, so these theme controls add convenient chrome
variation without narrowing the arbitrary template path. Older payloads acquire
the verified original footer defaults field by field and require no migration.

## Next engine layers

1. Continue screenshot-level responsive comparison for numbered Section Library presets as designs evolve, without changing their content contracts.
2. Add editor-named responsive breakpoints if the owner chooses to replace the current stable desktop/tablet/mobile contract.
3. Continue the transcript and Schematic extraction with deeper navigation
   surfaces and footer composition in small renderer-backed groups.
4. Add migration fixtures and visual baselines for every current page before a
   native primitive is allowed to replace an existing component.

## Shared tokens, field inheritance and component states (v2.2)

Theme payload v12 adds up to 24 stable-id color tokens, each with light and dark
values validated by the same CSS-color boundary as the core theme. A local
element or reusable class may reference one by id for its background or text;
the renderer emits only `var(--mg-token-<safe-id>)`, never authored CSS.

The visual model also accepts bounded hover, focus-within and active appearance
states. These reuse the existing background, color, border, radius, shadow and
opacity vocabularies and work both locally and through reusable classes. The
older transform-based hover presets remain compatible.

Manifest defaults are now visible inheritance rather than invisible renderer
behavior: an unset field displays its effective component default, and an
explicit value can be cleared back to that default even when the field is
required. Clearing removes the stored key; it does not copy the current default,
so future component-default changes continue to cascade.

## Contextual template previews (v2.3)

Template builders may preview a compatible published page, category, article or
product at the `documentContent` marker. The selected record id and type live in
the existing preview capability's context JSON. `resolve_preview` returns that
context alongside exactly one authorized draft, while the record itself is read
through the anonymous published-content path. Old tokens and automatic
assignment-based stand-ins continue to work with an empty context.

## Numbered Hero Studio (v1.8)

The standalone Modern Gentlemen Section Library is now governed by a complete
125-entry imported-source inventory rather than the former partial 1–28 map.
The same ledger also records 20 additive platform presets from the product
brief. Every source composition has a stable number and target builder family;
the provenance-aware Native/Platform status prevents brief-derived modules from
being mistaken for source-file imports.

`heroStudio` covers 01 and every hero from 69–125, including Vogue 6A–6J,
through shared cover, masthead, split, collage, film, ranking, ticker and
editorial archetypes. `sectionStudio` covers every remaining composition,
imported 02–68 and platform 126–145, through shared card, list, feature, people,
data, commerce, media and utility archetypes. Editors can change content,
media, actions, hierarchy, responsive layout and color treatment without
breaking a preset's numbered identity. Both renderers are additive: every
original hero and section remains registered, so this migration does not narrow
what the existing site can reproduce.
