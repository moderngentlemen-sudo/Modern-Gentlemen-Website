/**
 * Media — pure rules for the asset catalogue.
 *
 * Everything here is decided without touching the network: which `kind` a MIME
 * type belongs to, what object key a filename becomes, and — the piece usage
 * tracking depends on — how to get from a public URL on a rendered page back to
 * the storage path the catalogue stores.
 *
 * That last direction is what makes URL-valued `image`/`video` fields workable.
 * Blocks store the asset's public URL, exactly as they did before the library
 * existed, so no manifest changes and the public site is untouched. Usage
 * extraction reverses the URL to a storage path and looks the asset up. A URL
 * that is not ours simply yields `null` and produces no usage row, which is the
 * honest answer: we do not own it and cannot say anything about it.
 */

import { z } from "zod";

/** The one bucket this project owns. Matches `media_assets.bucket`'s default. */
export const MEDIA_BUCKET = "media";

/** Mirrors the check constraint on `media_assets.kind` in 0002_media.sql. */
export const MEDIA_KINDS = ["image", "video", "gif", "audio", "document"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export interface FocalPoint {
  x: number;
  y: number;
}

export const CENTRE: FocalPoint = { x: 0.5, y: 0.5 };

export const focalPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

/** The catalogue row, in the shape the admin actually consumes. */
export interface MediaAsset {
  id: string;
  folderId: string | null;
  bucket: string;
  storagePath: string;
  externalUrl: string | null;
  kind: MediaKind;
  mimeType: string;
  fileName: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  placeholder: string | null;
  title: string | null;
  altText: string | null;
  caption: string | null;
  credit: string | null;
  focalPoint: FocalPoint;
  checksum: string | null;
  createdAt: string;
}

/** Editable metadata. The bytes are immutable; only the description changes. */
export const mediaMetadataSchema = z.object({
  title: z.string().max(200).optional(),
  altText: z.string().max(500).optional(),
  caption: z.string().max(1000).optional(),
  credit: z.string().max(200).optional(),
  focalPoint: focalPointSchema.optional(),
  folderId: z.string().uuid().nullable().optional(),
});

export type MediaMetadata = z.infer<typeof mediaMetadataSchema>;

// ---------------------------------------------------------------------------
// MIME → kind
// ---------------------------------------------------------------------------

/**
 * `gif` is its own kind rather than an image, because editors treat it as one:
 * it is the thing you reach for when you want motion without a video element,
 * and the library's filters are more useful if it can be picked out. The check
 * constraint in 0002 already anticipated that.
 */
export function mediaKindFromMime(mimeType: string): MediaKind | null {
  const mime = mimeType.trim().toLowerCase();

  if (mime === "image/gif") return "gif";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "document";
  return null;
}

/** Which field kinds a given asset may be dropped into by the picker. */
export function isPickableAs(kind: MediaKind, fieldKind: "image" | "video"): boolean {
  return fieldKind === "image" ? kind === "image" || kind === "gif" : kind === "video";
}

// ---------------------------------------------------------------------------
// Filenames → object keys
// ---------------------------------------------------------------------------

/**
 * A storage-safe stem. Supabase accepts far more than this, but object keys end
 * up inside URLs on a public site, and a key that survives copy-paste, a CDN
 * and someone's CMS unaltered is worth more than preserving the original
 * spelling of "Ferrari 250 GTO (final)·v2.JPG".
 */
export function slugifyFileName(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  const hasExtension = lastDot > 0;
  const stem = hasExtension ? fileName.slice(0, lastDot) : fileName;
  const extension = hasExtension ? fileName.slice(lastDot + 1) : "";

  const slug = stem
    .normalize("NFKD")
    // Strip combining marks, so "é" becomes "e" rather than disappearing.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  const ext = extension.toLowerCase().replace(/[^a-z0-9]/g, "");
  const base = slug || "asset";

  return ext ? `${base}.${ext}` : base;
}

/**
 * The object key for an upload: `YYYY/MM/<random>-<slug>`.
 *
 * Date-partitioned so no single prefix accumulates every asset the site has
 * ever held, and prefixed with a random token so two uploads of `hero.jpg` in
 * the same month cannot collide. Deduplication is `checksum`'s job, at the
 * catalogue level, and it runs before this is ever called — identical bytes
 * resolve to the existing asset rather than reaching a second upload.
 *
 * `token` is injected rather than generated so this stays pure and testable;
 * the service passes `crypto.randomUUID().slice(0, 8)`.
 */
export function storagePathFor(fileName: string, token: string, now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}/${month}/${token}-${slugifyFileName(fileName)}`;
}

// ---------------------------------------------------------------------------
// Storage paths ⇄ public URLs
// ---------------------------------------------------------------------------

/**
 * Two shapes serve a public object. `/object/public/` is the plain byte URL;
 * `/render/image/public/` is the same object through the image transformer, and
 * is what a `width=`-bearing URL in a block will look like. Both must reverse to
 * the same storage path, or resizing an image in the builder would orphan its
 * usage record.
 */
const PUBLIC_URL_SEGMENTS = ["/storage/v1/object/public/", "/storage/v1/render/image/public/"];

export function publicUrlFor(
  supabaseUrl: string,
  storagePath: string,
  bucket = MEDIA_BUCKET
): string {
  const origin = supabaseUrl.replace(/\/+$/, "");
  const path = storagePath.replace(/^\/+/, "");
  return `${origin}/storage/v1/object/public/${bucket}/${encodeURI(path)}`;
}

// ---------------------------------------------------------------------------
// References to an asset
// ---------------------------------------------------------------------------

/**
 * Somewhere an asset is used. Structurally identical to `AssetUsage` in
 * `lib/services/media.ts`, which is what a `media_usages` row becomes — and
 * deliberately so, because the two are the same idea arriving from two tables.
 */
export interface AssetReference {
  id: string;
  entityType: string;
  entityId: string;
  fieldPath: string | null;
}

/** The synthetic `id` prefix for a gallery reference. */
export const GALLERY_REFERENCE_PREFIX = "gallery:";

/**
 * Product galleries, as references.
 *
 * `media_usages` is reconciled from block trees on save and knows nothing about
 * `product_media`, which the products admin writes directly. So an asset can be
 * the hero photograph on six product pages and look entirely unreferenced.
 *
 * The `id` is composite because there is no row of its own to borrow one from:
 * `product_media`'s primary key is (product_id, asset_id). It only has to be
 * stable and unique within one asset's reference list — it is a React key, not
 * anything the database will ever be asked about.
 */
export function galleryReferences(productIds: string[]): AssetReference[] {
  return productIds.map((productId) => ({
    id: `${GALLERY_REFERENCE_PREFIX}${productId}`,
    entityType: "product",
    entityId: productId,
    fieldPath: "gallery",
  }));
}

/**
 * The inverse. Returns `null` for any URL this project does not serve — a
 * third-party CDN, a `/public` file, a relative path — which is exactly the set
 * of things we cannot record a usage for.
 *
 * Deliberately tolerant of the origin: the same asset is reachable through the
 * project's `*.supabase.co` host and through any custom storage domain put in
 * front of it, and a usage record that only matched one of them would report an
 * in-use asset as safe to delete. The bucket-scoped path is the identity.
 */
export function storagePathFromPublicUrl(url: string, bucket = MEDIA_BUCKET): string | null {
  if (typeof url !== "string" || url === "") return null;

  // Query strings carry transform parameters (`?width=800`); the object is the
  // same one either way. A fragment cannot appear on a storage URL but costs
  // nothing to drop.
  const withoutQuery = url.split(/[?#]/, 1)[0];

  for (const segment of PUBLIC_URL_SEGMENTS) {
    const at = withoutQuery.indexOf(`${segment}${bucket}/`);
    if (at === -1) continue;

    const path = withoutQuery.slice(at + segment.length + bucket.length + 1);
    if (path === "") return null;

    try {
      return decodeURI(path);
    } catch {
      // A malformed percent-escape is not ours to interpret.
      return null;
    }
  }

  return null;
}

/** Human file size for the library's asset cards. Binary units, one decimal. */
export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  // Whole numbers read better without a trailing ".0" — "2 MB", not "2.0 MB".
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} ${units[unit]}`;
}
