/**
 * Article vocabulary — pure, no data access.
 *
 * `articles.template` is a free-text column holding one of the twenty names in
 * the template library. Naming them here as a typed tuple means the create
 * dialog, the editor's select and the server action's Zod enum all read from
 * one list, and a typo is a compile error rather than an article that renders
 * as the fallback template with nothing to say why.
 *
 * The list is declared rather than derived from `lib/articles.ts`, which is
 * demo content and does not belong in `lib/domain`. `articles.test.ts` asserts
 * the two agree — the same conformance stance `lib/blocks` takes towards
 * `components/sections/registry.ts`, and for the same reason: co-location would
 * look safer while checking nothing.
 */

export const ARTICLE_TEMPLATE_NAMES = [
  "Feature",
  "Feature — Standard",
  "Cover Story",
  "The Big Read",
  "Op-Ed",
  "Letter from the Editor",
  "Interview",
  "Profile",
  "Ask MG",
  "Review",
  "Spec Comparison",
  "Photo Essay",
  "Gallery",
  "Film Feature",
  "The List",
  "Field Guide",
  "The Regimen",
  "A Brief History",
  "The Rundown",
  "Manifesto",
] as const;

export type ArticleTemplateName = (typeof ARTICLE_TEMPLATE_NAMES)[number];

/** The column default, and what a new article gets when nothing is chosen. */
export const DEFAULT_ARTICLE_TEMPLATE: ArticleTemplateName = "Feature";

