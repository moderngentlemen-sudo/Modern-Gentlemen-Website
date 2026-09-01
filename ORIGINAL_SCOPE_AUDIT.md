# Original Scope Acceptance Audit

Audit date: 2026-08-30

This is the acceptance checklist for the original “production-grade
backend/admin platform” brief. It is deliberately stricter than a feature list:
database scaffolding is not counted as an implemented editor feature, and an
admin control is not counted unless the public renderer uses it.

Status meanings:

- **Complete** — connected UI, domain/service/data path and renderer or workflow
  exist, with automated coverage appropriate to the feature.
- **Partial** — a real usable slice exists, but at least one behavior named in
  the brief is missing.
- **Open** — not yet usable by the content team.

The builder-platform compatibility rule still governs this work: completing an
open item must not make any existing site design, element, responsive behavior
or function impossible to reproduce.

## Platform and architecture

| Requirement | Status | Evidence / remaining work |
|---|---|---|
| TypeScript-first modular architecture | Complete | Next.js App Router; pure `lib/domain`, repositories, services, server actions, adapters and React admin layers are enforced by the project architecture tests/rules. |
| Connected data model | Complete | Supabase migrations model auth/RBAC, documents, templates, patterns, media, editorial, commerce, ingestion, previews, revisions and audit events. |
| Architecture, entity, admin IA, builder, commerce, publishing and testing plans | Complete | `EXECUTION_PLAN.md`, `README.md`, migrations, `PROGRESS.md`, design handoff and builder-engine documents describe the implemented architecture and its decisions. |
| Auth and role-aware permissions | Complete | Supabase auth, middleware, service permission gates, RLS, role-aware navigation, password recovery and adversarial RLS integration coverage. |
| Cohesive admin shell | Complete | Pages, articles, taxonomy, products, integrations, media, navigation, theme, patterns and templates share one permission-aware shell and UI system. |

## Visual builder and reusable design

| Requirement | Status | Evidence / remaining work |
|---|---|---|
| Home and landing-page builder | Complete | Section/component tree, canvas, manifests, autosave, preview and publishing are connected to page documents. |
| Article and product builder | Complete | Both document types open in the shared builder; a published assignment opts the public detail route into the composed builder tree while an unassigned record retains its fixed compatibility composition. |
| Category/archive builder | Complete | Category documents and archive templates frame the public category routes. |
| Shop/archive templates | Complete | Archive templates may target every category, one category, or the singleton `/shop` archive; the shop frame preserves its static client-filtering path. |
| Header/footer/global-part builder | Complete | Published header/footer assignments render site-wide template trees around the existing data-driven chrome marker. The marker may be hidden inside a parent when a fully custom block composition replaces the compatibility chrome. |
| Drag, reorder, duplicate, delete and nested blocks | Complete | DnD library insertion, tree moves, Container, Stack, Columns and Navigator are implemented and covered in component/E2E tests. |
| Hide and responsive visibility | Complete | Global hide and desktop/tablet/mobile targeting now affect the canvas and public renderer, with strict publish validation. |
| Locked global elements | Complete | Locked blocks cannot be edited, moved, duplicated or deleted until unlocked. |
| Reusable sections/patterns | Complete | Detachable and synced patterns, categories, insertion, reference expansion, detach behavior, publishing and E2E coverage. |
| Save current selection as a new pattern | Open | Patterns can be created and composed in their own editor, but the page canvas cannot yet turn a selected subtree into a pattern in one action. |
| Native low-level elements | Complete | Heading, Text, Image, Video, Embed, Icon, Product, Form, Button, Divider and responsive Spacer are available alongside every legacy section. Product resolves the live catalogue and shared bag; Form captures configurable bounded fields through an RLS-protected public path. |
| Responsive visual styling | Complete | Per-device layout, grid/flex, sizing, spacing, surface, border, corner, shadow, opacity, overflow, hover and motion controls use the shared visual renderer. |
| Direct manipulation | Complete | Canvas/Navigator multi-select, group operations, drag/drop, direct resize with optional 5% grid snapping and smart canvas/peer alignment, persistent and Space-key hand panning, rulers, 50–150% zoom, exact responsive dimensions and bounded positioning work. All viewport aids remain editor-only. |
| Shared classes/design tokens/symbol states | Partial | Global theme roles, reusable patterns and published responsive style classes with local overrides exist; component states and shared local token aliases remain. |

