"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  createArticle,
  setArticleRelations,
  setArticleTags,
  updateArticleMeta,
} from "@/lib/services/articles";
import { deleteDocument } from "@/lib/services/documents";
import { ARTICLE_TEMPLATE_NAMES } from "@/lib/domain/articles";
import { ARTICLE_FEATURED_MEDIA_KINDS, withArticleFeaturedMedia } from "@/lib/domain/articles";
import { getDocument, saveDraft } from "@/lib/services/documents";
import type { Json } from "@/lib/db/database.types";
import { ok, type ActionResult } from "../_lib/action-result";
import { toActionResult } from "../_lib/errors";
import { publicPathsForArticle, revalidatePublicPaths } from "./revalidate";

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
    // Read the public paths first: once the row is gone there is no category to
    // look up, and the category page has to be rebuilt precisely *because* the
    // article it listed no longer exists.
    const paths = await publicPathsForArticle(parsed.data.id);

    // Goes through `deleteDocument`, so the article's media usage records are
    // cleared with it. `media_usages.entity_id` has no foreign key to lean on.
    await deleteDocument("article", parsed.data.id);

    revalidatePath("/admin/articles");
    revalidatePublicPaths(paths);
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
  // Not capped at KEEP_READING_COUNT here on purpose: `setArticleRelations`
  // normalizes, so a list that is too long is trimmed rather than refused, and
  // the cap lives in one place. This bound only stops an absurd payload.
  relatedIds: z.array(z.string().uuid()).max(50).optional(),
  featuredMedia: z
    .object({
      kind: z.enum(ARTICLE_FEATURED_MEDIA_KINDS),
      cover: z
        .object({
          assetId: z.string().uuid().optional(),
          url: z.string().min(1).max(2048),
          kind: z.enum(["image", "gif"]),
          alt: z.string().max(500).optional(),
        })
        .optional(),
      video: z
        .object({
          assetId: z.string().uuid().optional(),
          url: z.string().min(1).max(2048),
          kind: z.literal("video"),
          alt: z.string().max(500).optional(),
        })
        .optional(),
      embedUrl: z.string().trim().max(2048).optional(),
      gallery: z
        .array(
          z.object({
            assetId: z.string().uuid().optional(),
            url: z.string().min(1).max(2048),
            kind: z.enum(["image", "gif"]),
            alt: z.string().max(500).optional(),
          })
        )
        .max(12)
        .optional(),
    })
    .optional(),
});

export async function updateArticleMetaAction(input: unknown): Promise<ActionResult> {
  const parsed = MetaInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { id, tagIds, relatedIds, featuredMedia, ...patch } = parsed.data;

  try {
    // Both sides of the write. Re-filing an article from Watches to Culture
    // takes it off one listing and puts it on another, and only the path set
    // from before the update knows about the first of those.
    const before = await publicPathsForArticle(id);

    await updateArticleMeta(id, patch);
    if (featuredMedia) {
      const document = await getDocument("article", id);
      if (!document) throw new Error(`No such article: ${id}`);
      await saveDraft(
        "article",
        id,
        withArticleFeaturedMedia(document.draft_data, featuredMedia) as Json
      );
    }
    if (tagIds) await setArticleTags(id, tagIds);
    // KEEP READING is rendered on this article's own page and nowhere else, so
    // unlike a re-filing it moves no other page's content. The shared
    // revalidation below covers it.
    if (relatedIds) await setArticleRelations(id, relatedIds);

    revalidatePath("/admin/articles");
    revalidatePath(`/admin/articles/${id}`);
    // The metadata is rendered content — the template, the byline, the reading
    // time, the tag a category card prints — so a save changes the public pages
    // even though no block moved.
    revalidatePublicPaths([...before, ...(await publicPathsForArticle(id))]);
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}
