/**
 * The polymorphic document repository.
 *
 * Pages, templates, patterns, articles and products carry an identical set of
 * versioning columns (`0003`, `0004`, `0005`), which is what lets one repository
 * serve all five — the same reasoning that gave `revisions` a single polymorphic
 * table rather than five copies of the same rollback logic.
 *
 * Every function takes the Supabase client as its first argument rather than
 * building one. Server components pass the caller's session client so RLS
 * applies; scripts and integration fixtures pass the service-role client. The
 * repository has no opinion, and no ability to escalate.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentStatus, DocumentType } from "@/lib/domain/documents";
import type { Database, Json } from "../database.types";
import { unwrap } from "./errors";

type Db = SupabaseClient<Database>;

/**
 * Per-type storage facts. The label and slug columns are genuinely named
 * differently across the five tables, so they are aliased in the SELECT rather
 * than leaking `name` vs `title` into every caller.
 */
export const DOCUMENT_TABLES = {
  page: { table: "pages", titleColumn: "title", slugColumn: "slug" },
  template: { table: "templates", titleColumn: "name", slugColumn: "key" },
  pattern: { table: "patterns", titleColumn: "name", slugColumn: "key" },
  article: { table: "articles", titleColumn: "title", slugColumn: "slug" },
  product: { table: "products", titleColumn: "name", slugColumn: "slug" },
  category: { table: "categories", titleColumn: "name", slugColumn: "slug" },
} as const satisfies Record<
  DocumentType,
  { table: keyof Database["public"]["Tables"]; titleColumn: string; slugColumn: string }
>;

export function tableFor(type: DocumentType): string {
  return DOCUMENT_TABLES[type].table;
}

export interface DocumentRow {
  id: string;
  title: string;
  slug: string;
  status: DocumentStatus;
  version: number;
  draft_data: Json;
  published_data: Json | null;
  published_at: string | null;
  scheduled_for: string | null;
  created_at: string;
  updated_at: string;
}

/** Everything except the payloads — enough for a list view, without shipping two JSON trees per row. */
export type DocumentSummary = Omit<DocumentRow, "draft_data" | "published_data">;

function columns(type: DocumentType, includePayloads: boolean): string {
  const { titleColumn, slugColumn } = DOCUMENT_TABLES[type];
  const base = [
    "id",
    `title:${titleColumn}`,
    `slug:${slugColumn}`,
    "status",
    "version",
    "published_at",
    "created_at",
    "updated_at",
  ];
  // Only pages and articles have this column; asking for it elsewhere is an error.
  if (type === "page" || type === "article") base.push("scheduled_for");
  if (includePayloads) base.push("draft_data", "published_data");
  return base.join(", ");
}

/**
 * A table name chosen at run time defeats the generated row types: the query
 * builder cannot narrow a union of four tables to one row shape, and the
 * aliased columns are not in the generated types under those names anyway.
 *
 * The cast is confined to this one helper. What makes it safe is not the type
 * assertion but `tests/integration/documents.test.ts`, which runs these
 * selects against a real database for all four types.
 */
function from(db: Db, type: DocumentType) {
  return db.from(tableFor(type) as keyof Database["public"]["Tables"]) as unknown as ReturnType<
    Db["from"]
  >;
}

export async function getDocument(
  db: Db,
  type: DocumentType,
  id: string
): Promise<DocumentRow | null> {
  const data = unwrap(
    `getDocument(${type})`,
    await from(db, type).select(columns(type, true)).eq("id", id).maybeSingle()
  );
  return (data as DocumentRow | null) ?? null;
}

export async function getDocumentBySlug(
  db: Db,
  type: DocumentType,
  slug: string
): Promise<DocumentRow | null> {
  const data = unwrap(
    `getDocumentBySlug(${type})`,
    await from(db, type)
      .select(columns(type, true))
      .eq(DOCUMENT_TABLES[type].slugColumn, slug)
      .maybeSingle()
  );
  return (data as DocumentRow | null) ?? null;
}

export interface ListOptions {
  status?: DocumentStatus;
  limit?: number;
  offset?: number;
}

export async function listDocuments(
  db: Db,
  type: DocumentType,
  { status, limit = 50, offset = 0 }: ListOptions = {}
): Promise<DocumentSummary[]> {
  let query = from(db, type)
    .select(columns(type, false))
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);

  return (unwrap(`listDocuments(${type})`, await query) as DocumentSummary[]) ?? [];
}

/**
 * Writes the draft payload. Deliberately touches nothing else: publishing,
 * versioning and history are `0010`'s transactional functions, and a save that
 * quietly advanced a version would make those numbers meaningless.
 */
export async function saveDraft(
  db: Db,
  type: DocumentType,
  id: string,
  draftData: Json,
  updatedBy: string
): Promise<void> {
  unwrap(
    `saveDraft(${type})`,
    await from(db, type).update({ draft_data: draftData, updated_by: updatedBy }).eq("id", id)
  );
}

export async function setStatus(
  db: Db,
  type: DocumentType,
  id: string,
  status: DocumentStatus,
  updatedBy: string
): Promise<void> {
  unwrap(
    `setStatus(${type})`,
    await from(db, type).update({ status, updated_by: updatedBy }).eq("id", id)
  );
}

/**
 * Rename a document: its title, its slug, or both.
 *
 * The generic sibling of `pages.ts#renamePage`, which is the only rename this
 * repository had and could only ever serve pages. Everything it needs is
 * already in `DOCUMENT_TABLES` — the *title* is `title` on a page and `name` on
 * a pattern, the *slug* is `slug` on a page and `key` on a pattern — so the
 * column names come from there rather than being written out per type.
 *
 * `updated_by` is written unconditionally, as `saveDraft` and `setStatus`
 * already do generically, which is what establishes that every document table
 * carries the column.
 *
 * ⚠️ **Callers own the question of whether a slug *should* move.** This writes
 * what it is given. For a page or an article the slug is a public URL and
 * renaming it breaks links; for a product it is the PDP's address and an
 * **import must never write it** (see `columnsForApply` in
 * `lib/services/ingestion.ts`); for a pattern the key is an internal handle and
 * moving it costs nothing. Those are policies, and they live with the callers
 * that know which case they are in.
 */
export async function renameDocument(
  db: Db,
  type: DocumentType,
  id: string,
  input: { title?: string; slug?: string; updatedBy: string }
): Promise<void> {
  const { titleColumn, slugColumn } = DOCUMENT_TABLES[type];

  const patch: Record<string, string> = { updated_by: input.updatedBy };
  if (input.title !== undefined) patch[titleColumn] = input.title;
  if (input.slug !== undefined) patch[slugColumn] = input.slug;

  unwrap(`renameDocument(${type})`, await from(db, type).update(patch).eq("id", id));
}

export async function deleteDocument(db: Db, type: DocumentType, id: string): Promise<void> {
  unwrap(`deleteDocument(${type})`, await from(db, type).delete().eq("id", id));
}
