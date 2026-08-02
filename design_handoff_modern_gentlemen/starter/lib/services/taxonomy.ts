/**
 * Taxonomy service — categories, tags and authors.
 *
 * **On the permission gates.** 0001 seeds `taxonomy.write` and no
 * `taxonomy.read`: the three tables are public-read at the RLS level (a
 * category is visible once published, tags and authors always), so there was
 * never a read permission to grant. Reads here are therefore gated on
 * `article.read` — the natural consumer, since taxonomy exists to file articles
 * against — and writes on `taxonomy.write` as the policies require. If a
 * `taxonomy.read` permission is ever added, this is the file to change.
 */

import { createClient } from "@/lib/db/server";
import * as repo from "@/lib/db/repositories/taxonomy";
import { RepositoryError } from "@/lib/db/repositories/errors";
import { requirePermission } from "./auth";

export type { AuthorRow, CategoryRow, TagRow } from "@/lib/db/repositories/taxonomy";

/** One call for the whole screen, and for the article editor's three selects. */
export async function listTaxonomy() {
  await requirePermission("article.read");
  const db = await createClient();

  const [categories, tags, authors] = await Promise.all([
    repo.listCategories(db),
    repo.listTags(db),
    repo.listAuthors(db),
  ]);

  return { categories, tags, authors };
}

/**
 * Every slug in these three tables is unique, and every one of them is reached
 * by a public URL or used as a filter key, so a collision is an ordinary thing
 * for an editor to cause. Translated once, here, rather than in six actions.
 */
function rethrowSlugCollision(error: unknown, slug: string | undefined, what: string): never {
  if (error instanceof RepositoryError && error.code === "23505") {
    throw new Error(`The slug "${slug}" is already in use by another ${what}.`);
  }
  throw error;
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function createCategory(input: {
  name: string;
  slug: string;
  intro?: string | null;
  position?: number;
}) {
  await requirePermission("taxonomy.write");
  const db = await createClient();

  try {
    return await repo.createCategory(db, input);
  } catch (error) {
    rethrowSlugCollision(error, input.slug, "category");
  }
}

export async function updateCategory(
  id: string,
  patch: { name?: string; slug?: string; intro?: string | null; position?: number }
) {
  await requirePermission("taxonomy.write");
  const db = await createClient();

  try {
    return await repo.updateCategory(db, id, patch);
  } catch (error) {
    rethrowSlugCollision(error, patch.slug, "category");
  }
}

export async function deleteCategory(id: string): Promise<void> {
  await requirePermission("taxonomy.write");
  const db = await createClient();
  await repo.deleteCategory(db, id);
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export async function createTag(input: { label: string; slug: string }) {
  await requirePermission("taxonomy.write");
  const db = await createClient();

  try {
    return await repo.createTag(db, input);
  } catch (error) {
    rethrowSlugCollision(error, input.slug, "tag");
  }
}

export async function updateTag(id: string, patch: { label?: string; slug?: string }) {
  await requirePermission("taxonomy.write");
  const db = await createClient();

  try {
    return await repo.updateTag(db, id, patch);
  } catch (error) {
    rethrowSlugCollision(error, patch.slug, "tag");
  }
}

export async function deleteTag(id: string): Promise<void> {
  await requirePermission("taxonomy.write");
  const db = await createClient();
  await repo.deleteTag(db, id);
}

// ---------------------------------------------------------------------------
// Authors
// ---------------------------------------------------------------------------

export async function createAuthor(input: {
  name: string;
  slug: string;
  role?: string | null;
  bio?: string | null;
}) {
  await requirePermission("taxonomy.write");
  const db = await createClient();

  try {
    return await repo.createAuthor(db, input);
  } catch (error) {
    rethrowSlugCollision(error, input.slug, "author");
  }
}

export async function updateAuthor(
  id: string,
  patch: { name?: string; slug?: string; role?: string | null; bio?: string | null }
) {
  await requirePermission("taxonomy.write");
  const db = await createClient();

  try {
    return await repo.updateAuthor(db, id, patch);
  } catch (error) {
    rethrowSlugCollision(error, patch.slug, "author");
  }
}

export async function deleteAuthor(id: string): Promise<void> {
  await requirePermission("taxonomy.write");
  const db = await createClient();
  await repo.deleteAuthor(db, id);
}
