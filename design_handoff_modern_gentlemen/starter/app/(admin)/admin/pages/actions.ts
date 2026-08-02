"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  createPage,
  deleteDocument,
  renamePage,
  setDocumentStatus,
} from "@/lib/services/documents";
import { DOCUMENT_STATUSES } from "@/lib/domain/documents";
import { ok, type ActionResult } from "../_lib/action-result";
import { toActionResult } from "../_lib/errors";

/**
 * Page-list actions.
 *
 * Every one parses its input before touching a service. The permission check
 * and RLS both sit underneath, but neither validates *shape* — a client is free
 * to send anything, and a service should never be the first thing to meet it.
 */
const Slug = z
  .string()
  .trim()
  .min(1, "Enter a slug")
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lower-case words separated by hyphens");

const CreateInput = z.object({
  title: z.string().trim().min(1, "Enter a title").max(200),
  slug: Slug,
});

export async function createPageAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const page = await createPage(parsed.data);
    revalidatePath("/admin/pages");
    return ok({ id: page.id });
  } catch (error) {
    return toActionResult(error);
  }
}

const RenameInput = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  slug: Slug.optional(),
});

export async function renamePageAction(input: unknown): Promise<ActionResult> {
  const parsed = RenameInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const { id, ...rest } = parsed.data;
    await renamePage(id, rest);
    revalidatePath("/admin/pages");
    revalidatePath(`/admin/pages/${id}`);
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deletePageAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    await deleteDocument("page", parsed.data.id);
    revalidatePath("/admin/pages");
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}

const StatusInput = z.object({
  id: z.string().uuid(),
  status: z.enum(DOCUMENT_STATUSES),
});

export async function setPageStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = StatusInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    await setDocumentStatus("page", parsed.data.id, parsed.data.status);
    revalidatePath("/admin/pages");
    revalidatePath(`/admin/pages/${parsed.data.id}`);
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}
