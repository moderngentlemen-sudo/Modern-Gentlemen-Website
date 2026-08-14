"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createPattern } from "@/lib/services/patterns";
import { deleteDocument, setDocumentStatus } from "@/lib/services/documents";
import { DOCUMENT_STATUSES } from "@/lib/domain/documents";
import { ok, type ActionResult } from "../_lib/action-result";
import { toActionResult } from "../_lib/errors";

/**
 * Pattern-list actions.
 *
 * Same stance as the page list: parse before touching a service. The permission
 * check and RLS both sit underneath, and neither validates shape.
 */
const Key = z
  .string()
  .trim()
  .min(1, "Enter a key")
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lower-case words separated by hyphens");

const CreateInput = z.object({
  name: z.string().trim().min(1, "Enter a name").max(200),
  key: Key,
});

export async function createPatternAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    // ⚠️ `syncMode` is deliberately NOT taken from the client, and every pattern
    // created here is `detachable`.
    //
    // A synced pattern stores a `_ref` in the page and is expanded at render
    // time by `expandPatternRefs` — which today has exactly one caller,
    // `/preview/[token]`. No public route expands refs, so a synced pattern
    // would render correctly in preview and silently vanish from the live site:
    // the worst failure shape there is, because the person checking their work
    // sees it working. Offering the option before the public path expands refs
    // would ship that trap to an editor. See PROGRESS.md.
    const pattern = await createPattern({
      name: parsed.data.name,
      key: parsed.data.key,
      syncMode: "detachable",
      blocks: [],
    });
    revalidatePath("/admin/patterns");
    return ok({ id: pattern.id });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deletePatternAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    await deleteDocument("pattern", parsed.data.id);
    revalidatePath("/admin/patterns");
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}

const StatusInput = z.object({
  id: z.string().uuid(),
  status: z.enum(DOCUMENT_STATUSES),
});

export async function setPatternStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = StatusInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    await setDocumentStatus("pattern", parsed.data.id, parsed.data.status);
    revalidatePath("/admin/patterns");
    revalidatePath(`/admin/patterns/${parsed.data.id}`);
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}
