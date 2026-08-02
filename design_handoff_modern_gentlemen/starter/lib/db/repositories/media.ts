/**
 * The media catalogue: assets, folders and usage records.
 *
 * Same contract as the other repositories — the client is the first argument,
 * so the caller decides whether RLS applies. The admin passes `lib/db/server`
 * (the editor's own session); scripts and fixtures pass `lib/db/admin`.
 *
 * Nothing here reaches Supabase Storage. The bytes are the service's business;
 * this file is only the catalogue over them, which is the split 0002_media.sql
 * describes in its own header.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../database.types";
import { unwrap } from "./errors";

type Db = SupabaseClient<Database>;

export type AssetRow = Database["public"]["Tables"]["media_assets"]["Row"];
export type FolderRow = Database["public"]["Tables"]["media_folders"]["Row"];
export type UsageRow = Database["public"]["Tables"]["media_usages"]["Row"];

export interface ListAssetsOptions {
  kind?: string;
  /** `null` means "the root folder"; `undefined` means "any folder". */
  folderId?: string | null;
  search?: string;
  limit?: number;
  offset?: number;
}

const DEFAULT_LIMIT = 60;

/**
 * Search is `ilike` across the four fields an editor actually types into, not
 * full-text.
 *
 * 0002 created `media_assets_search_idx`, a GIN index over a
 * `to_tsvector(...)` *expression*. PostgREST can only apply its `fts` operator
 * to a column, so that index is unreachable from here — and a leading-wildcard
 * `ilike` could not use it either. Reaching it needs a stored generated column
 * to hang the index on, which is a `public` schema change and a types
 * regeneration; at the scale this library will hold for a long while, a
 * sequential scan over a few thousand rows is not the bottleneck. Recorded in
 * PROGRESS.md rather than left as a silent mismatch between an index and the
 * code that was supposed to use it.
 */
function searchFilter(term: string): string {
  // Commas and parentheses would otherwise be read as PostgREST syntax.
  const escaped = term.replace(/[(),*]/g, " ").trim();
  const pattern = `%${escaped}%`;
  return ["title", "file_name", "alt_text", "caption"]
    .map((c) => `${c}.ilike.${pattern}`)
    .join(",");
}

export async function listAssets(
  db: Db,
  options: ListAssetsOptions = {}
): Promise<{ assets: AssetRow[]; total: number }> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const offset = options.offset ?? 0;

  let query = db
    .from("media_assets")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (options.kind) query = query.eq("kind", options.kind);
  if (options.folderId === null) query = query.is("folder_id", null);
  else if (options.folderId !== undefined) query = query.eq("folder_id", options.folderId);

  const term = options.search?.trim();
  if (term) query = query.or(searchFilter(term));

  const result = await query;
  const assets = unwrap("listAssets", result) as AssetRow[];
  return { assets: assets ?? [], total: result.count ?? 0 };
}

export async function getAsset(db: Db, id: string): Promise<AssetRow | null> {
  return (
    (unwrap(
      "getAsset",
      await db.from("media_assets").select("*").eq("id", id).maybeSingle()
    ) as AssetRow | null) ?? null
  );
}

/** Deduplication: identical bytes resolve to the asset already in the library. */
export async function findAssetByChecksum(db: Db, checksum: string): Promise<AssetRow | null> {
  return (
    (unwrap(
      "findAssetByChecksum",
      await db.from("media_assets").select("*").eq("checksum", checksum).limit(1).maybeSingle()
    ) as AssetRow | null) ?? null
  );
}

/**
 * The lookup usage reconciliation runs: a set of storage paths lifted out of a
 * block tree, resolved to the assets they name. One query rather than one per
 * reference, because a page can easily carry twenty images.
 */
export async function findAssetsByStoragePaths(
  db: Db,
  bucket: string,
  paths: string[]
): Promise<AssetRow[]> {
  if (paths.length === 0) return [];

  return (unwrap(
    "findAssetsByStoragePaths",
    await db
      .from("media_assets")
      .select("*")
      .eq("bucket", bucket)
      .in("storage_path", [...new Set(paths)])
  ) ?? []) as AssetRow[];
}

export interface InsertAssetInput {
  folderId?: string | null;
  bucket: string;
  storagePath: string;
  kind: string;
  mimeType: string;
  fileName: string;
  byteSize: number;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  title?: string | null;
  altText?: string | null;
  checksum?: string | null;
  createdBy: string;
}

export async function insertAsset(db: Db, input: InsertAssetInput): Promise<AssetRow> {
  return unwrap(
    "insertAsset",
    await db
      .from("media_assets")
      .insert({
        folder_id: input.folderId ?? null,
        bucket: input.bucket,
        storage_path: input.storagePath,
        kind: input.kind,
        mime_type: input.mimeType,
        file_name: input.fileName,
        byte_size: input.byteSize,
        width: input.width ?? null,
        height: input.height ?? null,
        duration_ms: input.durationMs ?? null,
        title: input.title ?? null,
        alt_text: input.altText ?? null,
        checksum: input.checksum ?? null,
        created_by: input.createdBy,
      })
      .select("*")
      .single()
  ) as AssetRow;
}

export interface AssetMetadataPatch {
  title?: string | null;
  altText?: string | null;
  caption?: string | null;
  credit?: string | null;
  focalPoint?: Json;
  folderId?: string | null;
}