## Templates, binding and preview

| Requirement | Status | Evidence / remaining work |
|---|---|---|
| Template kinds: page/article/product/archive/header/footer/section | Complete | All kinds are modeled, editable, publishable and revisioned. |
| Named template areas | Complete | Create, rename, switch, validate, preview and delete area workflows are covered end to end. |
| Template assignment | Complete | Page, category, article, product, shop, header and footer targets are assignable, publicly consumed and revalidated; entry assignments override content-type defaults. |
| Dynamic data binding | Partial | Field selection, filtering, sorting, limit/offset, mapping, plucking and real DB sources work. Explicit runtime fallback values and conditional expressions remain. |
| Local template overrides | Partial | Document sections and the `documentContent` marker allow local content composition for framed types; a formal per-field override/inheritance UI remains. |
| Live unsaved canvas preview | Complete | The canvas renders real production components from the in-memory undoable tree at desktop/tablet/mobile widths. |
| Signed draft previews | Complete | Expiring preview sessions resolve draft content separately from public published reads. |
| Preview all page/article/product/template instances | Partial | Shared preview actions exist for all builder documents; contextual switching between several records inside one editor session remains. |
| Safe preview routing | Complete | Tokenized preview sessions and separated anonymous published reads are tested at the database and route layers. |

## Theme, header and footer design

| Requirement | Status | Evidence / remaining work |
|---|---|---|
| Colors, fonts and webfonts | Complete | Context-aware color tokens, five font roles, curated stacks and bounded provider/direct-file webfonts are editable and published. |
| Layout widths and gutters | Complete | Global content width and desktop/mobile gutters cascade through shared CSS variables. |
| Global spacing, borders, shadows, buttons, cards and forms | Partial | Reusable classes now provide named global responsive spacing/border/shadow recipes; semantic button/card/form component defaults remain. |
| Animation presets | Partial | Element hover/motion and advanced header behavior exist; a reusable global animation library with entrance/scroll states remains. |
| Header customization | Partial | Height, scale, scroll/background behavior, compact state, divider, search/theme/bag visibility, icon bubbles and hover styles work. Announcement bars, arbitrary element layout, account/social/CTA controls and the remaining Claude presets remain. |
| Footer customization | Partial | Menus are data-driven, but tagline, social destinations and arbitrary footer composition remain fixed in the component. |
| Site-wide cascading defaults with local overrides | Partial | Published reusable classes now cascade between theme variables and higher-specificity per-element overrides; semantic component-default inheritance remains. |

## Editorial CMS and media

| Requirement | Status | Evidence / remaining work |
|---|---|---|
| Articles, categories, tags and authors | Complete | CRUD/editor flows, relationships, routing and permission gates are implemented. |
| SEO, slugs, schedules and publish dates | Complete | SEO payloads, routing, scheduled publishing and background due-publish workflow are connected. |
| Related-content curation | Complete | Ordered manual “Keep reading” selection with automatic fallback and integration/E2E coverage. |
| Twenty modern article layouts | Complete | The original 20 hero/body combinations remain renderable and selectable. |
| Rich editorial body editor | Complete | Article builder text and interview answers use the manifest-driven rich-text control: bold, italic, links, headings, quotes, lists and live preview render through the same safe semantic renderer. Existing string content is backward-compatible. |
| Featured image | Complete | Media foreign key, picker, public use and usage protection are connected. |
| Featured video, GIF, embeds and galleries | Complete | Article details offers one versioned workflow for cover/poster images, GIF, library/direct video, safe YouTube/Vimeo embeds and ordered galleries; the fixed public route renders every mode and asset-backed choices participate in usage protection. |
| Media upload, search, type filters and folders | Complete | Images, video, GIF, audio and PDF documents are catalogued in Supabase Storage with search and nested folder filtering. |
| Media tags | Partial | Tables and policies exist; tag creation, assignment and filtering are not exposed in the media UI. |
| Media metadata and reusable picker | Complete | Title, alt, caption, credit, focal point, folders and media pickers are wired to builder/article/product consumers. |
| Media usage tracking | Complete | Block-tree and product-gallery references prevent destructive deletion and show consumers. |
| Production media processing | Partial | Storage, checksums, deduplication, responsive image transformation and budgets exist; video transcoding/poster generation and background processing remain. |

## Commerce and integrations

