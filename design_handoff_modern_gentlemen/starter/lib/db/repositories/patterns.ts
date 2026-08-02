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

export async function listPatterns(
  db: Db,
  { categoryId }: { categoryId?: string } = {}
): Promise<PatternRow[]> {
  let query = db.from("patterns").select("*").order("name");
  if (categoryId) query = query.eq("category_id", categoryId);
  return (unwrap("listPatterns", await query) as PatternRow[]) ?? [];
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
