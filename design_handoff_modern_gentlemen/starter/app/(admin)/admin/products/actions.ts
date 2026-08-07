"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createProduct, setProductCollections, updateProductMeta } from "@/lib/services/products";
import { deleteDocument } from "@/lib/services/documents";
import {
  publicPathBeforeDelete,
  revalidateAfterDelete,
  revalidatePublicProduct,
} from "./revalidate";
import {
  PRODUCT_AVAILABILITIES,
  PRODUCT_BADGES,
  PRODUCT_FULFILMENTS,
  productMetaSchema,
} from "@/lib/domain/products";
import type { Json } from "@/lib/db/database.types";
import { ok, type ActionResult } from "../_lib/action-result";
import { toActionResult } from "../_lib/errors";

/**
 * Product actions. Same contract as the pages and articles actions: parse
 * first, call a service, return an `ActionResult` rather than throwing.
 */
const Slug = z
  .string()
  .trim()
  .min(1, "Enter a slug")
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lower-case words separated by hyphens");

const CreateInput = z.object({
  name: z.string().trim().min(1, "Enter a name").max(200),
  slug: Slug,
  fulfilment: z.enum(PRODUCT_FULFILMENTS).optional(),
});

export async function createProductAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const product = await createProduct(parsed.data);
    revalidatePath("/admin/products");
    return ok({ id: product.id });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteProductAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    // Goes through `deleteDocument`, so the product's media usage records are
    // cleared with it. `media_usages.entity_id` has no foreign key to lean on,
    // and a bespoke product delete would leave every asset it referenced
    // permanently undeletable. This is the whole reason products became a
    // document type rather than growing their own CRUD.
    // The slug is read first: after the delete there is no row to read it
    // from, and `/shop` would keep serving the product until the hourly
    // revalidate expired. CI caught exactly that — publish revalidated the
    // grid, delete did not, and the shop page came back one row too tall.
    const publicPath = await publicPathBeforeDelete(parsed.data.id);
    await deleteDocument("product", parsed.data.id);
    revalidatePath("/admin/products");
    revalidateAfterDelete(publicPath);
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}

/**
 * Money arrives as integer pence and stays that way. The form converts pounds
 * at its own boundary through `lib/domain/money.ts`; nothing on this side of
 * the wire ever sees a float. `.int()` here is the second net.
 */
const MetaInput = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Enter a name").max(200),
  slug: Slug,
  cat: z.string().trim().max(80).nullable().optional(),
  catLabel: z.string().trim().max(80).nullable().optional(),
  sku: z.string().trim().max(80).nullable().optional(),
  blurb: z.string().trim().max(1000).nullable().optional(),
  story: z.string().trim().max(8000).nullable().optional(),
  material: z.string().trim().max(300).nullable().optional(),
  fulfilment: z.enum(PRODUCT_FULFILMENTS),
  pricePence: z.number().int().nonnegative(),
  compareAtPence: z.number().int().nonnegative().nullable(),
  stock: z.number().int().nonnegative(),
  trackInventory: z.boolean(),
  availability: z.enum(PRODUCT_AVAILABILITIES),
  badges: z.array(z.enum(PRODUCT_BADGES)).max(3),
  specs: z.array(z.tuple([z.string().trim().min(1), z.string().trim()])).max(40),
  affiliate: z.object({
    merchant_name: z.string().trim().min(1).optional(),
    merchant_url: z.string().trim().url().optional(),
    disclosure: z.string().trim().optional(),
    external_price_pence: z.number().int().nonnegative().optional(),
  }),
  collectionIds: z.array(z.string().uuid()).max(50).optional(),
});

export async function updateProductMetaAction(input: unknown): Promise<ActionResult> {
  const parsed = MetaInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { id, collectionIds, ...patch } = parsed.data;

  // The cross-field rules — an affiliate product needs a working merchant URL,
  // a compare-at price has to be a reduction — live in `productMetaSchema`
  // rather than in the input schema above, because they are facts about a
  // product rather than facts about this form. Checked here so the message and
  // its path reach the editor instead of a 23514 from Postgres.
  const rules = productMetaSchema.safeParse({
    name: patch.name,
    slug: patch.slug,
    fulfilment: patch.fulfilment,
    availability: patch.availability,
    price_pence: patch.pricePence,
    compare_at_pence: patch.compareAtPence,
    stock: patch.stock,
    track_inventory: patch.trackInventory,
    badges: patch.badges,
    specs: patch.specs,
    affiliate: patch.affiliate,
  });
  if (!rules.success) {
    return { ok: false, error: rules.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await updateProductMeta(id, {
      ...patch,
      specs: patch.specs as unknown as Json,
      affiliate: patch.affiliate as unknown as Json,
    });
    if (collectionIds) await setProductCollections(id, collectionIds);

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${id}`);
    // Name, price and badges are all on the card and the PDP. A published
    // product whose price changed is the same staleness as one that was
    // published or deleted, so it gets the same treatment.
    await revalidatePublicProduct(id);
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}
