/**
 * Patterns — reusable saved layouts, and the lookup that expands them.
 *
 * The expansion itself is pure and lives in `lib/blocks/expand.ts`; this file
 * is the part that needs a database. Splitting them that way is what lets the
 * expansion logic be unit-tested without one.
 */

import { createClient } from "@/lib/db/server";
import * as repo from "@/lib/db/repositories/patterns";
import { collectPatternRefs, expandPatterns } from "@/lib/blocks/expand";
import type { BlockTree } from "@/lib/blocks/types";
import type { Json } from "@/lib/db/database.types";
import { requirePermission } from "./auth";

export type {
  PatternCategoryRow,
  PatternRow,
  PatternSyncMode,
} from "@/lib/db/repositories/patterns";

/**
 * The pattern categories an editor may file a pattern under.
 *
 * Gated on `pattern.read` rather than `pattern.write`: the list is also what
 * the builder's rail groups by, and someone who may insert a pattern but not
 * create one still needs to see the headings.
 */
export async function listPatternCategories() {
  await requirePermission("pattern.read");
  const db = await createClient();
  return repo.listPatternCategories(db);
}

export async function setPatternDetails(
  id: string,
  patch: { description?: string | null; categoryId?: string | null }
) {
  await requirePermission("pattern.write");
  const db = await createClient();
  return repo.updatePatternDetails(db, id, patch);
}

export async function listPatterns(options: { categoryId?: string } = {}) {
  await requirePermission("pattern.read");
  const db = await createClient();
  return repo.listPatterns(db, options);
}

export async function getPatternByKey(key: string) {
  await requirePermission("pattern.read");
  const db = await createClient();
  return repo.getPatternByKey(db, key);
}

/** What the builder's library rail needs to offer a pattern for insertion. */
export interface InsertablePattern {
  id: string;
  name: string;
  description: string | null;
  blockCount: number;
  blocks: BlockTree;
  /**
   * Which of the two things inserting this pattern means — a copy of its blocks,
   * or a `patternRef` pointing at it. The pattern decides, not the editor doing
   * the inserting: `sync_mode` is a property of the pattern, and offering the
   * choice per insertion would make "editing the pattern updates every page
   * using it" true of some usages and not others.
   */
  syncMode: repo.PatternSyncMode;
  /**
   * The heading the rail files this pattern under, or null for "Patterns".
   *
   * A label rather than an id because the rail renders it and nothing else
   * needs to join on it — and `position` comes along so the groups sort the way
   * the categories do rather than alphabetically.
   */
  category: { label: string; position: number } | null;
  /**
   * Whether the pattern has a published payload.
   *
   * ⚠️ **Only meaningful for a synced one, and then it is load-bearing.** The
   * public expansion reads `published_data` and nothing else, so a synced
   * pattern that has never been published resolves to nothing on the live site
   * — a page that composes, previews and publishes cleanly and then renders a
   * gap. Surfaced so the rail and the canvas can say so before that happens.
   */
  published: boolean;
}

/**
 * The patterns a page editor may insert.
 *
 * Prefers `published_data` and falls back to the draft, which is the opposite
 * of `expandPatternRefs({ preferDraft: true })` and deliberately so: a preview
 * asks "what would publishing this page produce", while inserting asks "give me
 * the approved version of this pattern". A pattern whose draft is mid-edit
 * should not drop half-finished blocks into someone else's page.
 *
 * Patterns with no blocks are dropped rather than listed — an entry that
 * inserts nothing is a dead control, and a freshly created pattern is empty
 * until someone composes it.
 */
export async function listInsertablePatterns(): Promise<InsertablePattern[]> {
  await requirePermission("pattern.read");
  const db = await createClient();
  const [rows, categories] = await Promise.all([
    repo.listPatterns(db),
    repo.listPatternCategories(db),
  ]);
  const byId = new Map(categories.map((c) => [c.id, c]));

  return rows
    .map((row) => {
      const payload = (row.published_data ?? row.draft_data) as { blocks?: unknown } | null;
      const blocks = Array.isArray(payload?.blocks) ? (payload.blocks as BlockTree) : [];
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        blockCount: blocks.length,
        blocks,
        syncMode: row.sync_mode,
        category: categoryOf(row.category_id, byId),
        published: row.published_data !== null,
      };
    })
    .filter((pattern) => pattern.blockCount > 0);
}

/**
 * A pattern's category as the rail wants it — or null.
 *
 * Null covers two different things on purpose: the pattern is filed under
 * nothing, and the pattern names a category row that no longer exists.
 * `category_id` is `on delete set null`, so the second is rare, but a dangling
 * id would otherwise render a heading with no text.
 */
function categoryOf(
  categoryId: string | null,
  byId: ReadonlyMap<string, repo.PatternCategoryRow>
): { label: string; position: number } | null {
  const found = categoryId ? byId.get(categoryId) : undefined;
  return found ? { label: found.label, position: found.position } : null;
}

export async function createPattern(input: {
  key: string;
  name: string;
  description?: string;
  categoryId?: string;
  syncMode?: repo.PatternSyncMode;
  blocks: BlockTree;
}) {
  const user = await requirePermission("pattern.write");
  const db = await createClient();

  return repo.createPattern(db, {
    key: input.key,
    name: input.name,
    description: input.description,
    categoryId: input.categoryId,
    syncMode: input.syncMode,
    draftData: { blocks: input.blocks } as unknown as Json,
    createdBy: user.id,
  });
}

/**
 * Replaces every `_ref` node in a tree with the pattern it points at.
 *
 * `preferDraft` is what makes a preview honest: previewing a page should show
 * its patterns as they currently stand, not as they were last published, or the
 * preview would not reflect what publishing would actually produce.
 *
 * Not permission-checked — it only expands content the caller already holds,
 * and the read that produced that content was checked.
 */
export async function expandPatternRefs(
  tree: BlockTree,
  { preferDraft = false } = {}
): Promise<BlockTree> {
  const refs = collectPatternRefs(tree);
  if (refs.length === 0) return tree;

  const db = await createClient();
  const payloads = await repo.getPatternsByIds(
    db,
    refs.map((ref) => ref.patternId),
    { preferDraft }
  );

  return expandPatterns(tree, payloads as ReadonlyMap<string, unknown>);
}
