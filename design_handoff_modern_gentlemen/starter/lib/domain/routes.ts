/**
 * Where a document appears on the public site — pure, no I/O.
 *
 * This exists so that "publishing a page updates the live site" has exactly one
 * definition. The publish, unpublish and rollback actions all need to know
 * which path to revalidate, and three copies of the same `slug === "home"`
 * special case is how one of them ends up wrong and a page silently stops
 * updating.
 */

/**
 * The homepage is the one page whose slug is not its path.
 *
 * `pages.slug` is `"home"` because a slug column that allowed `""` would make
 * every uniqueness and lookup question awkward, and because `/admin/pages`
 * needs something to print. The site still serves it at `/`.
 */
export const HOME_PAGE_SLUG = "home";

export function publicPathForPage(slug: string): string {
  return slug === HOME_PAGE_SLUG ? "/" : `/${slug}`;
}

export function publicPathForArticle(slug: string): string {
  return `/article/${slug}`;
}

/**
 * A category's landing page sits at the root, one segment deep — `/style`, not
 * `/category/style`. Which is why publishing an article has to revalidate two
 * paths: its own, and this one, because the category page's lead and grid are
 * bound to the `articles` table and go stale the moment one is published.
 */
export function publicPathForCategory(slug: string): string {
  return `/${slug}`;
}

export function publicPathForProduct(slug: string): string {
  return `/product/${slug}`;
}
