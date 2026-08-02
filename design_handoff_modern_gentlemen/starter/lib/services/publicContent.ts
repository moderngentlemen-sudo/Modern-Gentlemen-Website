/**
 * Public content reads — the published site's data layer.
 *
 * **This is the one service with no `requirePermission` call, and that is the
 * point rather than an omission.** Everything else in `lib/services` guards a
 * staff action; this reads what has deliberately been made public. The guard is
 * still there, one layer down: `createPublicClient()` is anonymous, and the RLS
 * policies from `0003`–`0005` read `using (status = 'published' or is_staff())`.
 * An anonymous caller is not staff, so a draft cannot come back through here
 * even if a query asked for one. The database is the enforcement; these
 * functions are the shape.
 *
 * Note what is NOT here: a fallback to the demo modules. A silent fallback
 * would mean a broken database read renders a plausible page and nobody finds
 * out for a week. Static rendering already gives the safety a fallback was
 * reaching for — the page is built once, and if a later revalidation fails Next
 * keeps serving the last good output. A blip cannot blank the site; only a
 * failed build can, and a failed build is meant to be loud.
 */

import { createPublicClient } from "@/lib/db/public";
import type { BlockTree } from "@/lib/blocks/types";
import type { Json } from "@/lib/db/database.types";

/** The published payload of a page, as the renderer wants it. */
export interface PublishedPage {
  slug: string;
  title: string;
  sections: BlockTree;
}

/**
 * `published_data`, never `draft_data`.
 *
 * The two columns exist precisely so that an editor mid-edit does not ship
 * their half-finished work, and reading the wrong one here would quietly undo
 * the whole of Phase 3. RLS would not catch it: a published row's draft is
 * readable by anyone who can read the row.
 */
function sectionsOf(payload: Json | null): BlockTree {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const sections = (payload as Record<string, unknown>).sections;
  return Array.isArray(sections) ? (sections as BlockTree) : [];
}

export async function getPublishedPage(slug: string): Promise<PublishedPage | null> {
  const db = createPublicClient();

  const { data, error } = await db
    .from("pages")
    .select("slug, title, published_data, status")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  // Thrown, not swallowed. During a static build this fails the build, which is
  // the correct outcome — shipping a site whose content did not load is worse
  // than not shipping. During revalidation Next keeps the previous output.
  if (error) {
    throw new Error(`Could not read the published page "${slug}": ${error.message}`);
  }
  if (!data) return null;

  return {
    slug: data.slug,
    title: data.title,
    sections: sectionsOf(data.published_data),
  };
}
