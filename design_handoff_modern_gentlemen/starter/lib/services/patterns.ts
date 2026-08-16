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

export type { PatternRow, PatternSyncMode } from "@/lib/db/repositories/patterns";

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
  const rows = await repo.listPatterns(db);

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
      };
    })
    .filter((pattern) => pattern.blockCount > 0);
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