/**
 * Only the keys the caller actually supplied are written.
 *
 * Same reasoning as the properties panel's "clearing an optional field deletes
 * the key": an absent key and an empty one are different intentions, and
 * flattening them here would have a metadata form that renders four fields
 * silently blank the other two on every save.
 */
export async function updateAssetMetadata(
  db: Db,
  id: string,
  patch: AssetMetadataPatch
): Promise<AssetRow> {
  const update: Database["public"]["Tables"]["media_assets"]["Update"] = {};

  if (patch.title !== undefined) update.title = patch.title;
  if (patch.altText !== undefined) update.alt_text = patch.altText;
  if (patch.caption !== undefined) update.caption = patch.caption;
  if (patch.credit !== undefined) update.credit = patch.credit;
  if (patch.focalPoint !== undefined) update.focal_point = patch.focalPoint;
  if (patch.folderId !== undefined) update.folder_id = patch.folderId;

  return unwrap(
    "updateAssetMetadata",
    await db.from("media_assets").update(update).eq("id", id).select("*").single()
  ) as AssetRow;
}

export async function deleteAsset(db: Db, id: string): Promise<void> {
  unwrap("deleteAsset", await db.from("media_assets").delete().eq("id", id));
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

export async function listFolders(db: Db): Promise<FolderRow[]> {
  return (unwrap(
    "listFolders",
    await db.from("media_folders").select("*").order("name", { ascending: true })
  ) ?? []) as FolderRow[];
}

export async function createFolder(
  db: Db,
  input: { name: string; slug: string; parentId?: string | null }
): Promise<FolderRow> {
  return unwrap(
    "createFolder",
    await db
      .from("media_folders")
      .insert({ name: input.name, slug: input.slug, parent_id: input.parentId ?? null })
      .select("*")
      .single()
  ) as FolderRow;
}

/** Assets in a deleted folder fall back to the root — `on delete set null` in 0002. */
export async function deleteFolder(db: Db, id: string): Promise<void> {
  unwrap("deleteFolder", await db.from("media_folders").delete().eq("id", id));
}

// ---------------------------------------------------------------------------
// Usage records
// ---------------------------------------------------------------------------

export interface UsageInput {
  assetId: string;
  fieldPath: string;
}

export async function usagesForAsset(db: Db, assetId: string): Promise<UsageRow[]> {
  return (unwrap(
    "usagesForAsset",
    await db.from("media_usages").select("*").eq("asset_id", assetId)
  ) ?? []) as UsageRow[];
}

export async function usagesForEntity(
  db: Db,
  entityType: string,
  entityId: string
): Promise<UsageRow[]> {
  return (unwrap(
    "usagesForEntity",
    await db
      .from("media_usages")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
  ) ?? []) as UsageRow[];
}

/**
 * Which existing usage rows this save has made obsolete.
 *
 * Pure, and exported, because it is the only real logic in the reconciliation
 * and the rest is I/O. Identity is the **(asset, field path) pair**, not the
 * path alone: swapping one image for another on the same control keeps the path
 * and changes the asset, so a path-only comparison would keep the old asset's
 * row and leave it looking as though it were still on the page — permanently
 * undeletable, for a reason no editor could see.
 */
export function staleUsageIds(
  existing: Pick<UsageRow, "id" | "asset_id" | "field_path">[],
  wanted: UsageInput[]
): string[] {
  const keep = new Set(wanted.map((u) => `${u.assetId} ${u.fieldPath}`));
  return existing
    .filter((row) => !keep.has(`${row.asset_id} ${row.field_path ?? ""}`))
    .map((row) => row.id);
}

/**
 * Reconcile one entity's usage records to exactly `usages`.
 *
 * **Insert first, then delete what is no longer referenced.** The order is the
 * whole safety argument. These are two statements, not a transaction, so one
 * can succeed and the other fail — and the two orderings fail in opposite
 * directions. Deleting first would leave a window, and on a crash a permanent
 * state, in which an asset that *is* on a page has no usage row: the library
 * would call it unused and let an editor delete it, which is precisely the
 * mistake `media_usages` exists to prevent. Inserting first can only ever leave
 * a stale row behind, which makes the library over-cautious about a deletion
 * and is corrected by the next save.
 *
 * The unique constraint on (asset, entity, field_path) makes the insert an
 * idempotent upsert, so re-running this is free.
 */
export async function replaceUsagesForEntity(
  db: Db,
  entityType: string,
  entityId: string,
  usages: UsageInput[]
): Promise<void> {
  // Read before writing, so the stale set is the rows that existed *and* are no
  // longer wanted.
  const existing = await usagesForEntity(db, entityType, entityId);
  const staleIds = staleUsageIds(existing, usages);

  if (usages.length > 0) {
    unwrap(
      "replaceUsagesForEntity/upsert",
      await db.from("media_usages").upsert(
        usages.map((u) => ({
          asset_id: u.assetId,
          entity_type: entityType,
          entity_id: entityId,
          field_path: u.fieldPath,
        })),
        { onConflict: "asset_id,entity_type,entity_id,field_path", ignoreDuplicates: true }
      )
    );
  }

  if (staleIds.length > 0) {
    unwrap(
      "replaceUsagesForEntity/prune",
      await db.from("media_usages").delete().in("id", staleIds)
    );
  }
}
