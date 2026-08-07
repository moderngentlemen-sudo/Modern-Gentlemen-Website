/**
 * The site's navigation, as Track A hard-coded it — now the seed source.
 *
 * Lifted verbatim out of `components/chrome/Header.tsx` (`NAV`),
 * `MegaMenu.tsx` (`MENUS`), `Drawer.tsx` (`GROUPS` and `SECONDARY`) and
 * `Footer.tsx` (`NAV` and `LEGAL`). Like every other module in `lib/demo/`, this
 * is **seed input and a test fixture, not runtime data**: `scripts/seed.ts`
 * writes it into `menus`/`menu_items`, and
 * `tests/integration/publicNavigation.test.ts` compares what the database gives
 * back against it. Editing this file changes what a fresh database is seeded
 * with; it does not change what the live site renders.
 *
 * Four menus, because the chrome has four link lists and leaving two of them in
 * the components would make "navigation is editable" half-true in a way the next
 * session would have to discover.
 *
 * **Labels are stored in title case.** The header renders them uppercase, and
 * did so with literal `"STYLE"` strings; the drawer shows `"Style"`. One tree
 * cannot hold both, so the label is the editor's form and the header applies
 * `uppercase` in CSS — which is what the footer's nav already did. The
 * transform emits identical glyphs, and the 16 visual baselines are the proof.
 */

import type { MenuFeature } from "@/lib/domain/navigation";

/** A menu entry, described by what it points at rather than by a frozen path —
 *  the seeder resolves a slug to the id `menu_items.target_id` holds. */
export type DemoMenuLink =
  | { type: "category"; slug: string }
  | { type: "page"; slug: string }
  | { type: "article"; slug: string }
  | { type: "product"; slug: string }
  | { type: "url"; url: string };

export interface DemoMenuItem {
  label: string;
  link: DemoMenuLink;
  /** The mega-menu column this child sits under. Top-level items have none. */
  group?: string;
  /** The mega-menu's promoted card. Top-level items only. */
  feature?: MenuFeature;
  children?: DemoMenuItem[];
}

export interface DemoMenu {
  key: string;
  name: string;
  location: string;
  items: DemoMenuItem[];
}

const category = (slug: string): DemoMenuLink => ({ type: "category", slug });
const url = (path: string): DemoMenuLink => ({ type: "url", url: path });

/**
 * `header-primary` — the whole of the desktop chrome.
 *
 * Top level is the header's nav bar. Children are the mega-menu, grouped into
 * its two columns by `group`, and the drawer renders those same children
 * flattened in order. The sub-links all resolve to their parent category: they
 * are subcategory labels in the design, and none of them has a landing page of
 * its own. That is faithful to the prototypes, not an omission.
 */
