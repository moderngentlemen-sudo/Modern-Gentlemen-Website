/**
 * Media service — the library, and the usage records that make it one.
 *
 * Two things live here that the repository deliberately does not do: the bytes
 * (Supabase Storage) and the decisions (permission gates, deduplication, and
 * the refusal to delete an asset that is on a page).
 *
 * Writes go through `lib/db/server.ts` — the editor's own session — so the
 * storage policies in `0013_media_storage.sql` and the RLS on `media_assets`
 * both evaluate as that person. The service-role client appears nowhere in this
 * file.
 */

import { createClient } from "@/lib/db/server";
import { supabaseUrl } from "@/lib/db/env";
import * as repo from "@/lib/db/repositories/media";
import type { Json } from "@/lib/db/database.types";
import { getDocument as getDocumentRow } from "@/lib/db/repositories/documents";
import { collectMediaReferences } from "@/lib/blocks/media";
import type { BlockNode } from "@/lib/blocks/types";
import { isDocumentType } from "@/lib/domain/documents";
import {
  CENTRE,
  MEDIA_BUCKET,
  mediaKindFromMime,
  publicUrlFor,
  storagePathFor,
  storagePathFromPublicUrl,
  type FocalPoint,
  type MediaAsset,
  type MediaKind,
  type MediaMetadata,
} from "@/lib/domain/media";
import { requirePermission } from "./auth";

/** A catalogue row plus the URL a block would store for it. */
export interface AssetView extends MediaAsset {
  url: string;
}

export interface AssetUsage {
  id: string;
  entityType: string;
  entityId: string;
  fieldPath: string | null;
}

/** Raised when a delete is refused because the asset is still on something. */
export class AssetInUseError extends Error {
  constructor(
    readonly asset: AssetView,
    readonly usages: AssetUsage[]
  ) {
    super(
      `"${asset.fileName}" is used in ${usages.length} ${
        usages.length === 1 ? "place" : "places"
      } and cannot be deleted until those references are removed.`
    );
    this.name = "AssetInUseError";
  }
}

export class MediaUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaUploadError";
  }
}

// ---------------------------------------------------------------------------
// Row → view
// ---------------------------------------------------------------------------

function toFocalPoint(value: unknown): FocalPoint {
  if (value && typeof value === "object") {
    const { x, y } = value as { x?: unknown; y?: unknown };
    if (typeof x === "number" && typeof y === "number") return { x, y };
  }
  return CENTRE;
}

export function toAssetView(row: repo.AssetRow): AssetView {
  return {
    id: row.id,
    folderId: row.folder_id,
    bucket: row.bucket,
    storagePath: row.storage_path,
    externalUrl: row.external_url,
    kind: row.kind as MediaKind,
    mimeType: row.mime_type,
    fileName: row.file_name,
    byteSize: Number(row.byte_size ?? 0),
    width: row.width,
    height: row.height,
    durationMs: row.duration_ms,
    placeholder: row.placeholder,
    title: row.title,
    altText: row.alt_text,
    caption: row.caption,
    credit: row.credit,
    focalPoint: toFocalPoint(row.focal_point),
    checksum: row.checksum,
    createdAt: row.created_at,
    // An asset we do not store keeps the URL it came with. 0002 has the column
    // for exactly this: legacy /public files and third-party embeds catalogued
    // alongside the ones we host.
    url: row.external_url ?? publicUrlFor(supabaseUrl(), row.storage_path, row.bucket),
  };
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export async function listAssets(
  options: repo.ListAssetsOptions = {}
): Promise<{ assets: AssetView[]; total: number }> {
  await requirePermission("media.read");
  const db = await createClient();
  const { assets, total } = await repo.listAssets(db, options);
  return { assets: assets.map(toAssetView), total };
}

export async function getAsset(id: string): Promise<AssetView | null> {
  await requirePermission("media.read");
  const db = await createClient();
  const row = await repo.getAsset(db, id);
  return row ? toAssetView(row) : null;
}

export async function getAssetUsages(id: string): Promise<AssetUsage[]> {
  await requirePermission("media.read");
  const db = await createClient();
  return (await repo.usagesForAsset(db, id)).map(toUsage);
}

/** A usage with somewhere to go. `null` title means the row is hidden by RLS. */
export interface AssetUsageView extends AssetUsage {
  title: string | null;
  href: string | null;
}

/**
 * Usages with the document titles resolved.
 *
 * "In use in 3 places" is not an answer an editor can act on; "the Home page's
 * hero" is. One query per referenced document, which is fine because the list
 * is short by construction — an asset used in thirty places is a logo, and the
 * cap keeps a pathological case from turning a panel render into thirty round
 * trips.
 *
 * A title of `null` means the document exists but this person cannot read it.
 * Showing the reference anyway is deliberate: they still need to know the
 * asset is spoken for, even when they cannot see by what.
 */
export async function getAssetUsageViews(id: string, cap = 30): Promise<AssetUsageView[]> {
  await requirePermission("media.read");
  const db = await createClient();

  const usages = (await repo.usagesForAsset(db, id)).map(toUsage);
  const documents = new Map<string, string | null>();

  for (const usage of usages.slice(0, cap)) {
    const cacheKey = `${usage.entityType}:${usage.entityId}`;
    if (documents.has(cacheKey)) continue;
    if (!isDocumentType(usage.entityType)) {
      documents.set(cacheKey, null);
      continue;
    }

    try {
      const row = await getDocumentRow(db, usage.entityType, usage.entityId);
      documents.set(cacheKey, row?.title ?? null);
    } catch {
      documents.set(cacheKey, null);
    }
  }

  return usages.map((usage) => ({
    ...usage,
    title: documents.get(`${usage.entityType}:${usage.entityId}`) ?? null,
    href:
      usage.entityType === "page" || usage.entityType === "article"
        ? `/admin/${usage.entityType}s/${usage.entityId}`
        : null,
  }));
}

function toUsage(row: repo.UsageRow): AssetUsage {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    fieldPath: row.field_path,
  };
}

