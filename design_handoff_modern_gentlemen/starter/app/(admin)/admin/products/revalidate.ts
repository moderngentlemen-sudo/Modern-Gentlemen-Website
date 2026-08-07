import { revalidatePath } from "next/cache";

import { getDocument } from "@/lib/services/documents";
import { publicPathForProduct } from "@/lib/domain/routes";

/**
 * Tell Next the public store changed.
 *
 * Since Phase 7b `/shop` and `/product/[slug]` read `products` and are
 * statically rendered, so without this an editor acts, sees the admin agree
 * with them, opens the site and finds the old catalogue. The hourly
 * `revalidate` in `(site)/layout.tsx` corrects it eventually — that is a
 * backstop, not a feature.
 *
 * **Both paths, always.** A product appears on its own page *and* in the grid,
 * and it is the grid that made this a shared helper rather than two lines in
 * one action: CI caught a deleted product still on `/shop`, because publish
 * revalidated and delete did not. Anything that changes what a visitor sees
 * calls this.
 *
 * `snapshot` and autosave deliberately do not — the first writes history and
 * touches no published payload, the second fires every couple of seconds while
 * an editor types.
 *
 * Lives outside both `actions.ts` files because a `"use server"` module may
 * export only async functions, and because two copies of a rule this easy to
 * half-apply is how the bug happened in the first place.
 */
export async function revalidatePublicProduct(id: string): Promise<void> {
  try {
    const product = await getDocument("product", id);
    if (product) revalidatePath(publicPathForProduct(product.slug));
  } catch (error) {
    // An action that succeeded has succeeded. Failing it because a cache hint
    // could not be sent would report a false failure for something the hourly
    // backstop repairs on its own.
    console.error(`Could not revalidate the public path for product ${id}:`, error);
  }

  // Outside the try, and after the lookup: the grid has to be rebuilt even when
  // the product is already gone, which is exactly the delete case.
  revalidatePath("/shop");
}

/**
 * The delete variant, which must read the slug *before* the row disappears.
 * Returns the path so the caller can revalidate after the delete has happened —
 * revalidating first would rebuild the page from data that is still there.
 */
export async function publicPathBeforeDelete(id: string): Promise<string | null> {
  try {
    const product = await getDocument("product", id);
    return product ? publicPathForProduct(product.slug) : null;
  } catch {
    return null;
  }
}

/** Pair to `publicPathBeforeDelete`, called once the row is gone. */
export function revalidateAfterDelete(path: string | null): void {
  if (path) revalidatePath(path);
  revalidatePath("/shop");
}
