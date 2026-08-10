/**
 * Publishing — a thin, permission-checked layer over the transactional
 * functions in `0010_publishing.sql`.
 *
 * The real work is in SQL because publishing writes three things at once (the
 * payload, a revision, an audit event) and they must succeed or fail together.
 * What this file adds is the fail-fast permission check, the *validation* gate,
 * and translation of Postgres error codes into errors the admin can render.
 *
 * The validation gate is the point where Phase 2 pays for itself: a document
 * whose blocks do not satisfy their own manifests is refused here, while the
 * editor is still looking at it.
 */

import { createClient } from "@/lib/db/server";
import * as repo from "@/lib/db/repositories/documents";
import type { Database } from "@/lib/db/database.types";
import { ForbiddenError, type Permission } from "@/lib/domain/permissions";
import { isSchedulable, type DocumentType } from "@/lib/domain/documents";
import { requirePermission } from "./auth";
import { InvalidDocumentError, permissionFor, validateDocumentPayload } from "./documents";

type Rpc = keyof Database["public"]["Functions"];

/**
 * Turns a PostgREST RPC failure into the right domain error.
 *
 * `0010` raises `42501` for its own permission checks and for anything RLS
 * refuses, and `P0002` when the row is absent — which is also what a caller
 * sees when RLS hides it, and correctly so.
 *
 * Exported for `theme.ts`, which calls the same RPCs for an entity that is a
 * document in SQL but deliberately not a `DocumentType` in TypeScript, and so
 * cannot come through the functions below. Shared rather than copied because a
 * second copy of this mapping would drift the first time `0010` grew a code.
 */
export function rpcError(
  fn: Rpc,
  permission: Permission,
  error: { code?: string; message: string }
): Error {
  if (error.code === "42501") return new ForbiddenError(permission);
  if (error.code === "P0002") return new Error(`${fn}: not found`);
  return new Error(`${fn}: ${error.message}`);
}

async function assertPublishable(type: DocumentType, id: string): Promise<void> {
  const db = await createClient();
  const doc = await repo.getDocument(db, type, id);
  if (!doc) throw new Error(`No such ${type}: ${id}`);

  const validation = validateDocumentPayload(type, doc.draft_data);
  if (!validation.ok) throw new InvalidDocumentError(validation.issues);
}

/**
 * Publishes the current draft. Returns the new version.
 *
 * Validation runs before the RPC rather than inside it: the manifests live in
 * TypeScript, and duplicating them as database constraints would create exactly
 * the second source of truth Phase 2 removed.
 */
export async function publish(type: DocumentType, id: string, note?: string): Promise<number> {
  const permission = permissionFor(type, "publish");
  await requirePermission(permission);
  await assertPublishable(type, id);

  const db = await createClient();
  const { data, error } = await db.rpc("publish_document", {
    p_entity_type: type,
    p_entity_id: id,
    p_note: note,
  });

  if (error) throw rpcError("publish_document", permission, error);
  return data as number;
}

/** Takes it off the site. `published_data` is kept, so re-publishing is one step. */
export async function unpublish(type: DocumentType, id: string, note?: string): Promise<number> {
  const permission = permissionFor(type, "publish");
  await requirePermission(permission);

  const db = await createClient();
  const { data, error } = await db.rpc("unpublish_document", {
    p_entity_type: type,
    p_entity_id: id,
    p_note: note,
  });

  if (error) throw rpcError("unpublish_document", permission, error);
  return data as number;
}

/** A named checkpoint of the current draft, without publishing it. */
export async function snapshot(type: DocumentType, id: string, label?: string): Promise<number> {
  const permission = permissionFor(type, "write");
  await requirePermission(permission);

  const db = await createClient();
  const { data, error } = await db.rpc("snapshot_document", {
    p_entity_type: type,
    p_entity_id: id,
    p_label: label,
  });

  if (error) throw rpcError("snapshot_document", permission, error);
  return data as number;
}

/**
 * Restores an earlier revision **into the draft**. Nothing goes live until the
 * editor publishes: an undo that silently shipped would be a worse mistake than
 * the one it was undoing.
 */
export async function rollback(
  type: DocumentType,
  id: string,
  version: number,
  note?: string
): Promise<number> {
  await requirePermission("revision.restore");

  const db = await createClient();
  const { data, error } = await db.rpc("rollback_document", {
    p_entity_type: type,
    p_entity_id: id,
    p_version: version,
    p_note: note,
  });

  if (error) throw rpcError("rollback_document", "revision.restore", error);
  return data as number;
}

/**
 * Records an intent to publish later. Phase 6 adds the runner that fires it, so
 * until then this parks the document in `scheduled` and nothing acts on it.
 */
export async function schedule(
  type: DocumentType,
  id: string,
  when: Date,
  note?: string
): Promise<number> {
  const permission = permissionFor(type, "publish");
  await requirePermission(permission);

  if (!isSchedulable(type)) {
    throw new Error(`${type} documents cannot be scheduled — only pages and articles can.`);
  }
  if (when.getTime() <= Date.now()) {
    throw new Error("A scheduled publish time must be in the future.");
  }

  await assertPublishable(type, id);

  const db = await createClient();
  const { data, error } = await db.rpc("schedule_document", {
    p_entity_type: type,
    p_entity_id: id,
    p_when: when.toISOString(),
    p_note: note,
  });

  if (error) throw rpcError("schedule_document", permission, error);
  return data as number;
}
