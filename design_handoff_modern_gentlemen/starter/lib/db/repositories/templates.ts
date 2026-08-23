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

export interface AssignmentRow {
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

/**
 * Every assignment in the project, with the template each belongs to.
 *
 * Read whole rather than per-template because the assignment UI needs both
 * halves at once: what *this* template is assigned to, and which targets are
 * already taken by another one. `template_assignments` holds one row per
 * content type and one per entry — single digits — so a second query filtered
 * by template id would cost a round trip to save nothing.
 */
export async function listAssignments(db: Db): Promise<AssignmentRow[]> {
  return (
    (unwrap(
      "listAssignments",
      await db
        .from("template_assignments")
        .select("template_id, scope, content_type, taxonomy_slug, entry_id, priority")
    ) as AssignmentRow[] | null) ?? []
  );
}

/**
 * Points a template at a content type or a single entry, replacing whatever
 * that target pointed at before.
 *
 * **Delete-then-insert, and the delete is the point.** `0003` puts a unique
 * index on `content_type where scope = 'content_type'` and another on
 * `entry_id where scope = 'entry'`, so a target can only ever be claimed by one
 * template. A bare insert therefore fails with `23505` the moment an editor
 * reassigns "all pages" from one template to another — which is the ordinary
 * thing to want, not an error. Clearing the target first turns that into the
 * reassignment it is.
 *
 * ⚠️ **Not transactional, and the failure mode is stated rather than hidden.**
 * PostgREST has no multi-statement transaction, so a delete that succeeds
 * followed by an insert that fails leaves the target assigned to *nothing*
 * rather than to its previous holder. That is a visible, recoverable state — the
 * next screen shows "—" and the editor assigns again — and it is strictly
 * better than the alternative shape, an insert-first that would have to leave
 * two rows racing for one unique index. `replaceMappings` in the ingestion
 * service carries the same caveat for the same reason.
 */
export async function assignTemplate(
  db: Db,
  input: { templateId: string; contentType: string; entryId?: string | null }
): Promise<void> {
  await clearAssignmentTarget(db, input);

  unwrap(
    "assignTemplate",
    await db.from("template_assignments").insert({
      template_id: input.templateId,
      scope: input.entryId ? "entry" : "content_type",
      // Written for both scopes even though `0003`'s CHECK only demands it for
      // `content_type`. An entry row that names its type lets a reader know
      // which table the id is in without probing both — see `soleFramedDocument`,
      // which has to probe precisely because older rows may not carry it.
      content_type: input.contentType,
      entry_id: input.entryId ?? null,
    })
  );
}

/** Removes whatever claims this target, whichever template holds it. */
async function clearAssignmentTarget(
  db: Db,
  target: { contentType: string; entryId?: string | null }
): Promise<void> {
  const query = target.entryId
    ? db.from("template_assignments").delete().eq("scope", "entry").eq("entry_id", target.entryId)
    : db
        .from("template_assignments")
        .delete()
        .eq("scope", "content_type")
        .eq("content_type", target.contentType);

  unwrap("clearAssignmentTarget", await query);
}

/** Drops every assignment a template holds — "applies to nothing". */
export async function unassignTemplate(db: Db, templateId: string): Promise<void> {
  unwrap(
    "unassignTemplate",
    await db.from("template_assignments").delete().eq("template_id", templateId)
  );
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
