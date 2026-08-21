/**
 * Templates and their assignments.
 *
 * A template is a layout; an assignment says which records get it. Resolution
 * runs most-specific-first — **entry > taxonomy > content_type** — which is the
 * order `0003_content_spine.sql` documents and whose unique indexes guarantee
 * at most one assignment per scope, so "most specific" is never ambiguous.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TemplateKind } from "@/lib/domain/templates";
import type { Database, Json } from "../database.types";
import { unwrap } from "./errors";

type Db = SupabaseClient<Database>;

// The `kind` vocabulary is a domain fact — it mirrors `0003`'s CHECK — so it
// lives in `lib/domain/templates.ts` and is re-exported here for the callers
// that already import it from the repository.
export type { TemplateKind };

export interface TemplateRow {
  id: string;
  key: string;
  kind: TemplateKind;
  name: string;
  description: string | null;
  is_global: boolean;
  locked: boolean;
  status: string;
  draft_data: Json;
  published_data: Json | null;
  version: number;
  updated_at: string;
}

export async function getTemplate(db: Db, id: string): Promise<TemplateRow | null> {
  return (
    (unwrap(
      "getTemplate",
      await db.from("templates").select("*").eq("id", id).maybeSingle()
    ) as TemplateRow | null) ?? null
  );
}

export async function getTemplateByKey(db: Db, key: string): Promise<TemplateRow | null> {
  return (
    (unwrap(
      "getTemplateByKey",
      await db.from("templates").select("*").eq("key", key).maybeSingle()
    ) as TemplateRow | null) ?? null
  );
}

export async function listTemplates(
  db: Db,
  { kind }: { kind?: TemplateKind } = {}
): Promise<TemplateRow[]> {
  let query = db.from("templates").select("*").order("name");
  if (kind) query = query.eq("kind", kind);
  return (unwrap("listTemplates", await query) as TemplateRow[]) ?? [];
}

interface AssignmentRow {
  template_id: string;
  scope: "content_type" | "taxonomy" | "entry";
  content_type: string | null;
  taxonomy_slug: string | null;
  entry_id: string | null;
  priority: number;
}

/**
 * The template that applies to one record, or `null` when nothing is assigned.
 *
 * Two queries at most, and no PostgREST filter strings built by concatenation —
 * every value goes through the query builder, which parameterises it. Doing
 * this as one `.or()` would mean interpolating a caller-supplied id into filter
 * syntax.
 */
export async function resolveTemplateId(
  db: Db,
  target: { contentType: string; taxonomySlug?: string | null; entryId?: string | null }
): Promise<string | null> {
  if (target.entryId) {
    const entry = unwrap(
      "resolveTemplateId(entry)",
      await db
        .from("template_assignments")
        .select("template_id")
        .eq("scope", "entry")
        .eq("entry_id", target.entryId)
        .maybeSingle()
    ) as { template_id: string } | null;

    if (entry) return entry.template_id;
  }

  const rows =
    (unwrap(
      "resolveTemplateId(type)",
      await db
        .from("template_assignments")
        .select("template_id, scope, content_type, taxonomy_slug, entry_id, priority")
        .eq("content_type", target.contentType)
        .in("scope", ["taxonomy", "content_type"])
    ) as AssignmentRow[] | null) ?? [];

  if (target.taxonomySlug) {
    const taxonomy = rows.find(
      (row) => row.scope === "taxonomy" && row.taxonomy_slug === target.taxonomySlug
    );
    if (taxonomy) return taxonomy.template_id;
  }

  return rows.find((row) => row.scope === "content_type")?.template_id ?? null;
}

export async function createTemplate(
  db: Db,
  input: {
    key: string;
    kind: TemplateKind;
    name: string;
    description?: string;
    isGlobal?: boolean;
    draftData: Json;
    createdBy: string;
  }
): Promise<TemplateRow> {
  return unwrap(
    "createTemplate",
    await db
      .from("templates")
      .insert({
        key: input.key,
        kind: input.kind,
        name: input.name,
        description: input.description ?? null,
        is_global: input.isGlobal ?? false,
        draft_data: input.draftData,
        created_by: input.createdBy,
        updated_by: input.createdBy,
      })
      .select("*")
      .single()
  ) as TemplateRow;
}
