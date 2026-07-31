"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { saveDraft } from "@/lib/services/documents";
import { publish, rollback, schedule, snapshot, unpublish } from "@/lib/services/publishing";
import { createPreview, revokePreview } from "@/lib/services/preview";
import type { Json } from "@/lib/db/database.types";
import { ok, type ActionResult } from "../../_lib/action-result";
import { toActionResult } from "../../_lib/errors";

/**
 * The builder's bridge to the services.
 *
 * A client component cannot import `lib/services` — ESLint's layering rules bar
 * it, and every service is async and permission-checked server-side anyway. So
 * these are the only way the canvas reaches persistence, and they are passed
 * into the builder as props: a server action reference is serializable across
 * the boundary, which keeps `components/admin/builder` free of any `app/`
 * import and leaves the store testable with fakes.
 */
const Id = z.string().uuid();

/**
 * Structural validation only.
 *
 * Content validation is the manifests' job and happens at publish. A draft save
 * deliberately accepts an incomplete block — `documents.saveDraft` says so —
 * because refusing to save an editor's half-finished work would lose it. What
 * is checked here is that the payload is the shape the database column expects.
 */
const BlockNodeish = z.object({ _key: z.string().min(1), _type: z.string().min(1) }).passthrough();

const SavePayload = z.object({ sections: z.array(BlockNodeish) }).passthrough();

export async function saveDraftAction(input: unknown): Promise<ActionResult<{ savedAt: string }>> {
  const parsed = z.object({ id: Id, payload: SavePayload }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "That page payload is not in a valid shape." };

  try {
    await saveDraft("page", parsed.data.id, parsed.data.payload as Json);
    // Deliberately no revalidatePath: this fires every couple of seconds while
    // an editor types, and busting the route cache on each keystroke burst
    // would be pure churn for a screen that is already client-rendered.
    return ok({ savedAt: new Date().toISOString() });
  } catch (error) {
    return toActionResult(error);
  }
}

function revalidatePage(id: string): void {
  revalidatePath("/admin/pages");
  revalidatePath(`/admin/pages/${id}`);
}

export async function publishAction(input: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = z.object({ id: Id, note: z.string().trim().max(500).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    const version = await publish("page", parsed.data.id, parsed.data.note);
    revalidatePage(parsed.data.id);
    return ok({ version });
  } catch (error) {
    // InvalidDocumentError carries its issues through, so the builder can put
    // them back onto the blocks that caused them.
    return toActionResult(error);
  }
}

export async function unpublishAction(input: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = z.object({ id: Id, note: z.string().trim().max(500).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    const version = await unpublish("page", parsed.data.id, parsed.data.note);
    revalidatePage(parsed.data.id);
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
    const version = await snapshot("page", parsed.data.id, parsed.data.label);
    revalidatePage(parsed.data.id);
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
    const version = await rollback("page", parsed.data.id, parsed.data.version, parsed.data.note);
    revalidatePage(parsed.data.id);
    return ok({ version });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function scheduleAction(input: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = z
    .object({ id: Id, whenIso: z.string().datetime(), note: z.string().max(500).optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a date and time in the future." };

  try {
    const version = await schedule(
      "page",
      parsed.data.id,
      new Date(parsed.data.whenIso),
      parsed.data.note
    );
    revalidatePage(parsed.data.id);
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
    const preview = await createPreview({
      type: "page",
      entityId: parsed.data.id,
      device: parsed.data.device,
    });
    return ok({ path: preview.path, expiresAt: preview.expiresAt });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function revokePreviewAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ token: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    await revokePreview(parsed.data.token);
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}
