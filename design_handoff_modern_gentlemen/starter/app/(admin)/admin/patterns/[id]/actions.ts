"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { saveDraft } from "@/lib/services/documents";
import { publish, rollback, snapshot, unpublish } from "@/lib/services/publishing";
import { createPreview } from "@/lib/services/preview";
import type { Json } from "@/lib/db/database.types";
import { ok, type ActionResult } from "../../_lib/action-result";
import { toActionResult } from "../../_lib/errors";

/**
 * The builder's bridge to the services, for patterns.
 *
 * Structurally the page actions with two differences, both of which matter:
 *
 *   1. The tree lives under `blocks`, not `sections` — `BLOCK_TREE_KEY.pattern`.
 *      A payload validated against the wrong key would be rejected on every
 *      save.
 *   2. **Nothing revalidates a public path.** A pattern has no public route of
 *      its own, and because every pattern created here is `detachable` its
 *      blocks were *copied* into whatever pages use it — so publishing one
 *      changes no rendered page. The moment synced patterns ship this stops
 *      being true and this file needs the equivalent of
 *      `revalidatePublicPage`: a synced pattern is expanded at render time, so
 *      publishing it would change every page that references it.
 */
const Id = z.string().uuid();

/** Structural validation only; content validation is the manifests' job at publish. */
const BlockNodeish = z.object({ _key: z.string().min(1), _type: z.string().min(1) }).passthrough();

const SavePayload = z.object({ blocks: z.array(BlockNodeish) }).passthrough();

export async function saveDraftAction(input: unknown): Promise<ActionResult<{ savedAt: string }>> {
  const parsed = z.object({ id: Id, payload: SavePayload }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "That pattern payload is not in a valid shape." };

  try {
    await saveDraft("pattern", parsed.data.id, parsed.data.payload as Json);
    // No revalidatePath, for the same reason the page action gives: this fires
    // every couple of seconds while an editor types.
    return ok({ savedAt: new Date().toISOString() });
  } catch (error) {
    return toActionResult(error);
  }
}

function revalidatePattern(id: string): void {
  revalidatePath("/admin/patterns");
  revalidatePath(`/admin/patterns/${id}`);
}

export async function publishAction(input: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = z.object({ id: Id, note: z.string().trim().max(500).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    const version = await publish("pattern", parsed.data.id, parsed.data.note);
    revalidatePattern(parsed.data.id);
    return ok({ version });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function unpublishAction(input: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = z.object({ id: Id, note: z.string().trim().max(500).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    const version = await unpublish("pattern", parsed.data.id, parsed.data.note);
    revalidatePattern(parsed.data.id);
    return ok({ version });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function snapshotAction(input: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = z
    .object({ id: Id, label: z.string().trim().max(200).optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    const version = await snapshot("pattern", parsed.data.id, parsed.data.label);
    revalidatePattern(parsed.data.id);
    return ok({ version });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function rollbackAction(input: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = z
    .object({
      id: Id,
      version: z.number().int().nonnegative(),
      note: z.string().max(500).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    const version = await rollback(
      "pattern",
      parsed.data.id,
      parsed.data.version,
      parsed.data.note
    );
    revalidatePattern(parsed.data.id);
    return ok({ version });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function createPreviewAction(
  input: unknown
): Promise<ActionResult<{ path: string; expiresAt: string }>> {
  const parsed = z
    .object({ id: Id, device: z.enum(["desktop", "tablet", "mobile"]).optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    // `/preview/[token]` is type-agnostic — it pulls the tree out with
    // `BLOCK_TREE_KEY[type]` and renders it through the same `SectionRenderer`
    // the live site uses — so a pattern previews as the fragment it is, with no
    // preview-route change.
    const preview = await createPreview({
      type: "pattern",
      entityId: parsed.data.id,
      device: parsed.data.device,
    });
    return ok({ path: preview.path, expiresAt: preview.expiresAt });
  } catch (error) {
    return toActionResult(error);
  }
}
