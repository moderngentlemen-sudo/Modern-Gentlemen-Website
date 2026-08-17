/**
 * Article service — the editorial metadata that sits outside the block tree.
 *
 * Everything an article shares with a page already works: `documents.ts` reads
 * and saves the draft, `publishing.ts` publishes it through the same SQL
 * transaction, `revisions.ts` rolls it back. The builder needed no changes
 * either — `BLOCK_TREE_KEY.article` is `sections`, one ordered list, exactly
 * what it was written for.
 *
 * What is left is the part of an article that is *not* a block tree: its
 * template, who wrote it, what it is filed under, and how long it takes to
 * read. That is this file.
 */

import { createClient } from "@/lib/db/server";
import * as repo from "@/lib/db/repositories/articles";
import { RepositoryError } from "@/lib/db/repositories/errors";
import { normalizeRelatedIds } from "@/lib/domain/articles";
import { requirePermission } from "./auth";

export type ArticleMeta = repo.ArticleMetaRow;

export async function getArticleMeta(id: string): Promise<ArticleMeta | null> {
  await requirePermission("article.read");
  const db = await createClient();
  return repo.getArticleMeta(db, id);
}

/** The public paths an article affects — its own, and its category's listing. */
export async function getArticleRouting(
  id: string
): Promise<{ slug: string; categorySlug: string | null } | null> {
  await requirePermission("article.read");
  const db = await createClient();
  return repo.getArticleRouting(db, id);
}

/**
 * `slug` is unique, so a collision comes back as 23505. Left alone that reaches
 * an editor as a raw constraint string; translated here it reads as the thing
 * they actually did. Same treatment `renamePage` already gives it.
 */
export async function createArticle(input: {
  title: string;
  slug: string;
  template?: string;
}): Promise<{ id: string }> {
  const user = await requirePermission("article.write");
  const db = await createClient();

  try {
    return await repo.createArticle(db, { ...input, createdBy: user.id });
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "23505") {
      throw new Error(`The slug "${input.slug}" is already in use by another article.`);
    }
    throw error;
  }
}

export async function updateArticleMeta(
  id: string,
  patch: Omit<repo.ArticleMetaPatch, "updatedBy">
): Promise<ArticleMeta> {
  const user = await requirePermission("article.write");
  const db = await createClient();

  try {
    return await repo.updateArticleMeta(db, id, { ...patch, updatedBy: user.id });
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "23505") {
      throw new Error(`The slug "${patch.slug}" is already in use by another article.`);
    }
    throw error;
  }
}

export async function getArticleTagIds(id: string): Promise<string[]> {
  await requirePermission("article.read");
  const db = await createClient();
  return repo.tagIdsForArticle(db, id);
}

export async function setArticleTags(id: string, tagIds: string[]): Promise<void> {
  await requirePermission("article.write");
  const db = await createClient();
  await repo.setArticleTags(db, id, tagIds);
}

export async function getArticleRelatedIds(id: string): Promise<string[]> {
  await requirePermission("article.read");
  const db = await createClient();
  return repo.relatedIdsForArticle(db, id);
}

/**
 * Curate an article's KEEP READING list.
 *
 * `normalizeRelatedIds` runs here rather than in the repository so that every
 * caller gets the rule — the action, a script, a future import — and the
 * repository stays a plain writer. It is also what keeps the constraint
 * violations the table can raise (`23514` for a self-reference, `23505` for a
 * duplicate) out of the editor's way.
 */
export async function setArticleRelations(id: string, relatedIds: string[]): Promise<void> {
  await requirePermission("article.write");
  const db = await createClient();
  await repo.setArticleRelations(db, id, normalizeRelatedIds(id, relatedIds));
}
