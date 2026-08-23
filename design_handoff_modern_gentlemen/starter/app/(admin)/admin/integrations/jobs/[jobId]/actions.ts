"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { applyJob, decideAllPending, setItemsDecision } from "@/lib/services/ingestion";
import { revalidatePublicProduct } from "../../../products/revalidate";
import { ok, type ActionResult } from "../../../_lib/action-result";
import { toActionResult } from "../../../_lib/errors";

/**
 * Review actions: approve, reject, apply.
 *
 * `applyJobAction` revalidates the public store through the products helper
 * rather than calling `revalidatePath` itself. That helper exists because the
 * rule is easy to half-apply — PROGRESS.md records CI catching a deleted product
 * still on `/shop` because publish revalidated and delete did not — and an
 * import that writes twenty products is the widest instance of it yet.
 *
 * It revalidates once per written product plus `/shop`, which is the honest
 * cost: a run touching two hundred products issues two hundred cache hints. If
 * that ever becomes the slow part, the fix is a batched revalidation, not
 * skipping the ones past some threshold — a stale PDP looks exactly like a
 * working one.
 */

const Decision = z.object({
  jobId: z.string().uuid(),
  itemIds: z.array(z.string().uuid()).min(1),
  decision: z.enum(["approved", "rejected"]),
});

function invalid(error: z.ZodError): ActionResult<never> {
  const issue = error.issues[0];
  const path = issue?.path.join(".");
  return {
    ok: false,
    error: path ? `${path}: ${issue?.message}` : (issue?.message ?? "Invalid input"),
  };
}

export async function decideItemsAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  const parsed = Decision.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    const count = await setItemsDecision(
      parsed.data.jobId,
      parsed.data.itemIds,
      parsed.data.decision
    );
    revalidatePath(`/admin/integrations/jobs/${parsed.data.jobId}`);
    return ok({ count });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function decideAllAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  const parsed = z
    .object({ jobId: z.string().uuid(), decision: z.enum(["approved", "rejected"]) })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    const count = await decideAllPending(parsed.data.jobId, parsed.data.decision);
    revalidatePath(`/admin/integrations/jobs/${parsed.data.jobId}`);
    return ok({ count });
  } catch (error) {
    return toActionResult(error);
  }
}

export interface ApplySummary {
  applied: number;
  failed: number;
  errors: string[];
  /** Photographs fetched and attached — reported because they cost the run its time. */
  imagesImported: number;
  /** Photographs left for a later apply. The import is idempotent; re-running picks them up. */
  imagesSkipped: number;
}

export async function applyJobAction(input: unknown): Promise<ActionResult<ApplySummary>> {
  const parsed = z.object({ jobId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    const result = await applyJob(parsed.data.jobId);

    for (const productId of result.productIds) {
      await revalidatePublicProduct(productId);
    }

    revalidatePath(`/admin/integrations/jobs/${parsed.data.jobId}`);
    revalidatePath("/admin/products");

    return ok({
      applied: result.applied,
      failed: result.failed,
      errors: result.errors,
      imagesImported: result.imagesImported,
      imagesSkipped: result.imagesSkipped,
    });
  } catch (error) {
    return toActionResult(error);
  }
}
