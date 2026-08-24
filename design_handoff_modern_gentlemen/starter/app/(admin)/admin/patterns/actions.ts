"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createPattern, setPatternDetails } from "@/lib/services/patterns";
import { deleteDocument, renameDocument, setDocumentStatus } from "@/lib/services/documents";
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

/**
 * `description` and `categoryId` are optional and nullable, and both meanings
 * matter: absent leaves the column alone, `null` clears it. Empty strings are
 * normalised to `null` at the boundary so a cleared textarea does not store
 * `""` — a description that is present and blank renders as a blank line in the
 * builder's rail where the block count used to be.
 */
const Description = z
  .string()
  .trim()
  .max(500, "Keep it under 500 characters")
  .nullable()
  .optional()
  .transform((v) => (v ? v : null));

const CategoryId = z.string().uuid().nullable().optional();

const CreateInput = z.object({
  name: z.string().trim().min(1, "Enter a name").max(200),
  key: Key,
  syncMode: z.enum(["detachable", "synced"]),
  description: Description,
  categoryId: CategoryId,
});

export async function createPatternAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    // ✅ `syncMode` **is** taken from the client now, and the paragraph that
    // stood here explaining why it could not be is worth keeping in outline
    // because the hazard was real: a synced pattern stores a `_ref` in the page
    // and is expanded at render time, and until this phase `expandPatternRefs`
    // had exactly one caller — `/preview/[token]`. No public route expanded
    // refs, so a synced pattern rendered correctly in preview and **vanished
    // from the live site**: the worst failure shape available, because the
    // person checking their work is shown it working.
    //
    // What changed is that the public paths expand now
    // (`publicContent.expandPublicPatterns`, called by the homepage and
    // `/[category]`), publishing a pattern revalidates them, and a `patternRef`
    // is a registered block so a page holding one can actually be published.
    // The option is offered because it is now true, not because the column
    // existed.
    const pattern = await createPattern({
      name: parsed.data.name,
      key: parsed.data.key,
      syncMode: parsed.data.syncMode,
      // ✅ Both collected as of this phase. `createPattern` in the repository
      // has accepted them since Phase 4 and no caller ever passed one, so
      // `patterns.description` was written by nothing while the builder's rail
      // read it — every entry fell through to "N sections" — and
      // `patterns.category_id` pointed at five seeded rows nothing could reach.
      description: parsed.data.description ?? undefined,
      categoryId: parsed.data.categoryId ?? undefined,
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

/**
 * Rename a pattern — its name, its key, or both.
 *
 * Until `renameDocument` existed there was no rename here at all: the only one
 * in the repository was page-specific, so getting a pattern's name wrong meant
 * deleting it and starting again, losing its revision history with it.
 *
 * ⚠️ **A pattern's key is not a URL**, which is what makes this safe to offer
 * freely. Nothing links to `/editorial-trio`; the key identifies the pattern to
 * editors and to `listInsertablePatterns`. Renaming a *page's* slug is a
 * different decision with links on the other end of it, and renaming a
 * product's is one an import is explicitly forbidden from making.
 *
 * Insertion already copies blocks rather than linking, so a page built from
 * this pattern is unaffected by the rename — the same property the delete
 * dialog explains.
 */
const RenameInput = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Enter a name").max(200).optional(),
  key: Key.optional(),
});

export async function renamePatternAction(input: unknown): Promise<ActionResult> {
  const parsed = RenameInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const { id, name, key } = parsed.data;
    // `name` and `key` are the pattern's columns; the service speaks the
    // repository's vocabulary, where they are the title and the slug.
    await renameDocument("pattern", id, { title: name, slug: key });
    revalidatePath("/admin/patterns");
    revalidatePath(`/admin/patterns/${id}`);
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}

/**
 * The two columns a rename cannot reach.
 *
 * Kept as its own action rather than folded into `renamePatternAction` because
 * the underlying services differ: renaming goes through the generic
 * `renameDocument`, which is shared with pages, articles and products and
 * speaks title/slug, while these two exist on `patterns` alone. The dialog
 * calls both and reports the first failure.
 */
const DetailsInput = z.object({
  id: z.string().uuid(),
  description: Description,
  categoryId: CategoryId,
});

export async function setPatternDetailsAction(input: unknown): Promise<ActionResult> {
  const parsed = DetailsInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const { id, description, categoryId } = parsed.data;
    await setPatternDetails(id, { description, categoryId: categoryId ?? null });
    revalidatePath("/admin/patterns");
    revalidatePath(`/admin/patterns/${id}`);
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}
