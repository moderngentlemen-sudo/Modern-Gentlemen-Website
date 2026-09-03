"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  assignTemplateTo,
  createTemplate,
  getTemplate,
  publicPathsForTemplate,
} from "@/lib/services/templates";
import {
  deleteDocument,
  duplicateDocument,
  renameDocument,
  setDocumentStatus,
} from "@/lib/services/documents";
import { DOCUMENT_STATUSES } from "@/lib/domain/documents";
import { TEMPLATE_KINDS } from "@/lib/domain/templates";
import { ok, type ActionResult } from "../_lib/action-result";
import { toActionResult } from "../_lib/errors";

/**
 * Template-list actions.
 *
 * Same stance as the pattern list: parse before touching a service. The
 * permission check and RLS both sit underneath, and neither validates shape.
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
  kind: z.enum(TEMPLATE_KINDS),
});

export async function createTemplateAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    // `areas` is deliberately not taken from the client. The service seeds
    // exactly one — `main` — because a template with no areas opens in the
    // builder with no tree to show, and the only way out is a control the
    // editor has no reason to look for.
    const template = await createTemplate({
      name: parsed.data.name,
      key: parsed.data.key,
      kind: parsed.data.kind,
    });
    revalidatePath("/admin/templates");
    return ok({ id: template.id });
  } catch (error) {
    return toActionResult(error);
  }
}

const DuplicateInput = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, "Enter a name").max(200),
  slug: Key,
});

export async function duplicateTemplateAction(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = DuplicateInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const { id, title, slug } = parsed.data;
    const template = await duplicateDocument("template", id, { title, slug });
    revalidatePath("/admin/templates");
    return ok(template);
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteTemplateAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    // ⚠️ **Collected before the delete, and this is a real fix rather than
    // tidiness.** `template_assignments` cascades on the template id, so
    // deleting an assigned template silently unframes every page it framed —
    // but nothing invalidated those paths, so each kept serving its *framed*
    // prerendered HTML until the hourly backstop expired. An hour of pages
    // rendering a layout that no longer exists, with nothing in the admin
    // hinting at it. After the row is gone the paths are unknowable, which is
    // why this runs first.
    const framed = await publicPathsForTemplate(parsed.data.id);
    const template = await getTemplate(parsed.data.id);

    await deleteDocument("template", parsed.data.id);

    for (const path of framed) revalidatePath(path);
    if (template?.kind === "header" || template?.kind === "footer") {
      revalidatePath("/", "layout");
    }
    revalidatePath("/admin/templates");
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}

const StatusInput = z.object({
  id: z.string().uuid(),
  status: z.enum(DOCUMENT_STATUSES),
});

export async function setTemplateStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = StatusInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    await setDocumentStatus("template", parsed.data.id, parsed.data.status);
    revalidatePath("/admin/templates");
    revalidatePath(`/admin/templates/${parsed.data.id}`);
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}

/**
 * Rename a template — its name, its key, or both.
 *
 * ⚠️ **`kind` is deliberately not renameable.** `template_assignments` resolves
 * a record to a template through it, so changing a template's kind after the
 * fact would silently re-point — or orphan — every assignment that had already
 * been made against it. Getting the kind wrong is a delete-and-recreate, and
 * that is the honest cost until assignments have an editor of their own.
 *
 * The key, like a pattern's, is an internal handle rather than a URL: nothing
 * public links to it, so renaming one breaks no link.
 */
const RenameInput = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Enter a name").max(200).optional(),
  key: Key.optional(),
});

export async function renameTemplateAction(input: unknown): Promise<ActionResult> {
  const parsed = RenameInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const { id, name, key } = parsed.data;
    // `name` and `key` are the template's columns; the service speaks the
    // repository's vocabulary, where they are the title and the slug.
    await renameDocument("template", id, { title: name, slug: key });
    revalidatePath("/admin/templates");
    revalidatePath(`/admin/templates/${id}`);
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}

/**
 * Points a template at a target, or at nothing.
 *
 * `target: null` means "applies to nothing" — expressed as an explicit null
 * rather than an absent field, so a client that forgot to send the value cannot
 * accidentally unassign a live template.
 *
 * The revalidation walks the set the service returns rather than one path: an
 * assignment changes what a published page renders without touching that page's
 * row, and reassigning a target away from another template changes *its* pages
 * too. `revalidatePath("/", "layout")` would be the blunt version and would drop
 * every cached route on the site for one row.
 */
export async function assignTemplateAction(
  input: unknown
): Promise<ActionResult<{ paths: number }>> {
  const parsed = z
    .object({ id: z.string().uuid(), target: z.string().min(1).max(200).nullable() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    const { paths, revalidateLayout } = await assignTemplateTo(parsed.data.id, parsed.data.target);
    for (const path of paths) revalidatePath(path);
    if (revalidateLayout) revalidatePath("/", "layout");
    revalidatePath("/admin/templates");
    return ok({ paths: paths.length });
  } catch (error) {
    return toActionResult(error);
  }
}
