/**
 * Patterns — reusable saved layouts.
 *
 * `sync_mode` decides what a pattern means once inserted:
 *   synced      the page stores a `_ref` and the pattern is expanded at render
 *               time, so editing the pattern updates every usage.
 *   detachable  the blocks were copied into the page at insert time; there is
 *               no `_ref` and nothing to expand.
 *
 * Only synced patterns are ever looked up here.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../database.types";
import { unwrap } from "./errors";

type Db = SupabaseClient<Database>;

export type PatternSyncMode = "synced" | "detachable";

export interface PatternCategoryRow {
  id: string;
  slug: string;
  label: string;
  position: number;
}

export interface PatternRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category_id: string | null;
  sync_mode: PatternSyncMode;
  status: string;
  draft_data: Json;
  published_data: Json | null;
  version: number;
  updated_at: string;
}

/**
 * Loads the patterns a block tree references.
 *
 * `preferDraft` exists for preview: a preview of a page should show the
 * patterns as they currently are, not as they were last published, or the
 * preview would not reflect what publishing would actually produce.
 */
export async function getPatternsByIds(
  db: Db,
  ids: string[],
  { preferDraft = false } = {}
): Promise<Map<string, Json>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return new Map();

  const rows = unwrap(
    "getPatternsByIds",
    await db.from("patterns").select("id, draft_data, published_data").in("id", unique)
  ) as Pick<PatternRow, "id" | "draft_data" | "published_data">[] | null;

  const out = new Map<string, Json>();
  for (const row of rows ?? []) {
    const payload = preferDraft ? row.draft_data : (row.published_data ?? row.draft_data);
    out.set(row.id, payload);
  }
  return out;
}

export async function getPatternByKey(db: Db, key: string): Promise<PatternRow | null> {
  return (
    (unwrap(
      "getPatternByKey",
      await db.from("patterns").select("*").eq("key", key).maybeSingle()
    ) as PatternRow | null) ?? null
  );
}

export async function getPattern(db: Db, id: string): Promise<PatternRow | null> {
  return (
    (unwrap(
      "getPattern",
      await db.from("patterns").select("*").eq("id", id).maybeSingle()
    ) as PatternRow | null) ?? null
  );
}

export async function listPatterns(
  db: Db,
  { categoryId }: { categoryId?: string } = {}
): Promise<PatternRow[]> {
  let query = db.from("patterns").select("*").order("name");
  if (categoryId) query = query.eq("category_id", categoryId);
  return (unwrap("listPatterns", await query) as PatternRow[]) ?? [];
}

/**
 * The pattern categories, in `position` order.
 *
 * `0003_content_spine.sql` seeded five of them — Heroes, Editorial, Commerce,
 * Bands & CTAs, Saved layouts — and **nothing has ever read the table**. The
 * column on `patterns` that references it was written by nothing and read by
 * nothing, which is the same shape as the `sync_schedule` gap the scheduled-feeds
 * slice closed: a fully-built feature with no way in.
 */
export async function listPatternCategories(db: Db): Promise<PatternCategoryRow[]> {
  return (
    (unwrap(
      "listPatternCategories",
      await db.from("pattern_categories").select("id, slug, label, position").order("position")
    ) as PatternCategoryRow[]) ?? []
  );
}

/**
 * The two columns the admin never collected.
 *
 * Separate from `renameDocument` on purpose: that one is generic over every
 * document table and speaks title/slug, while `description` and `category_id`
 * exist on `patterns` alone. Folding them in would have meant a generic
 * function with two pattern-shaped optional arguments.
 *
 * `null` is a real value for both — it clears the field — so the caller says
 * which keys it means by their presence, the same convention `updateVariant`
 * uses.
 */
export async function updatePatternDetails(
  db: Db,
  id: string,
  patch: { description?: string | null; categoryId?: string | null }
): Promise<void> {
  const update: Database["public"]["Tables"]["patterns"]["Update"] = {};

  if (patch.description !== undefined) update.description = patch.description;
  if (patch.categoryId !== undefined) update.category_id = patch.categoryId;
  if (Object.keys(update).length === 0) return;

  unwrap("updatePatternDetails", await db.from("patterns").update(update).eq("id", id));
}

export async function createPattern(
  db: Db,
  input: {
    key: string;
    name: string;
    description?: string;
    categoryId?: string;
    syncMode?: PatternSyncMode;
    draftData: Json;
    createdBy: string;
  }
): Promise<PatternRow> {
  return unwrap(
    "createPattern",
    await db
      .from("patterns")
      .insert({
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        category_id: input.categoryId ?? null,
        sync_mode: input.syncMode ?? "detachable",
        draft_data: input.draftData,
        created_by: input.createdBy,
        updated_by: input.createdBy,
      })
      .select("*")
      .single()
  ) as PatternRow;
}
