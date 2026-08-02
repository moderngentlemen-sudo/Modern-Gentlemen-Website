/**
 * Categories, tags and authors — the three lists an article is filed against.
 *
 * Small, flat CRUD. None of them is a versioned document: a category has
 * `draft_data` and a `version` (0004 gave it the same shape as a page so a
 * category landing page could one day be composed in the builder), but nothing
 * edits those yet and this file deliberately does not touch them. When a
 * category page becomes a builder document, it goes through `documents.ts` like
 * everything else rather than growing a second publishing path here.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { unwrap } from "./errors";

type Db = SupabaseClient<Database>;

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  intro: string | null;
  position: number;
  status: string;
}

export interface TagRow {
  id: string;
  slug: string;
  label: string;
}

export interface AuthorRow {
  id: string;
  slug: string;
  name: string;
  role: string | null;
  bio: string | null;
}

const CATEGORY_COLUMNS = "id, slug, name, intro, position, status";
const AUTHOR_COLUMNS = "id, slug, name, role, bio";

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function listCategories(db: Db): Promise<CategoryRow[]> {
  return (unwrap(
    "listCategories",
    await db
      .from("categories")
      .select(CATEGORY_COLUMNS)
      .order("position", { ascending: true })
      .order("name", { ascending: true })
  ) ?? []) as CategoryRow[];
}

export async function createCategory(
  db: Db,
  input: { slug: string; name: string; intro?: string | null; position?: number }
): Promise<CategoryRow> {
  return unwrap(
    "createCategory",
    await db
      .from("categories")
      .insert({
        slug: input.slug,
        name: input.name,
        intro: input.intro ?? null,
        position: input.position ?? 0,
      })
      .select(CATEGORY_COLUMNS)
      .single()
  ) as CategoryRow;
}

export async function updateCategory(
  db: Db,
  id: string,
  patch: { name?: string; slug?: string; intro?: string | null; position?: number }
): Promise<CategoryRow> {
  return unwrap(
    "updateCategory",
    await db.from("categories").update(patch).eq("id", id).select(CATEGORY_COLUMNS).single()
  ) as CategoryRow;
}

/** Articles in a deleted category fall back to none — `on delete set null` in 0004. */
export async function deleteCategory(db: Db, id: string): Promise<void> {
  unwrap("deleteCategory", await db.from("categories").delete().eq("id", id));
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export async function listTags(db: Db): Promise<TagRow[]> {
  return (unwrap(
    "listTags",
    await db.from("tags").select("id, slug, label").order("label", { ascending: true })
  ) ?? []) as TagRow[];
}

export async function createTag(db: Db, input: { slug: string; label: string }): Promise<TagRow> {
  return unwrap(
    "createTag",
    await db.from("tags").insert(input).select("id, slug, label").single()
  ) as TagRow;
}

export async function updateTag(
  db: Db,
  id: string,
  patch: { label?: string; slug?: string }
): Promise<TagRow> {
  return unwrap(
    "updateTag",
    await db.from("tags").update(patch).eq("id", id).select("id, slug, label").single()
  ) as TagRow;
}

/** `article_tags` cascades — the join carries `on delete cascade` on both sides. */
export async function deleteTag(db: Db, id: string): Promise<void> {
  unwrap("deleteTag", await db.from("tags").delete().eq("id", id));
}

// ---------------------------------------------------------------------------
// Authors
// ---------------------------------------------------------------------------

export async function listAuthors(db: Db): Promise<AuthorRow[]> {
  return (unwrap(
    "listAuthors",
    await db.from("authors").select(AUTHOR_COLUMNS).order("name", { ascending: true })
  ) ?? []) as AuthorRow[];
}

export async function createAuthor(
  db: Db,
  input: { slug: string; name: string; role?: string | null; bio?: string | null }
): Promise<AuthorRow> {
  return unwrap(
    "createAuthor",
    await db
      .from("authors")
      .insert({
        slug: input.slug,
        name: input.name,
        role: input.role ?? null,
        bio: input.bio ?? null,
      })
      .select(AUTHOR_COLUMNS)
      .single()
  ) as AuthorRow;
}

export async function updateAuthor(
  db: Db,
  id: string,
  patch: { name?: string; slug?: string; role?: string | null; bio?: string | null }
): Promise<AuthorRow> {
  return unwrap(
    "updateAuthor",
    await db.from("authors").update(patch).eq("id", id).select(AUTHOR_COLUMNS).single()
  ) as AuthorRow;
}

/** Articles by a deleted author fall back to none — `on delete set null` in 0004. */
export async function deleteAuthor(db: Db, id: string): Promise<void> {
  unwrap("deleteAuthor", await db.from("authors").delete().eq("id", id));
}
