/**
 * Revision history.
 *
 * Reads and autosave writes only. The revisions that accompany a publish, a
 * snapshot or a restore are written inside `0010`'s transactional functions, in
 * the same transaction as the change they record — writing them from here would
 * reintroduce the gap those functions exist to close.
 *
 * Revisions are immutable: there is no update and no delete.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentType, RevisionReason } from "@/lib/domain/documents";
import type { Database, Json } from "../database.types";
import { unwrap } from "./errors";

type Db = SupabaseClient<Database>;

export interface RevisionRow {
  id: string;
  entity_type: string;
  entity_id: string;
  version: number;
  data: Json;
  label: string | null;
  reason: RevisionReason;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

/** Metadata only — a history list should not download every payload. */
export type RevisionSummary = Omit<RevisionRow, "data">;

const SUMMARY_COLUMNS =
  "id, entity_type, entity_id, version, label, reason, note, created_by, created_at";

export async function listRevisions(
  db: Db,
  type: DocumentType,
  entityId: string,
  limit = 50
): Promise<RevisionSummary[]> {
  return (
    (unwrap(
      "listRevisions",
      await db
        .from("revisions")
        .select(SUMMARY_COLUMNS)
        .eq("entity_type", type)
        .eq("entity_id", entityId)
        .order("version", { ascending: false })
        .limit(limit)
    ) as RevisionSummary[]) ?? []
  );
}

export async function getRevision(
  db: Db,
  type: DocumentType,
  entityId: string,
  version: number
): Promise<RevisionRow | null> {
  return (
    (unwrap(
      "getRevision",
      await db
        .from("revisions")
        .select("*")
        .eq("entity_type", type)
        .eq("entity_id", entityId)
        .eq("version", version)
        .maybeSingle()
    ) as RevisionRow | null) ?? null
  );
}

/** The newest revision of any kind. Drives the autosave throttle. */
export async function latestRevision(
  db: Db,
  type: DocumentType,
  entityId: string
): Promise<RevisionSummary | null> {
  return (
    (unwrap(
      "latestRevision",
      await db
        .from("revisions")
        .select(SUMMARY_COLUMNS)
        .eq("entity_type", type)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ) as RevisionSummary | null) ?? null
  );
}

/**
 * Writes an autosave checkpoint.
 *
 * `version` is the document's current version, not a new one: an autosave
 * records the draft as it stands between publishes and must not consume a
 * version number that a later publish will want. That means at most one
 * autosave revision per version — the unique key enforces it — so a repeat
 * within the same version is swallowed rather than raised.
 */
export async function insertAutosaveRevision(
  db: Db,
  input: {
    type: DocumentType;
    entityId: string;
    version: number;
    data: Json;
    createdBy: string;
  }
): Promise<void> {
  const { error } = await db.from("revisions").insert({
    entity_type: input.type,
    entity_id: input.entityId,
    version: input.version,
    data: input.data,
    reason: "autosave",
    created_by: input.createdBy,
  });

  // 23505 = unique_violation: this version already has its checkpoint.
  if (error && error.code !== "23505") {
    throw new Error(`insertAutosaveRevision: ${error.message}`);
  }
}

export interface PublishEventRow {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  from_version: number | null;
  to_version: number | null;
  note: string | null;
  actor_id: string | null;
  created_at: string;
}

export async function listPublishEvents(
  db: Db,
  type: DocumentType,
  entityId: string,
  limit = 50
): Promise<PublishEventRow[]> {
  return (
    (unwrap(
      "listPublishEvents",
      await db
        .from("publish_events")
        .select("*")
        .eq("entity_type", type)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false })
        .limit(limit)
    ) as PublishEventRow[]) ?? []
  );
}
