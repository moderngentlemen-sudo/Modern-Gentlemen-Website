/**
 * Preview sessions — sharing an unpublished document with someone who cannot
 * sign in.
 *
 * Creating one is a staff write under RLS. **Resolving one is deliberately not
 * permission-checked here**, because the whole point is that the holder of the
 * link may be anonymous. The check happens inside `resolve_preview` in `0010`,
 * which is `security definer` precisely so it can perform a capability check
 * RLS cannot express — and which returns nothing but one document's draft.
 */

import { createClient } from "@/lib/db/server";
import * as repo from "@/lib/db/repositories/previewSessions";
import type { DocumentType } from "@/lib/domain/documents";
import { requirePermission } from "./auth";

export type { PreviewDevice, ResolvedPreview } from "@/lib/db/repositories/previewSessions";

/** Matches the column default in `0008_versioning_and_preview.sql`. */
export const DEFAULT_PREVIEW_TTL_MS = 4 * 60 * 60 * 1000;

/** Long enough that a shared link is not brute-forceable, short enough to read aloud badly. */
const TOKEN_BYTES = 32;

/**
 * 256 bits from the platform CSPRNG, base64url so it survives a URL path
 * without escaping. `crypto.getRandomValues` rather than `node:crypto` keeps
 * this working under both the Node and Edge runtimes.
 */
export function generatePreviewToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);

  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface CreatePreviewInput {
  type: DocumentType;
  entityId: string;
  device?: repo.PreviewDevice;
  ttlMs?: number;
}

export async function createPreview(input: CreatePreviewInput) {
  const user = await requirePermission("preview.create");
  const db = await createClient();

  const token = generatePreviewToken();
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? DEFAULT_PREVIEW_TTL_MS));

  const session = await repo.createPreviewSession(db, {
    token,
    type: input.type,
    entityId: input.entityId,
    device: input.device,
    createdBy: user.id,
    expiresAt,
  });

  return { token: session.token, expiresAt: session.expires_at, path: `/preview/${session.token}` };
}

/**
 * Exchanges a token for the draft it grants. No permission check — see the file
 * header. Returns `null` for a token that is unknown *or* expired; the two are
 * not distinguished, so a guesser learns nothing from the difference.
 */
export async function resolvePreview(token: string) {
  const db = await createClient();
  return repo.resolvePreview(db, token);
}

export async function listPreviews(type: DocumentType, entityId: string) {
  await requirePermission("preview.create");
  const db = await createClient();
  return repo.listPreviewSessions(db, type, entityId);
}

/** Revoking a link that was shared too widely, before it expires on its own. */
export async function revokePreview(token: string): Promise<void> {
  await requirePermission("preview.create");
  const db = await createClient();
  await repo.deletePreviewSession(db, token);
}
