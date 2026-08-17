"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDocument, saveDraft } from "@/lib/services/documents";
import { publish, rollback, snapshot, unpublish } from "@/lib/services/publishing";
import { createPreview } from "@/lib/services/preview";
import { publicPathForCategory } from "@/lib/domain/routes";
import type { Json } from "@/lib/db/database.types";
import { ok, type ActionResult } from "../../_lib/action-result";
import { toActionResult } from "../../_lib/errors";

/**
 * The builder's bridge to the services, for category pages.
 *
 * The page route's shape, with one difference that is the whole point of the
 * slice: **publishing a category changes a page that is already live.**
 * `/[category]` has rendered `categories.published_data` since Phase 7c and had
 * no editor until `0021`, so unlike a pattern this must revalidate a public
 * path or the editor publishes into a statically rendered file nobody rebuilds.
 */
const Id = z.string().uuid();

/** Structural validation only; content validation is the manifests' job at publish. */
const BlockNodeish = z.object({ _key: z.string().min(1), _type: z.string().min(1) }).passthrough();

const SavePayload = z.object({ sections: z.array(BlockNodeish) }).passthrough();

export async function saveDraftAction(input: unknown): Promise<ActionResult<{ savedAt: string }>> {
  const parsed = z.object({ id: Id, payload: SavePayload }).safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "That category payload is not in a valid shape." };

  try {
    await saveDraft("category", parsed.data.id, parsed.data.payload as Json);
    // No revalidatePath: autosave fires every couple of seconds while an editor
    // types, and busting the route cache on each keystroke burst would be churn.
    return ok({ savedAt: new Date().toISOString() });
  } catch (error) {
    return toActionResult(error);
  }
}

function revalidateCategoryAdmin(id: string): void {
  revalidatePath("/admin/taxonomy");
  revalidatePath(`/admin/categories/${id}`);
}

/**
 * Refresh the public category page.
 *
 * The extra read is the price of the actions holding an id while the path is
 * keyed on the slug — the same trade `app/(admin)/admin/pages/[id]/actions.ts`
 * makes, and it costs one query on an action a person performs by hand.
 *
 * A publish that succeeded has succeeded, so a failure to send the cache hint
 * is logged rather than surfaced: the hourly `revalidate` backstop corrects it,
 * and reporting a false failure would be worse.
 */
async function revalidatePublicCategory(id: string): Promise<void> {
  try {
    const category = await getDocument("category", id);
    if (category) revalidatePath(publicPathForCategory(category.slug));
  } catch (error) {
    console.error(`Published category ${id} but could not revalidate its public path:`, error);
  }
}

export async function publishAction(input: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = z.object({ id: Id, note: z.string().trim().max(500).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    const version = await publish("category", parsed.data.id, parsed.data.note);
    revalidateCategoryAdmin(parsed.data.id);
    await revalidatePublicCategory(parsed.data.id);
    return ok({ version });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function unpublishAction(input: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = z.object({ id: Id, note: z.string().trim().max(500).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    const version = await unpublish("category", parsed.data.id, parsed.data.note);
    revalidateCategoryAdmin(parsed.data.id);
    await revalidatePublicCategory(parsed.data.id);
    return ok({ version });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function snapshotAction(input: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = z
    .object({ id: Id, label: z.string().trim().max(200).optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    const version = await snapshot("category", parsed.data.id, parsed.data.label);
    revalidateCategoryAdmin(parsed.data.id);
    return ok({ version });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function rollbackAction(input: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = z
    .object({
      id: Id,
      version: z.number().int().nonnegative(),
      note: z.string().max(500).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    const version = await rollback(
      "category",
      parsed.data.id,
      parsed.data.version,
      parsed.data.note
    );
    revalidateCategoryAdmin(parsed.data.id);
    await revalidatePublicCategory(parsed.data.id);
    return ok({ version });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function createPreviewAction(
  input: unknown
): Promise<ActionResult<{ path: string; expiresAt: string }>> {
  const parsed = z
    .object({ id: Id, device: z.enum(["desktop", "tablet", "mobile"]).optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    const preview = await createPreview({
      type: "category",
      entityId: parsed.data.id,
      device: parsed.data.device,
    });
    return ok({ path: preview.path, expiresAt: preview.expiresAt });
  } catch (error) {
    return toActionResult(error);
  }
}
