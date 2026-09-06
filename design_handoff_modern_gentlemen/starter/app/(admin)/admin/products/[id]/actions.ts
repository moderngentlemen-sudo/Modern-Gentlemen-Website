"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { saveDraft } from "@/lib/services/documents";
import { publish, rollback, snapshot, unpublish } from "@/lib/services/publishing";
import { createPreview } from "@/lib/services/preview";
import { setTemplateOverrideForEntry } from "@/lib/services/templates";
import { revalidatePublicProduct } from "../revalidate";
import type { Json } from "@/lib/db/database.types";
import { ok, type ActionResult } from "../../_lib/action-result";
import { toActionResult } from "../../_lib/errors";

/**
 * The product builder's bridge to the services.
 *
 * Deliberately written out rather than generated from a shared factory over the
 * document type — the same reasoning the article actions record. A `"use
 * server"` module may export only async functions and Next assigns each export
 * an action id at build time; a factory-produced export would probably work,
 * and "probably" plus a failure mode that only appears when a real browser
 * opens a real page is what broke every builder load in Phase 4.
 *
 * The services underneath are entirely type-agnostic — `publish("product", …)`
 * runs the same SQL transaction as `publish("page", …)` and asserts
 * `product.publish` inside the function rather than trusting this layer.
 *
 * **No `scheduleAction` here, and that is deliberate.** `products` has no
 * `scheduled_for` column (`0005` gave its status CHECK a 'scheduled' value and
 * no column to hold the date), so `product` is absent from `SCHEDULABLE_TYPES`
 * and from `schedulable_document_table()`. Offering the control would produce a
 * constraint violation rather than a schedule.
 */
const Id = z.string().uuid();

/**
 * Structural validation only; content validation is the manifests' job and
 * happens at publish. `sections` is `BLOCK_TREE_KEY.product`, and `passthrough`
 * is what carries `seo` through a save untouched.
 */
const BlockNodeish = z.object({ _key: z.string().min(1), _type: z.string().min(1) }).passthrough();
const SavePayload = z.object({ sections: z.array(BlockNodeish) }).passthrough();

function revalidateProduct(id: string): void {
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
}

export async function saveDraftAction(input: unknown): Promise<ActionResult<{ savedAt: string }>> {
  const parsed = z.object({ id: Id, payload: SavePayload }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "That product payload is not in a valid shape." };

  try {
    await saveDraft("product", parsed.data.id, parsed.data.payload as Json);
    // No revalidatePath: autosave fires every couple of seconds while an editor
    // types, and busting the route cache on each burst is pure churn.
    return ok({ savedAt: new Date().toISOString() });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function publishAction(input: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = z.object({ id: Id, note: z.string().trim().max(500).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    const version = await publish("product", parsed.data.id, parsed.data.note);
    revalidateProduct(parsed.data.id);
    await revalidatePublicProduct(parsed.data.id);
    return ok({ version });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function unpublishAction(input: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = z.object({ id: Id, note: z.string().trim().max(500).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    const version = await unpublish("product", parsed.data.id, parsed.data.note);
    revalidateProduct(parsed.data.id);
    await revalidatePublicProduct(parsed.data.id);
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
    const version = await snapshot("product", parsed.data.id, parsed.data.label);
    revalidateProduct(parsed.data.id);
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
      "product",
      parsed.data.id,
      parsed.data.version,
      parsed.data.note
    );
    revalidateProduct(parsed.data.id);
    await revalidatePublicProduct(parsed.data.id);
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
      type: "product",
      entityId: parsed.data.id,
      device: parsed.data.device,
    });
    return ok({ path: preview.path, expiresAt: preview.expiresAt });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function setProductTemplateOverrideAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: Id, templateId: z.string().uuid().nullable() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    await setTemplateOverrideForEntry("product", parsed.data.id, parsed.data.templateId);
    revalidatePath(`/admin/products/${parsed.data.id}`);
    revalidatePath(`/admin/products/${parsed.data.id}/builder`);
    await revalidatePublicProduct(parsed.data.id);
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}
