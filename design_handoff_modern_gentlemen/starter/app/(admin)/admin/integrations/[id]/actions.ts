"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { runImport, saveMappings, updateSource } from "@/lib/services/ingestion";
import { FEED_TRANSFORMS } from "@/lib/domain/ingestion";
import { PRODUCT_FULFILMENTS } from "@/lib/domain/products";
import { ok, type ActionResult } from "../../_lib/action-result";
import { toActionResult } from "../../_lib/errors";

/**
 * Source-detail actions: configure, map, run.
 *
 * `runImportAction` is the one worth reading twice. It returns `ok` even when
 * the run failed, because a failed *run* is not a failed *action* — the job row
 * exists, it records why, and the operator needs the link to it. Only a refusal
 * before the run started (a disabled source, an unmapped `external_id`) comes
 * back as `ok: false`, because then there is nothing to link to.
 */

const Config = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "A source needs a name."),
  enabled: z.boolean(),
  url: z.string().trim().min(1),
  itemPath: z.string().trim().min(1),
  fulfilment: z.enum(PRODUCT_FULFILMENTS),
  currency: z.string().trim().length(3),
  credentialsRef: z.string().trim().nullable(),
});

const Mappings = z.object({
  id: z.string().uuid(),
  mappings: z.array(
    z.object({
      target_field: z.string(),
      source_path: z.string(),
      transform: z.enum(FEED_TRANSFORMS).nullable(),
      fallback: z.string().nullable(),
      is_required: z.boolean(),
    })
  ),
});

function invalid(error: z.ZodError): ActionResult<never> {
  const issue = error.issues[0];
  const path = issue?.path.join(".");
  return {
    ok: false,
    error: path ? `${path}: ${issue?.message}` : (issue?.message ?? "Invalid input"),
  };
}

export async function saveSourceAction(input: unknown): Promise<ActionResult> {
  const parsed = Config.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    await updateSource(parsed.data.id, {
      name: parsed.data.name,
      enabled: parsed.data.enabled,
      config: {
        url: parsed.data.url,
        item_path: parsed.data.itemPath,
        fulfilment: parsed.data.fulfilment,
        currency: parsed.data.currency.toUpperCase(),
      },
      credentialsRef: parsed.data.credentialsRef || null,
    });
    revalidatePath(`/admin/integrations/${parsed.data.id}`);
    revalidatePath("/admin/integrations");
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}

export async function saveMappingsAction(input: unknown): Promise<ActionResult> {
  const parsed = Mappings.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    await saveMappings(parsed.data.id, parsed.data.mappings);
    revalidatePath(`/admin/integrations/${parsed.data.id}`);
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}

export interface RunSummary {
  jobId: string;
  status: "review" | "completed" | "failed";
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  error?: string;
}

export async function runImportAction(input: unknown): Promise<ActionResult<RunSummary>> {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    const result = await runImport(parsed.data.id);
    revalidatePath(`/admin/integrations/${parsed.data.id}`);
    revalidatePath("/admin/integrations");
    return ok({
      jobId: result.jobId,
      status: result.status,
      total: result.counts.total,
      created: result.counts.created,
      updated: result.counts.updated,
      unchanged: result.counts.unchanged,
      failed: result.counts.failed,
      error: result.error,
    });
  } catch (error) {
    return toActionResult(error);
  }
}
