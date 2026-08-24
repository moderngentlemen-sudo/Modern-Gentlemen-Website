"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  attachProductMedia,
  createVariant,
  deleteVariant,
  detachProductMedia,
  updateVariant,
} from "@/lib/services/products";
import { PRODUCT_AVAILABILITIES, PRODUCT_MEDIA_ROLES } from "@/lib/domain/products";
import { revalidatePublicProduct } from "../revalidate";
import { ok, type ActionResult } from "../../_lib/action-result";
import { toActionResult } from "../../_lib/errors";

/**
 * Variants and the gallery.
 *
 * Kept out of `actions.ts` next door, which is the builder's bridge to the
 * publishing services and has a different audience. Same contract: parse first,
 * call a service, return an `ActionResult` rather than throwing — and written
 * out one export at a time for the reason the article actions record.
 *
 * ⚠️ **Every one of these revalidates the public product too, and until the
 * variant picker shipped none of them did.** `revalidate.ts` states the rule —
 * "anything that changes what a visitor sees calls this" — and these five were
 * the exception, revalidating only the admin screen they were invoked from.
 *
 * For variants that exception was invisible, because variants had no public
 * surface to go stale. **For the gallery it was a live bug**: `galleryUrls` in
 * `lib/services/publicCatalog.ts` has read `product_media` since Phase 7b, so
 * an editor who added a photograph saw the admin agree with them and the PDP
 * keep the old one for up to an hour. Exactly the failure the shared helper was
 * extracted to prevent, in the one file that never called it.
 */
const Id = z.string().uuid();

const VariantInput = z.object({
  productId: Id,
  title: z.string().trim().min(1, "Enter a title").max(200),
  sku: z.string().trim().max(80).nullable().optional(),
  // Integer pence, and nullable on purpose: null means "whatever the product
  // costs". Writing the product's price onto every variant instead would fork
  // one number into as many rows as there are sizes.
  pricePence: z.number().int().nonnegative().nullable().optional(),
  stock: z.number().int().nonnegative().optional(),
  position: z.number().int().nonnegative().optional(),
});

export async function createVariantAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = VariantInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const variant = await createVariant(parsed.data);
    revalidatePath(`/admin/products/${parsed.data.productId}`);
    await revalidatePublicProduct(parsed.data.productId);
    return ok({ id: variant.id });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function updateVariantAction(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({
      id: Id,
      productId: Id,
      title: z.string().trim().min(1, "Enter a title").max(200).optional(),
      sku: z.string().trim().max(80).nullable().optional(),
      pricePence: z.number().int().nonnegative().nullable().optional(),
      stock: z.number().int().nonnegative().optional(),
      availability: z.enum(PRODUCT_AVAILABILITIES).optional(),
      position: z.number().int().nonnegative().optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { id, productId, ...patch } = parsed.data;

  try {
    await updateVariant(id, patch);
    revalidatePath(`/admin/products/${productId}`);
    await revalidatePublicProduct(productId);
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteVariantAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: Id, productId: Id }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    await deleteVariant(parsed.data.id);
    revalidatePath(`/admin/products/${parsed.data.productId}`);
    await revalidatePublicProduct(parsed.data.productId);
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}

export async function attachProductMediaAction(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({
      productId: Id,
      assetId: Id,
      role: z.enum(PRODUCT_MEDIA_ROLES).optional(),
      position: z.number().int().nonnegative().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const { productId, ...rest } = parsed.data;

  try {
    await attachProductMedia(productId, rest);
    revalidatePath(`/admin/products/${productId}`);
    await revalidatePublicProduct(productId);
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}

export async function detachProductMediaAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ productId: Id, assetId: Id }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    await detachProductMedia(parsed.data.productId, parsed.data.assetId);
    revalidatePath(`/admin/products/${parsed.data.productId}`);
    await revalidatePublicProduct(parsed.data.productId);
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}
