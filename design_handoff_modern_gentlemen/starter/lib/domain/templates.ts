/**
 * Templates — the `kind` vocabulary, and nothing else.
 *
 * A template's *payload* shape (named areas) lives in `lib/blocks/areas.ts`,
 * because that is a statement about block trees and this file is a leaf that
 * deliberately does not know what a `BlockNode` is — the same split
 * `lib/domain/documents.ts` makes when it holds `BLOCK_TREE_KEY` as a key name
 * rather than an extractor.
 *
 * `TEMPLATE_KINDS` mirrors the CHECK constraint in `0003_content_spine.sql`.
 * Where the two could drift the database wins; this is the typed pre-check that
 * produces a good error message.
 */

export const TEMPLATE_KINDS = [
  "page",
  "article",
  "product",
  "archive",
  "header",
  "footer",
  "section",
] as const;

export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export function isTemplateKind(value: string): value is TemplateKind {
  return (TEMPLATE_KINDS as readonly string[]).includes(value);
}

/**
 * What each kind is for, shown beside the selector when a template is created.
 *
 * A kind cannot be changed after creation — `template_assignments` resolves
 * against it — so the one place it is chosen is the one place it has to be
 * explained.
 */
export const TEMPLATE_KIND_DESCRIPTION: Record<TemplateKind, string> = {
  page: "A layout for ordinary pages.",
  article: "A layout for editorial articles.",
  product: "A layout for product detail pages.",
  archive: "A layout for listing screens — a category's index, say.",
  header: "A global part, shared site-wide.",
  footer: "A global part, shared site-wide.",
  section: "A reusable fragment, assigned rather than inserted.",
};
