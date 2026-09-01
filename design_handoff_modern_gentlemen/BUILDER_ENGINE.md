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

## Next engine layers

1. Add class/style tokens, reusable symbols, component states and named
   responsive breakpoints without permitting arbitrary stored CSS.
2. Implement the transcript's named hero, header, navigation, Latest, Style
   and article presets in small renderer-backed groups.
3. Add migration fixtures and visual baselines for every current page before a
   native primitive is allowed to replace an existing component.
