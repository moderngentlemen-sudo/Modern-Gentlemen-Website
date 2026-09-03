/**
 * Page creation and slug lookup.
 *
 * Everything a page shares with the other versioned entities — drafts,
 * versions, status, history — lives in `documents.ts`. This file holds only
 * what is genuinely page-shaped: the slug, the title, and `is_system`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../database.types";
import { unwrap } from "./errors";

type Db = SupabaseClient<Database>;

/** An empty page: an ordered, empty block tree plus room for SEO. */
export const EMPTY_PAGE_PAYLOAD: Json = { sections: [], seo: {} };

export interface PageRow {
  id: string;
  slug: string;
  title: string;
  template_id: string | null;
  is_system: boolean;
  status: string;
  version: number;
  draft_data: Json;
  published_data: Json | null;
  published_at: string | null;
  scheduled_for: string | null;
  updated_at: string;
}

export async function getPage(db: Db, id: string): Promise<PageRow | null> {
  return (
    (unwrap(
      "getPage",
      await db.from("pages").select("*").eq("id", id).maybeSingle()
    ) as PageRow | null) ?? null
  );
}

export async function createPage(
  db: Db,
  input: {
    slug: string;
    title: string;
    templateId?: string | null;
    draftData?: Json;
    createdBy: string;
  }
): Promise<PageRow> {
  return unwrap(
    "createPage",
    await db
      .from("pages")
      .insert({
        slug: input.slug,
        title: input.title,
        template_id: input.templateId ?? null,
        draft_data: input.draftData ?? EMPTY_PAGE_PAYLOAD,
        created_by: input.createdBy,
        updated_by: input.createdBy,
      })
      .select("*")
      .single()
  ) as PageRow;
}

/**
 * The published payload for a public route. Returns `null` for a draft page,
 * because RLS will not hand an anonymous reader the row at all — this is the
 * shape Phase 7 will call when the public site starts reading from the database.
 */
export async function getPublishedPage(db: Db, slug: string): Promise<PageRow | null> {
  return (
    (unwrap(
      "getPublishedPage",
      await db.from("pages").select("*").eq("slug", slug).eq("status", "published").maybeSingle()
    ) as PageRow | null) ?? null
  );
}

// `renamePage` lived here and is gone: `documents.ts#renameDocument` does the
// same work for all six types off `DOCUMENT_TABLES`, which is what let a pattern
// be renamed at all. Nothing page-specific was lost — the only difference was
// that the column names were written out rather than looked up.
