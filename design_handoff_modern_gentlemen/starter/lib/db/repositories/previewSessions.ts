/**
 * Preview sessions — short-lived capabilities granting read access to one
 * document's draft.
 *
 * Creating one is an ordinary staff write under RLS. *Resolving* one is not:
 * the holder of a link may be signed out entirely, so it goes through the
 * `resolve_preview` function from `0010`, which performs the capability check
 * inside the database and returns nothing but that document's draft payload.
 * See the migration for why the alternatives were rejected.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentType } from "@/lib/domain/documents";
import type { Database, Json } from "../database.types";
import { unwrap } from "./errors";

type Db = SupabaseClient<Database>;

export type PreviewDevice = "desktop" | "tablet" | "mobile";

export interface PreviewSessionRow {
  id: string;
  token: string;
  entity_type: string;
  entity_id: string | null;
  context: Json;
  device: PreviewDevice;
  created_by: string | null;
  expires_at: string;
  created_at: string;
}

export interface ResolvedPreview {
  entityType: DocumentType;
  entityId: string;
  device: PreviewDevice;
  expiresAt: string;
  context: Json;
  data: Json;
}

export async function createPreviewSession(
  db: Db,
  input: {
    token: string;
    type: DocumentType;
    entityId: string;
    device?: PreviewDevice;
    context?: Json;
    createdBy: string;
    expiresAt: Date;
  }
): Promise<PreviewSessionRow> {
  const row = unwrap(
    "createPreviewSession",
    await db
      .from("preview_sessions")
      .insert({
        token: input.token,
        entity_type: input.type,
        entity_id: input.entityId,
        device: input.device ?? "desktop",
        context: input.context ?? {},
        created_by: input.createdBy,
        expires_at: input.expiresAt.toISOString(),
      })
      .select("*")
      .single()
  );
  return row as PreviewSessionRow;
}

/**
 * Exchanges a token for the draft payload it grants.
 *
 * Returns `null` for a token that is unknown *or* expired — the function
 * deliberately does not distinguish them, so a guesser learns nothing from the
 * difference.
 */
export async function resolvePreview(db: Db, token: string): Promise<ResolvedPreview | null> {
  const rows = unwrap("resolvePreview", await db.rpc("resolve_preview", { p_token: token }));
  const row = rows?.[0];
  if (!row) return null;

  return {
    entityType: row.entity_type as DocumentType,
    entityId: row.entity_id,
    device: row.device as PreviewDevice,
    expiresAt: row.expires_at,
    context: row.context,
    data: row.data,
  };
}

export async function listPreviewSessions(
  db: Db,
  type: DocumentType,
  entityId: string
): Promise<PreviewSessionRow[]> {
  return (
    (unwrap(
      "listPreviewSessions",
      await db
        .from("preview_sessions")
        .select("*")
        .eq("entity_type", type)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false })
    ) as PreviewSessionRow[]) ?? []
  );
}

/** Revoking a share link before it expires. */
export async function deletePreviewSession(db: Db, token: string): Promise<void> {
  unwrap("deletePreviewSession", await db.from("preview_sessions").delete().eq("token", token));
}