const headerPrimary: DemoMenu = {
  key: "header-primary",
  name: "Header — primary",
  location: "header-primary",
  items: [
    {
      label: "Style",
      link: category("style"),
      feature: {
        tag: "STYLE · 041",
        title: "Racing Green Is the New Navy",
        image: "/images/style-mono.jpg",
        href: "/style",
      },
      children: [
        { label: "Tailoring", link: category("style"), group: "Categories" },
        { label: "Casualwear", link: category("style"), group: "Categories" },
        { label: "Footwear", link: category("style"), group: "Categories" },
        { label: "Accessories", link: category("style"), group: "Categories" },
        { label: "The Capsule Wardrobe", link: category("style"), group: "Guides" },
        { label: "Fabric & Cloth", link: category("style"), group: "Guides" },
        { label: "Seasonal Edits", link: category("style"), group: "Guides" },
      ],
    },
    {
      label: "Grooming",
      link: category("grooming"),
      feature: {
        tag: "GROOMING · 039",
        title: "The Case Against 12-Step Routines",
        image: "/images/grooming.jpg",
        href: "/grooming",
      },
      children: [
        { label: "Skincare", link: category("grooming"), group: "Categories" },
        { label: "Fragrance", link: category("grooming"), group: "Categories" },
        { label: "Hair", link: category("grooming"), group: "Categories" },
        { label: "Shaving", link: category("grooming"), group: "Categories" },
        { label: "The Seven-Minute Standard", link: category("grooming"), group: "Routines" },
        { label: "The Travel Kit", link: category("grooming"), group: "Routines" },
        { label: "Evening Reset", link: category("grooming"), group: "Routines" },
      ],
    },
    {
      label: "Watches",
      link: category("watches"),
      feature: {
        tag: "WATCHES · 040",
        title: "Chronographs Born on the Grid",
        image: "/images/watch-gear.jpg",
        href: "/watches",
      },
      children: [
        { label: "Chronographs", link: category("watches"), group: "Categories" },
        { label: "Dress Watches", link: category("watches"), group: "Categories" },
        { label: "Dive Watches", link: category("watches"), group: "Categories" },
        { label: "Vintage", link: category("watches"), group: "Categories" },
        { label: "Dial Symmetry", link: category("watches"), group: "Collecting" },
        { label: "Movements 101", link: category("watches"), group: "Collecting" },
        { label: "The Buying Guide", link: category("watches"), group: "Collecting" },
      ],
    },
    {
      label: "Culture",
      link: category("culture"),
      feature: {
        tag: "CULTURE · 042",
        title: "The Art of Arriving Early",
        image: "/images/film-workshop.jpg",
        href: "/culture",
      },
      children: [
        { label: "Essays", link: category("culture"), group: "Sections" },
        { label: "Interviews", link: category("culture"), group: "Sections" },
        { label: "Travel", link: category("culture"), group: "Sections" },
        { label: "Machines", link: category("culture"), group: "Sections" },
        { label: "The Analog Weekend", link: category("culture"), group: "Series" },
        { label: "The Art of Arriving Early", link: category("culture"), group: "Series" },
        { label: "MG Film", link: category("film"), group: "Series" },
      ],
    },
    { label: "Film", link: category("film") },
    { label: "Store", link: url("/shop") },
  ],
};

/** `footer-primary` — the footer's nav row. The same six destinations as the
 *  header today, kept as a menu of its own because `0007` seeded it as one and
 *  because the two lists are free to diverge the moment an editor wants them to. */
const footerPrimary: DemoMenu = {
  key: "footer-primary",
  name: "Footer — primary",
  location: "footer-primary",
  items: [
    { label: "Style", link: category("style") },
    { label: "Grooming", link: category("grooming") },
    { label: "Watches", link: category("watches") },
    { label: "Culture", link: category("culture") },
    { label: "Film", link: category("film") },
    { label: "Store", link: url("/shop") },
  ],
};

/**
 * `footer-legal` — the "· "-separated line above the copyright.
 *
 * `/contact`, `/archive` and `/privacy` have no route and 404 today. They are
 * seeded exactly as Track A wrote them: this phase moves the navigation into the
 * database, and quietly dropping three links would be a content edit smuggled
 * inside a plumbing change.
 */
const footerLegal: DemoMenu = {
  key: "footer-legal",
  name: "Footer — legal",
  location: "footer-legal",
  items: [
    { label: "About", link: url("/about") },
    { label: "Contact", link: url("/contact") },
    { label: "Store", link: url("/shop") },
    { label: "Archive", link: url("/archive") },
    { label: "Privacy", link: url("/privacy") },
  ],
};

/** `drawer-secondary` — the mono links pinned under the drawer's accordion. */
const drawerSecondary: DemoMenu = {
  key: "drawer-secondary",
  name: "Drawer — secondary",
  location: "drawer-secondary",
  items: [
    { label: "About", link: url("/about") },
    { label: "Contact", link: url("/contact") },
    { label: "Archive", link: category("culture") },
  ],
};

export const DEMO_MENUS: DemoMenu[] = [headerPrimary, footerPrimary, footerLegal, drawerSecondary];

export const HEADER_MENU_KEY = "header-primary";
export const FOOTER_MENU_KEY = "footer-primary";
export const FOOTER_LEGAL_MENU_KEY = "footer-legal";
export const DRAWER_SECONDARY_MENU_KEY = "drawer-secondary";
