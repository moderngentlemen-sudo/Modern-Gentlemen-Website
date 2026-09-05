"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  AssetInUseError,
  createFolder,
  deleteAsset,
  deleteFolder,
  getAssetUsageViews,
  listAssets,
  listTags,
  updateAssetMetadata,
  uploadAsset,
  type AssetUsageView,
  type AssetView,
} from "@/lib/services/media";
import {
  MAX_MEDIA_UPLOAD_BYTES,
  MEDIA_UPLOAD_SIZE_MESSAGE,
  mediaMetadataSchema,
} from "@/lib/domain/media";
import { ok, type ActionResult } from "../_lib/action-result";
import { toActionResult } from "../_lib/errors";

/**
 * Media library actions.
 *
 * Same contract as every other admin action: parse the input, call a service,
 * return an `ActionResult` rather than throwing. An exception crossing the
 * server boundary arrives as a digest with no message, so a refusal an editor
 * caused has to come back as data they can read.
 */

/**
 * Upload takes `FormData` rather than a parsed object, because a File cannot
 * survive being put through a Zod object and back — the bytes are the point.
 * Its fields are still validated individually below.
 */
export async function uploadAssetAction(formData: FormData): Promise<ActionResult<AssetView>> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a file to upload." };
  }

  if (file.size > MAX_MEDIA_UPLOAD_BYTES) return { ok: false, error: MEDIA_UPLOAD_SIZE_MESSAGE };

  const folderId = formData.get("folderId");

  try {
    const asset = await uploadAsset({
      fileName: file.name,
      // Browsers occasionally send an empty type for an unrecognised extension;
      // the service refuses it by name rather than uploading something it
      // cannot classify.
      mimeType: file.type || "application/octet-stream",
      bytes: await file.arrayBuffer(),
      folderId: typeof folderId === "string" && folderId !== "" ? folderId : null,
    });

    revalidatePath("/admin/media");
    return ok(asset);
  } catch (error) {
    return toActionResult(error);
  }
}

const MetadataInput = z.object({ id: z.string().uuid() }).and(mediaMetadataSchema);

export async function updateAssetAction(input: unknown): Promise<ActionResult<AssetView>> {
  const parsed = MetadataInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const { id, ...metadata } = parsed.data;
    const asset = await updateAssetMetadata(id, metadata);
    revalidatePath("/admin/media");
    return ok(asset);
  } catch (error) {
    return toActionResult(error);
  }
}

/**
 * Deleting is where the usage records earn their keep. `AssetInUseError` is
 * translated here rather than in `_lib/errors.ts` so the refusal can carry the
 * list of places to go and fix — a bare "cannot delete" would leave the editor
 * hunting.
 */
export async function deleteAssetAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    await deleteAsset(parsed.data.id);
    revalidatePath("/admin/media");
    return ok(undefined);
  } catch (error) {
    if (error instanceof AssetInUseError) return { ok: false, error: error.message };
    return toActionResult(error);
  }
}

export async function assetUsagesAction(input: unknown): Promise<ActionResult<AssetUsageView[]>> {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    return ok(await getAssetUsageViews(parsed.data.id));
  } catch (error) {
    return toActionResult(error);
  }
}

const SearchInput = z.object({
  search: z.string().max(200).optional(),
  kind: z.string().max(20).optional(),
  folderId: z.string().uuid().nullable().optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
  tagSlug: z.string().max(60).optional(),
});

/** The picker's data source, and the library's own search. */
export async function listAssetsAction(
  input: unknown
): Promise<ActionResult<{ assets: AssetView[]; total: number }>> {
  const parsed = SearchInput.safeParse(input ?? {});
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    return ok(await listAssets(parsed.data));
  } catch (error) {
    return toActionResult(error);
  }
}

export async function listMediaTagsAction(): Promise<
  ActionResult<Awaited<ReturnType<typeof listTags>>>
> {
  try {
    return ok(await listTags());
  } catch (error) {
    return toActionResult(error);
  }
}

const FolderInput = z.object({
  name: z.string().trim().min(1, "Name the folder").max(80),
  parentId: z.string().uuid().nullable().optional(),
});

export async function createFolderAction(input: unknown): Promise<ActionResult> {
  const parsed = FolderInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // The slug is derived rather than asked for: it is unique per parent, and a
  // folder is a filing device, not a route. Nothing links to it by slug.
  const slug =
    parsed.data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "folder";

  try {
    await createFolder({ name: parsed.data.name, slug, parentId: parsed.data.parentId ?? null });
    revalidatePath("/admin/media");
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteFolderAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    // Assets inside fall back to the root — `on delete set null` in 0002. The
    // confirmation in the UI says so; nothing here destroys an asset.
    await deleteFolder(parsed.data.id);
    revalidatePath("/admin/media");
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}
