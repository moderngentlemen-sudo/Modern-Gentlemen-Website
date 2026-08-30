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
- width, maximum width, minimum height, gap, padding and margins;
- bounded theme backgrounds and text colors, borders, corner styles, shadows,
  opacity and overflow;
- hover and motion presets; and
- a private Navigator name.

Uncustomized components receive no additional DOM wrapper. Values are selected
from closed vocabularies rather than injected as raw CSS.

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

1. Promote text, image, link/button and divider into native selectable child
   elements while retaining component-level editing.
2. Add an element insertion palette and direct manipulation for nesting,
   sizing and reordering inside Container/Stack/Grid.
3. Add class/style tokens, reusable symbols, component states and named
   responsive breakpoints without permitting arbitrary stored CSS.
4. Implement the transcript's named hero, header, navigation, Latest, Style
   and article presets in small renderer-backed groups.
5. Add migration fixtures and visual baselines for every current page before a
   native primitive is allowed to replace an existing component.
