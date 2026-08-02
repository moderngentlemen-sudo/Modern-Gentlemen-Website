"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createArticle, setArticleTags, updateArticleMeta } from "@/lib/services/articles";
import { deleteDocument } from "@/lib/services/documents";
import { ARTICLE_TEMPLATE_NAMES } from "@/lib/domain/articles";
import { ok, type ActionResult } from "../_lib/action-result";
import { toActionResult } from "../_lib/errors";

/**
 * Article actions. Same contract as the pages actions: parse first, call a
 * service, return an `ActionResult` rather than throwing.
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
  template: z.enum(ARTICLE_TEMPLATE_NAMES).optional(),
});

export async function createArticleAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const article = await createArticle(parsed.data);
    revalidatePath("/admin/articles");
    return ok({ id: article.id });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteArticleAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    // Goes through `deleteDocument`, so the article's media usage records are
    // cleared with it. `media_usages.entity_id` has no foreign key to lean on.
    await deleteDocument("article", parsed.data.id);
    revalidatePath("/admin/articles");
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}

/**
 * `.nullable()` throughout, and that is the point: clearing a select means "no
 * category", which is a real state the column holds. An optional-only schema
 * would make un-filing an article impossible.
 */
const MetaInput = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, "Enter a title").max(200).optional(),
  slug: Slug.optional(),
  subtitle: z.string().trim().max(300).nullable().optional(),
  excerpt: z.string().trim().max(1000).nullable().optional(),
  template: z.enum(ARTICLE_TEMPLATE_NAMES).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  authorId: z.string().uuid().nullable().optional(),
  featuredAssetId: z.string().uuid().nullable().optional(),
  readingMinutes: z.number().int().min(1).max(180).nullable().optional(),
  issueNo: z.string().trim().max(20).nullable().optional(),
  tagIds: z.array(z.string().uuid()).max(50).optional(),
});

export async function updateArticleMetaAction(input: unknown): Promise<ActionResult> {
  const parsed = MetaInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { id, tagIds, ...patch } = parsed.data;

  try {
    await updateArticleMeta(id, patch);
    if (tagIds) await setArticleTags(id, tagIds);

    revalidatePath("/admin/articles");
    revalidatePath(`/admin/articles/${id}`);
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}