| Requirement | Status | Evidence / remaining work |
|---|---|---|
| Native/direct products | Complete | Metadata, SKU, status, pence pricing, compare-at validation, inventory, availability, variants, collections, badges, specs and galleries. |
| Affiliate products | Complete | Merchant link/name, disclosure, external display price, availability and media share the product model and public catalogue. |
| Mixed editorial/commerce rendering | Complete | Product rows, public catalogue/PDP, bindings and article commerce components use the same published data. |
| XML field mapping and manual sync | Complete | Configurable mappings, validation, fetch/parse adapters and manual jobs are connected. |
| XML dedupe, change detection, source tracking and approval | Complete | Staged import items record source identity/action/diffs and require review/apply workflows. |
| Scheduled XML sync | Complete | Source schedules and signed background job routing are implemented. |
| XML error reporting | Complete | Job/item status, errors and review screens expose failures without publishing partial data. |
| Shopify abstraction and product/inventory/status sync | Complete | Shopify is a `SourceAdapter` behind the same ingestion pipeline, with paginated transforms and hybrid local/source products. |
| Shopify collection sync | Partial | Local collections exist, but Shopify collections are not yet imported and mapped as a first-class sync stream. |
| Live Shopify credential verification/E2E | Partial | Config validation and adapter/unit coverage exist; CI deliberately does not call a real merchant store. Production connection requires merchant credentials. |

## Navigation, revisions and publishing

| Requirement | Status | Evidence / remaining work |
|---|---|---|
| Nested menus and dynamic/external links | Complete | Menu tree editing, nested entries, page/category/product/external targets and public header/footer reads are connected. |
| Header/footer menu assignment | Complete | Named menu records are resolved by the public chrome. |
| Conditional navigation visibility | Open | Menu entries do not yet have audience/device/date conditions. |
| Draft/published states and validation | Complete | Strict block/content schemas gate atomic publishing; anonymous reads see published data only. |
| Revision history and rollback | Complete | Immutable revisions, publish events, history views and atomic rollback are implemented across document types. |
| Named snapshots | Complete | Snapshot labels and reasons are stored and exposed by the shared publish bar/history. |
| Compare revisions | Complete | Structured block diffs are shown where practical in revision history. |
| Duplicate pages/templates/layouts | Open | Block duplication exists, but document-list clone actions are not implemented. |
| Saved layouts | Complete | Templates and detachable/synced patterns provide saved compositions. |

## Admin UX and testing

| Requirement | Status | Evidence / remaining work |
|---|---|---|
| Left navigation, canvas, properties and hierarchy | Complete | Permission-aware shell plus Add/Navigator, canvas and manifest-driven right panel. |
| Undo/redo and autosave | Complete | Bounded coalescing history and server autosave cover tree edits and template areas. |
| Publish/validation flow | Complete | Issues focus the offending block/area; snapshots, preview, publish and history share one bar. |
| Search/command palette | Partial | Module lists, media and insert libraries are searchable; a global keyboard command palette remains open. |
| Fast editing without full reloads | Complete | Client stores and server actions update focused surfaces; editing does not reload on each field change. |
| Component/unit test pyramid base | Complete | Domain rules, manifests, stores, controls, media, commerce and renderer components have extensive Vitest coverage. |
| Integration coverage | Complete | RLS, migrations, publishing, previews, public reads, bindings, media relations and schedules run against local Supabase in CI. |
| Critical E2E workflows | Partial | Auth, pages, DnD/nesting, patterns, templates, articles, products, media, navigation, theme and integration configuration are covered. Explicit featured-video creation, device-visibility publishing, a real Shopify sync and revision restore deserve dedicated E2E scenarios. |
| Visual, accessibility and performance regression | Complete | Public baselines, axe coverage and performance budgets run in the browser CI job. |
| CI on changes | Complete | Formatting, lint, environment declarations, typecheck, unit, integration, build, E2E, visual, accessibility and performance gates run in GitHub Actions. |

## Ordered completion backlog

1. Complete semantic global defaults for buttons, cards and forms, plus entrance
   and scroll animation states. Reusable responsive style classes are complete.
2. Add one-click “save selection as pattern,” document duplication and the
   global command palette.
3. Expose media tagging and conditional navigation rules.
4. Add Shopify collection mapping and the remaining explicit E2E acceptance
   scenarios.

This backlog is additive. Existing high-fidelity sections and the fixed article
template library remain supported until migration fixtures and visual proof
show that the newer primitives reproduce them.
