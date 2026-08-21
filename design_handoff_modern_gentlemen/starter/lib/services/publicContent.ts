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
import { collectPatternRefs, expandPatterns } from "@/lib/blocks/expand";
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

/**
 * Substitutes every synced pattern in a tree for the blocks it points at.
 *
 * This is what makes `sync_mode: 'synced'` mean anything. A synced pattern is
 * stored in the page as a `patternRef` node carrying `_ref`, and until this
 * existed **no public route expanded one** — `expandPatternRefs` had exactly one
 * caller, the preview route. A synced pattern therefore rendered correctly in
 * preview and vanished from the live site: the worst failure shape available,
 * because the person checking their work is shown it working.
 *
 * Three things about it are deliberate.
 *
 * **It reads through `createPublicClient()`, like everything else here.** The
 * admin-side `expandPatternRefs` in `lib/services/patterns.ts` uses
 * `lib/db/server.ts`, which calls `cookies()` — and any route that awaits
 * `cookies()` is opted out of static rendering by Next. Calling that one from a
 * public route would have turned the homepage into a per-request render with
 * nothing failing to say so.
 *
 * ⚠️ **It selects `published_data` only, and it does not reuse
 * `repo.getPatternsByIds`.** That function selects `draft_data` too, and `0020`
 * revoked that column from `anon` — so the shared read fails as
 * `42501 permission denied for table patterns`, an error that names the table
 * and not the column. Measured against the live project rather than reasoned
 * about. The column list here is the fix, and the *absence* of the repository's
 * `published_data ?? draft_data` fallback is the second half of it: falling back
 * to a draft is precisely the "editor mid-edit ships half-finished work" hazard
 * that `sectionsOf` above exists to prevent, and it would be worse here, since
 * one unpublished pattern would leak into every page using it.
 *
 * **An unpublished or deleted pattern leaves its node in place**, and
 * `PatternRef` renders nothing — see `expandPatternsDetailed`. A gap is the
 * right outcome for a visitor; the loud half belongs to the editor.
 */
export async function expandPublicPatterns(tree: BlockTree): Promise<BlockTree> {
  const refs = collectPatternRefs(tree);
  if (refs.length === 0) return tree;

  const db = createPublicClient();
  const ids = [...new Set(refs.map((ref) => ref.patternId))];

  const { data, error } = await db
    .from("patterns")
    .select("id, published_data")
    .in("id", ids)
    .eq("status", "published");

  // Thrown rather than swallowed, for the reason `getPublishedPage` gives: at
  // build time this should fail the build, and during revalidation Next keeps
  // the previous output. Silently returning the unexpanded tree would render
  // every synced pattern as a gap and look like an editor's mistake.
  if (error) {
    throw new Error(`Could not read the patterns this page references: ${error.message}`);
  }

  const payloads = new Map<string, Json>();
  for (const row of data ?? []) payloads.set(row.id, row.published_data);

  return expandPatterns(tree, payloads as ReadonlyMap<string, unknown>);
}