export async function listFolders() {
  await requirePermission("media.read");
  const db = await createClient();
  return repo.listFolders(db);
}

export async function createFolder(input: {
  name: string;
  slug: string;
  parentId?: string | null;
}) {
  await requirePermission("media.write");
  const db = await createClient();
  return repo.createFolder(db, input);
}

export async function deleteFolder(id: string): Promise<void> {
  await requirePermission("media.write");
  const db = await createClient();
  await repo.deleteFolder(db, id);
}

// ---------------------------------------------------------------------------
// Uploading
// ---------------------------------------------------------------------------

/** SHA-256, hex. `crypto.subtle` is global from Node 18 and the project pins 22. */
export async function checksumOf(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface UploadInput {
  fileName: string;
  mimeType: string;
  bytes: ArrayBuffer;
  folderId?: string | null;
  title?: string | null;
  altText?: string | null;
}

/**
 * Upload, or hand back the asset that already holds these exact bytes.
 *
 * Deduplication happens before the upload rather than after, so re-uploading a
 * hero image that is already in the library costs one query and no storage.
 * 0002 put a `checksum` column and its index there for this; the alternative is
 * a library that accumulates six copies of the same cover by the end of a
 * production week.
 */
export async function uploadAsset(input: UploadInput): Promise<AssetView> {
  const user = await requirePermission("media.write");
  const db = await createClient();

  const kind = mediaKindFromMime(input.mimeType);
  if (!kind) {
    throw new MediaUploadError(
      `"${input.mimeType}" is not a media type this library accepts. ` +
        `Images, video, audio and PDF are.`
    );
  }

  const checksum = await checksumOf(input.bytes);
  const existing = await repo.findAssetByChecksum(db, checksum);
  if (existing) return toAssetView(existing);

  const storagePath = storagePathFor(input.fileName, crypto.randomUUID().slice(0, 8));

  const upload = await db.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, input.bytes, { contentType: input.mimeType, upsert: false });

  if (upload.error) throw new MediaUploadError(upload.error.message);

  try {
    const row = await repo.insertAsset(db, {
      folderId: input.folderId ?? null,
      bucket: MEDIA_BUCKET,
      storagePath,
      kind,
      mimeType: input.mimeType,
      fileName: input.fileName,
      byteSize: input.bytes.byteLength,
      title: input.title ?? null,
      altText: input.altText ?? null,
      checksum,
      createdBy: user.id,
    });
    return toAssetView(row);
  } catch (error) {
    // The object is uploaded but has no catalogue row, which makes it invisible
    // to the library and unreclaimable by anything short of a storage audit.
    // Remove it rather than leave a file nobody can find.
    await db.storage
      .from(MEDIA_BUCKET)
      .remove([storagePath])
      .catch(() => {
        /* The insert failure is the one worth reporting. */
      });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Editing and deleting
// ---------------------------------------------------------------------------

export async function updateAssetMetadata(id: string, metadata: MediaMetadata): Promise<AssetView> {
  await requirePermission("media.write");
  const db = await createClient();

  const row = await repo.updateAssetMetadata(db, id, {
    ...(metadata.title !== undefined ? { title: emptyToNull(metadata.title) } : {}),
    ...(metadata.altText !== undefined ? { altText: emptyToNull(metadata.altText) } : {}),
    ...(metadata.caption !== undefined ? { caption: emptyToNull(metadata.caption) } : {}),
    ...(metadata.credit !== undefined ? { credit: emptyToNull(metadata.credit) } : {}),
    ...(metadata.focalPoint !== undefined ? { focalPoint: metadata.focalPoint as Json } : {}),
    ...(metadata.folderId !== undefined ? { folderId: metadata.folderId } : {}),
  });

  return toAssetView(row);
}

/** A cleared text box means "no value", not an empty string. */
function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

/**
 * Delete an asset, unless something is using it.
 *
 * This refusal is the entire reason `media_usages` exists — 0002's header says
 * so — and it is why reconciliation errs towards leaving a stale row rather
 * than a missing one. The error carries the usages, so the admin can show the
 * editor where to go rather than only telling them no.
 *
 * The catalogue row goes first and the object second. If the object removal
 * fails, the result is an orphaned file: invisible, harmless, and reclaimable.
 * The other order risks a catalogue row pointing at bytes that no longer exist,
 * which renders as a broken image on a published page.
 */
export async function deleteAsset(id: string): Promise<void> {
  await requirePermission("media.delete");
  const db = await createClient();

  const row = await repo.getAsset(db, id);
  if (!row) return;

  const asset = toAssetView(row);
  const usages = await repo.usagesForAsset(db, id);
  if (usages.length > 0) throw new AssetInUseError(asset, usages.map(toUsage));

  await repo.deleteAsset(db, id);

  if (!row.external_url) {
    const removal = await db.storage.from(row.bucket).remove([row.storage_path]);
    if (removal.error) {
      console.error(
        `Deleted the catalogue row for ${row.storage_path} but could not remove the object: ` +
          removal.error.message
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Usage reconciliation
// ---------------------------------------------------------------------------

/**
 * Bring one entity's `media_usages` rows in line with what its block trees
 * actually reference.
 *
 * Called from `documents.saveDraft` on every save. It takes the trees rather
 * than the payload so this module never imports `documents.ts`, which imports
 * it — the cycle would work in ESM and would still be the wrong shape.
 *
 * No permission check of its own: it runs inside a document write that
 * `requirePermission` has already gated, and RLS decides the rest. Worth noting
 * that every seeded role holding a `*.write` on content also holds
 * `media.write` (0001), so this does not quietly fail for a legitimate editor.
 */
export async function reconcileEntityMedia(
  entityType: string,
  entityId: string,
  trees: { path: string; tree: BlockNode[] }[]
): Promise<void> {
  const db = await createClient();

  // Reference → storage path, dropping everything we do not serve: a
  // third-party CDN URL or a /public file has no asset to point at, and
  // recording nothing for it is the honest answer.
  const references = trees.flatMap(({ path, tree }) =>
    collectMediaReferences(tree).map((reference) => ({
      fieldPath: [path, reference.key, reference.fieldPath].filter(Boolean).join("."),
      storagePath: storagePathFromPublicUrl(reference.url),
    }))
  );

  const paths = references
    .map((r) => r.storagePath)
    .filter((path): path is string => path !== null);

  const assets = await repo.findAssetsByStoragePaths(db, MEDIA_BUCKET, paths);
  const idByPath = new Map(assets.map((asset) => [asset.storage_path, asset.id]));

  const usages = references.flatMap((reference) => {
    if (!reference.storagePath) return [];
    const assetId = idByPath.get(reference.storagePath);
    // A URL that looks like ours but names no catalogued asset: the object was
    // deleted, or the URL was typed by hand. Nothing to record either way.
    return assetId ? [{ assetId, fieldPath: reference.fieldPath }] : [];
  });

  await repo.replaceUsagesForEntity(db, entityType, entityId, usages);
}

/**
 * Drop every usage record pointing at an entity that no longer exists.
 *
 * **`media_usages` cannot do this itself, and that is worth stating plainly.**
 * `asset_id` carries `on delete cascade`, so removing an asset takes its usage
 * rows with it. `entity_id` carries no foreign key at all — 0002 made it
 * polymorphic on purpose, so a new content type needs no schema change — which
 * means the database has no way to notice that the page on the other end has
 * been deleted. Without this call, deleting a page would strand its usage rows
 * and leave every asset it referenced permanently undeletable, blocked by a
 * page that no longer exists.
 *
 * Called from `documents.deleteDocument`. Any future entity type that grows a
 * delete path has to call it too; there is no trigger that will cover for it.
 */
export async function clearEntityMedia(entityType: string, entityId: string): Promise<void> {
  const db = await createClient();
  await repo.replaceUsagesForEntity(db, entityType, entityId, []);
}
