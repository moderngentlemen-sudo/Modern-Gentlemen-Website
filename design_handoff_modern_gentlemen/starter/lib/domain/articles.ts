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
