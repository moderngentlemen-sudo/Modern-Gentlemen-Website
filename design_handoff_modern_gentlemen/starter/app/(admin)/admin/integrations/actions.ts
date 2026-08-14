"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSource, deleteSource } from "@/lib/services/ingestion";
import { PRODUCT_SOURCE_KINDS } from "@/lib/domain/ingestion";
import { ok, type ActionResult } from "../_lib/action-result";
import { toActionResult } from "../_lib/errors";

/**
 * Source-list actions.
 *
 * One export per operation, written out rather than generated — the reason the
 * theme, navigation and article actions all record: a `"use server"` module may
 * export only async functions, and Next assigns each export an action id at
 * build time.
 *
 * No permission check here. `lib/services/ingestion.ts` asserts
 * `integration.write` on both of these and RLS re-asserts it underneath.
 */

const Create = z.object({
  name: z.string().trim().min(1, "A source needs a name."),
  kind: z.enum(PRODUCT_SOURCE_KINDS),
  url: z.string().trim().min(1, "A feed needs a URL."),
  itemPath: z.string().trim().min(1, "Name the repeating element."),
});

function invalid(error: z.ZodError): ActionResult<never> {
  const issue = error.issues[0];
  const path = issue?.path.join(".");
  return {
    ok: false,
    error: path ? `${path}: ${issue?.message}` : (issue?.message ?? "Invalid input"),
  };
}

export async function createSourceAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = Create.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    const created = await createSource({
      kind: parsed.data.kind,
      name: parsed.data.name,
      config: { url: parsed.data.url, item_path: parsed.data.itemPath },
    });
    revalidatePath("/admin/integrations");
    return ok(created);
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteSourceAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    await deleteSource(parsed.data.id);
    revalidatePath("/admin/integrations");
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}
