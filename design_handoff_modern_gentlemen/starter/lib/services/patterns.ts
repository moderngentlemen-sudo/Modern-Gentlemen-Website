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
