"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createCollection, deleteCollection, updateCollection } from "@/lib/services/products";
import { ok, type ActionResult } from "../../_lib/action-result";
import { toActionResult } from "../../_lib/errors";

const Id = z.string().uuid();

const Slug = z
  .string()
  .trim()
  .min(1, "Enter a slug")
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lower-case words separated by hyphens");

function revalidateCollections(): void {
  revalidatePath("/admin/products");
  revalidatePath("/admin/products/collections");
}

export async function createCollectionAction(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Enter a name").max(200),
      slug: Slug,
      description: z.string().trim().max(1000).nullable().optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const collection = await createCollection(parsed.data);
    revalidateCollections();
    return ok({ id: collection.id });
  } catch (error) {
    return toActionResult(error);
  }
}

/**
 * Editing a collection never re-derives its slug from its name.
 *
 * The slug is a live URL; quietly changing it because someone fixed a typo in a
 * name would break every link to it. Slug auto-fill is a create-time
 * convenience only — the same stance `lib/services/taxonomy.ts` takes, recorded
 * there for the same reason.
 */
export async function updateCollectionAction(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({
      id: Id,
      name: z.string().trim().min(1, "Enter a name").max(200).optional(),
      slug: Slug.optional(),
      description: z.string().trim().max(1000).nullable().optional(),
      position: z.number().int().nonnegative().optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { id, ...patch } = parsed.data;

  try {
    await updateCollection(id, patch);
    revalidateCollections();
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteCollectionAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: Id }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    // `product_collection_items` cascades, so the products this held are
    // untouched and simply stop being listed under it.
    await deleteCollection(parsed.data.id);
    revalidateCollections();
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}
