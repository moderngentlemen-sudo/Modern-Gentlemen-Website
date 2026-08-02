"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  createAuthor,
  createCategory,
  createTag,
  deleteAuthor,
  deleteCategory,
  deleteTag,
  updateAuthor,
  updateCategory,
  updateTag,
} from "@/lib/services/taxonomy";
import { ok, type ActionResult } from "../_lib/action-result";
import { toActionResult } from "../_lib/errors";

/**
 * Taxonomy actions — categories, tags and authors.
 *
 * Nine thin wrappers rather than one generic `saveTaxonomyAction(kind, …)`.
 * The three tables have genuinely different columns (a category has `intro`
 * and `position`, an author has `role` and `bio`, a tag has neither), so a
 * single action would take a union it then has to narrow anyway — and Zod
 * would validate the loosest shape of the three.
 */
const Slug = z
  .string()
  .trim()
  .min(1, "Enter a slug")
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lower-case words separated by hyphens");

const Id = z.object({ id: z.string().uuid() });

function invalid(error: z.ZodError): ActionResult<never> {
  return { ok: false, error: error.issues[0]?.message ?? "Invalid input" };
}

function done(): ActionResult {
  revalidatePath("/admin/taxonomy");
  // The article editor's three selects read the same lists.
  revalidatePath("/admin/articles", "layout");
  return ok(undefined);
}

// --- Categories ------------------------------------------------------------

const CategoryInput = z.object({
  name: z.string().trim().min(1, "Enter a name").max(120),
  slug: Slug,
  intro: z.string().trim().max(1000).nullable().optional(),
  position: z.number().int().min(0).max(999).optional(),
});

export async function createCategoryAction(input: unknown): Promise<ActionResult> {
  const parsed = CategoryInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    await createCategory(parsed.data);
    return done();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function updateCategoryAction(input: unknown): Promise<ActionResult> {
  const parsed = Id.and(CategoryInput.partial()).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    const { id, ...patch } = parsed.data;
    await updateCategory(id, patch);
    return done();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteCategoryAction(input: unknown): Promise<ActionResult> {
  const parsed = Id.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    await deleteCategory(parsed.data.id);
    return done();
  } catch (error) {
    return toActionResult(error);
  }
}

// --- Tags ------------------------------------------------------------------

const TagInput = z.object({
  label: z.string().trim().min(1, "Enter a label").max(80),
  slug: Slug,
});

export async function createTagAction(input: unknown): Promise<ActionResult> {
  const parsed = TagInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    await createTag(parsed.data);
    return done();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function updateTagAction(input: unknown): Promise<ActionResult> {
  const parsed = Id.and(TagInput.partial()).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    const { id, ...patch } = parsed.data;
    await updateTag(id, patch);
    return done();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteTagAction(input: unknown): Promise<ActionResult> {
  const parsed = Id.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    await deleteTag(parsed.data.id);
    return done();
  } catch (error) {
    return toActionResult(error);
  }
}

// --- Authors ---------------------------------------------------------------

const AuthorInput = z.object({
  name: z.string().trim().min(1, "Enter a name").max(120),
  slug: Slug,
  role: z.string().trim().max(120).nullable().optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
});

export async function createAuthorAction(input: unknown): Promise<ActionResult> {
  const parsed = AuthorInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    await createAuthor(parsed.data);
    return done();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function updateAuthorAction(input: unknown): Promise<ActionResult> {
  const parsed = Id.and(AuthorInput.partial()).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    const { id, ...patch } = parsed.data;
    await updateAuthor(id, patch);
    return done();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteAuthorAction(input: unknown): Promise<ActionResult> {
  const parsed = Id.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    await deleteAuthor(parsed.data.id);
    return done();
  } catch (error) {
    return toActionResult(error);
  }
}
