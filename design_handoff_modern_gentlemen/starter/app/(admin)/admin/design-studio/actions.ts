"use server";
import { revalidatePath } from "next/cache";
import { saveStudioPage, loadStudioPage } from "@/lib/services/studioPublishing";
import { ok } from "../_lib/action-result";
import { toActionResult } from "../_lib/errors";
import { createPreviewAction, publishAction } from "../pages/[id]/actions";
import { z } from "zod";

const savedInput = z.object({ id: z.string().uuid(), expectedUpdatedAt: z.string().min(1) });
async function checkSaved(input: unknown) {
  const parsed = savedInput.safeParse(input);
  if (!parsed.success) throw new Error("Save this Studio page before continuing.");
  const page = await loadStudioPage(parsed.data.id);
  if (page.updatedAt !== parsed.data.expectedUpdatedAt)
    throw new Error(
      "This page changed after your last save. Reopen and review it before continuing."
    );
  if (page.issues.length)
    throw new Error("Resolve this page's publishing checks before continuing.");
  return page.id;
}
export async function previewStudioAction(input: unknown) {
  try {
    return await createPreviewAction({ id: await checkSaved(input) });
  } catch (error) {
    return toActionResult(error);
  }
}
export async function publishStudioAction(input: unknown) {
  try {
    return await publishAction({ id: await checkSaved(input) });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function saveStudioAction(input: unknown) {
  try {
    const saved = await saveStudioPage(input);
    revalidatePath("/admin/pages");
    return ok(saved);
  } catch (error) {
    return toActionResult(error);
  }
}
export async function loadStudioAction(id: string) {
  try {
    return ok(await loadStudioPage(id));
  } catch (error) {
    return toActionResult(error);
  }
}
