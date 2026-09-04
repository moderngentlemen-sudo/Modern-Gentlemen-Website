import { revalidatePath } from "next/cache";

import { getArticleRouting } from "@/lib/services/articles";
import { publicPathForArticle, publicPathForCategory } from "@/lib/domain/routes";

/**
 * Tell Next the public editorial pages changed.
 *
 * Since Phase 7c `/article/[slug]` reads the `articles` table and `/[category]`
 * reads a document whose lead and grid are **bound** to that same table, both
 * statically rendered. So an article affects its own page, the complete archive,
 * and the category page that lists it. Revalidating only the first is a bug that
 * looks like everything working — the article is live at its URL and absent from
 * the section it belongs to.
 *
 * That failure has a precedent worth naming: on products, publish revalidated
 * and delete did not, and what caught it was a visual baseline coming back one
 * grid row too tall. The lesson taken from it was to make this one shared helper
 * rather than a line in each action, which is why the article version was
 * written this way from the start.
 *
 * `snapshot` and autosave deliberately do not call it — the first writes history
 * and touches no published payload, the second fires every couple of seconds
 * while an editor types.
 *
 * Lives outside both `actions.ts` files because a `"use server"` module may
 * export only async functions.
 */
export async function revalidatePublicArticle(id: string): Promise<void> {
  const paths = await publicPathsForArticle(id);
  for (const path of paths) revalidatePath(path);
}

/**
 * The paths an article touches, read *before* anything changes.
 *
 * Delete needs this separately: once the row is gone there is no category to
 * look up, and revalidating before the delete would rebuild the pages from data
 * that is still there. So the caller reads the paths first and revalidates
 * after — the same two-step the products helper uses.
 */
export async function publicPathsForArticle(id: string): Promise<string[]> {
  try {
    const routing = await getArticleRouting(id);
    if (!routing) return [];

    return [
      publicPathForArticle(routing.slug),
      "/articles",
      ...(routing.categorySlug ? [publicPathForCategory(routing.categorySlug)] : []),
    ];
  } catch (error) {
    // An action that succeeded has succeeded. Failing it because a cache hint
    // could not be sent would report a false failure for something the hourly
    // backstop repairs on its own.
    console.error(`Could not resolve the public paths for article ${id}:`, error);
    return [];
  }
}

/**
 * Pair to `publicPathsForArticle`: revalidate a set of paths collected earlier.
 *
 * Used by delete, where the row is gone by the time this runs, and by a metadata
 * save, where the paths are collected **on both sides of the write** — re-filing
 * an article from Watches to Culture changes two listings, and only the union of
 * before and after covers both. Deduplicated, since the common case is that
 * nothing moved and the two sets are the same.
 */
export function revalidatePublicPaths(paths: string[]): void {
  for (const path of new Set(paths)) revalidatePath(path);
}