export function isArticleTemplate(value: string): value is ArticleTemplateName {
  return (ARTICLE_TEMPLATE_NAMES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// What a template renders as
// ---------------------------------------------------------------------------

/**
 * The two axes every template is built from: which hero opens the page, and
 * which body lays out the article beneath it. `components/article/ArticleHero`
 * and `ArticleBody` are the dispatchers.
 */
export type HeroVariant =
  | "full"
  | "contained"
  | "cover"
  | "wide"
  | "portrait"
  | "split"
  | "masthead"
  | "centered"
  | "video";

export type BodyVariant =
  | "prose"
  | "essay"
  | "letter"
  | "qa"
  | "ask"
  | "profile"
  | "review"
  | "spec"
  | "photo"
  | "gallery"
  | "film"
  | "list"
  | "steps"
  | "regimen"
  | "timeline"
  | "rundown"
  | "manifesto";

export interface ArticleLayout {
  hero: HeroVariant;
  body: BodyVariant;
}

/**
 * Template name → layout, 1:1 with the prototype's `config()`.
 *
 * This is the half of a template that is a *fact about the library* rather than
 * demo copy, which is why it sits here while the placeholder headlines stay in
 * `lib/demo/articles.ts`. The public route needs it and must not import a demo
 * module to get it; `articles.test.ts` asserts the two agree, so a template that
 * gains a variant in one place fails the build rather than rendering as the
 * fallback with nothing to say why.
 */
export const ARTICLE_TEMPLATE_LAYOUTS: Record<ArticleTemplateName, ArticleLayout> = {
  Feature: { hero: "full", body: "prose" },
  "Feature — Standard": { hero: "contained", body: "prose" },
  "Cover Story": { hero: "cover", body: "prose" },
  "The Big Read": { hero: "wide", body: "essay" },
  "Op-Ed": { hero: "masthead", body: "essay" },
  "Letter from the Editor": { hero: "centered", body: "letter" },
  Interview: { hero: "portrait", body: "qa" },
  Profile: { hero: "split", body: "profile" },
  "Ask MG": { hero: "centered", body: "ask" },
  Review: { hero: "contained", body: "review" },
  "Spec Comparison": { hero: "masthead", body: "spec" },
  "Photo Essay": { hero: "full", body: "photo" },
  Gallery: { hero: "contained", body: "gallery" },
  "Film Feature": { hero: "video", body: "film" },
  "The List": { hero: "masthead", body: "list" },
  "Field Guide": { hero: "masthead", body: "steps" },
  "The Regimen": { hero: "contained", body: "regimen" },
  "A Brief History": { hero: "masthead", body: "timeline" },
  "The Rundown": { hero: "masthead", body: "rundown" },
  Manifesto: { hero: "centered", body: "manifesto" },
};

/** An unknown template name renders as the default rather than as nothing. */
export function layoutFor(template: string): ArticleLayout {
  return ARTICLE_TEMPLATE_LAYOUTS[
    isArticleTemplate(template) ? template : DEFAULT_ARTICLE_TEMPLATE
  ];
}

// ---------------------------------------------------------------------------
// The resolved article
// ---------------------------------------------------------------------------

/** One KEEP READING card. */
export interface RelatedItem {
  tag: string;
  title: string;
  image: string;
  href: string;
}

/**
 * An article's stored facts, before the template and the derived strings are
 * applied. Both sources produce this shape — the demo module from its literals,
 * `lib/services/publicEditorial.ts` from a row and its joins — which is what
 * makes the two provably interchangeable.
 *
 * `category` is the **display label** the design prints, not a foreign key. For
 * a filed article it is its category's name; the twenty template showcases are
 * unfiled and carry labels like "The Debrief" that no category row has.
 */
export interface ArticleDoc {
  slug: string;
  title: string;
  template: string;
  category: string;
  issue: string;
  author: string;
  read: string; // "N MIN" — the byline appends " READ"
  dek?: string;
  heroImage?: string;
  videoUrl?: string;
}

export interface ResolvedArticle extends ArticleDoc, ArticleLayout {
  kicker: string;
  byline: string;
  authorInitial: string;
  related: RelatedItem[];
}

/** e.g. "STYLE · NO. 040" — the rail above an article's title. */
export const composeKicker = (a: Pick<ArticleDoc, "category" | "issue">): string =>
  `${a.category} · No. ${a.issue}`.toUpperCase();

/**
 * The photography credit is conditional on there being a photograph, which is
 * why this is a function and not a template string at the call site: "Op-Ed" has
 * no hero image and must not claim a photographer.
 */
export const composeByline = (a: Pick<ArticleDoc, "author" | "read" | "heroImage">): string =>
  `WORDS · ${a.author.toUpperCase()} · ${a.read} READ` +
  (a.heroImage ? " · PHOTOGRAPHY · E. MARLOWE" : "");

/** The drop-capital beside a byline. "M" for a name that starts with nothing. */
export const authorInitial = (author: string): string => (author.trim()[0] || "M").toUpperCase();

/** e.g. "CULTURE · 041" — the tag on a KEEP READING or article-grid card. */
export const composeCardTag = (label: string, issue: string): string =>
  `${label.toUpperCase()} · ${issue}`;

/**
 * The unit a category's stories are measured in.
 *
 * Four categories print "7 MIN READ" on their lead card. Film prints
 * "12 MIN FILM", because a film is watched rather than read. The distinction
 * surfaces **only** on the lead — every grid card prints the bare "7 MIN" — and
 * it cannot be recovered from `articles.reading_minutes`, which is an integer
 * and knows nothing about units. So it is declared here, with the rest of the
 * design's vocabulary, rather than inferred wherever a reading time is built.
 *
 * Keyed on the category slug, with "READ" as the default, so a new category is
 * read unless it says otherwise.
 */
export const READING_UNITS: Record<string, string> = { film: "FILM" };

export const readingUnitFor = (categorySlug: string | null | undefined): string =>
  (categorySlug && READING_UNITS[categorySlug]) || "READ";

/**
 * The two forms a reading time takes: "12 MIN" on a grid card, "12 MIN FILM" or
 * "7 MIN READ" on a lead. Both derive from one integer, which is why they are
 * built together — appending the suffix at a call site is how the two drift.
 */
export function readingTimes(
  minutes: number | null,
  categorySlug?: string | null
): { read: string; readLong: string } {
  const read = minutes === null ? "" : `${minutes} MIN`;
  return { read, readLong: read ? `${read} ${readingUnitFor(categorySlug)}` : "" };
}

/**
 * A related card is a photograph and a headline; one without a photograph is a
 * hole in the grid. Articles with no hero image — "Op-Ed" is the case — borrow
 * the cover rather than rendering an empty frame.
 */
export const FALLBACK_RELATED_IMAGE = "/images/hero-cover.jpg";

/**
 * How many KEEP READING cards the article page shows.
 *
 * Three, because the grid is three across. Exported so the reader
 * (`publicEditorial.ts`), the writer (`normalizeRelatedIds`) and the admin's
 * picker all cap at the same number — a curated fourth would be stored, never
 * rendered, and impossible to explain to whoever chose it.
 */
export const KEEP_READING_COUNT = 3;

/**
 * The curated KEEP READING list, cleaned up before it is stored.
 *
 * Order is the editor's and is preserved — that is the entire point of
 * `article_relations.position`, and what the demo's module-insertion ordering
 * needed a column to express.
 *
 * Three corrections, each of which the database would otherwise make by
 * rejecting the write:
 *
 *   * **the article itself is dropped.** `article_relation_not_self` is a CHECK
 *     constraint, so storing it raises `23514` — a five-digit code in a toast
 *     where "an article cannot be related to itself" belongs.
 *   * **duplicates collapse to their first appearance.** `(article_id,
 *     related_id)` is the primary key; a repeat is `23505`. Keeping the first
 *     is what preserves the editor's intended order.
 *   * **the list is capped at `KEEP_READING_COUNT`.**
 *
 * Correcting rather than refusing, because every one of these is already
 * prevented by the picker: reaching this function with a bad list means
 * something other than the UI called it, and a stored list that renders is a
 * better outcome there than a failed save.
 */
export function normalizeRelatedIds(articleId: string, relatedIds: readonly string[]): string[] {
  const seen = new Set<string>([articleId]);

  return relatedIds
    .filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, KEEP_READING_COUNT);
}
