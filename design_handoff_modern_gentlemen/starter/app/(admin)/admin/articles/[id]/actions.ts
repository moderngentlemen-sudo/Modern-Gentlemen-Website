"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { saveDraft } from "@/lib/services/documents";
import { publish, rollback, schedule, snapshot, unpublish } from "@/lib/services/publishing";
import { createPreview } from "@/lib/services/preview";
import type { Json } from "@/lib/db/database.types";
import { ok, type ActionResult } from "../../_lib/action-result";
import { toActionResult } from "../../_lib/errors";

/**
 * The article builder's bridge to the services.
 *
 * Deliberately written out rather than generated from a shared factory over the
 * document type. A `"use server"` module may export only async functions, and
 * Next assigns each export an action id at build time; a factory-produced
 * export would probably work, but "probably" plus a failure mode that only
 * appears when a real browser opens a real page is precisely the combination
 * that broke every builder load in Phase 4. Eight thin wrappers that are
 * obviously correct beat one clever one that is hard to check.
 *
 * The services underneath are entirely type-agnostic — `publish("article", …)`
 * runs the same SQL transaction as `publish("page", …)`, and asserts
 * `article.publish` inside the function rather than trusting this layer.
 */
const Id = z.string().uuid();

/**
 * Structural validation only; content validation is the manifests' job and
 * happens at publish. `sections` is `BLOCK_TREE_KEY.article`, and `passthrough`
 * is what carries `hero`, `body` and `seo` through a save untouched.
 */
const BlockNodeish = z.object({ _key: z.string().min(1), _type: z.string().min(1) }).passthrough();
const SavePayload = z.object({ sections: z.array(BlockNodeish) }).passthrough();

function revalidateArticle(id: string): void {
  revalidatePath("/admin/articles");
  revalidatePath(`/admin/articles/${id}`);
}

export async function saveDraftAction(input: unknown): Promise<ActionResult<{ savedAt: string }>> {
  const parsed = z.object({ id: Id, payload: SavePayload }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "That article payload is not in a valid shape." };

  try {
    await saveDraft("article", parsed.data.id, parsed.data.payload as Json);
    // No revalidatePath: autosave fires every couple of seconds while an editor
    // types, and busting the route cache on each burst is pure churn.
    return ok({ savedAt: new Date().toISOString() });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function publishAction(input: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = z.object({ id: Id, note: z.string().trim().max(500).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    const version = await publish("article", parsed.data.id, parsed.data.note);
    revalidateArticle(parsed.data.id);
    return ok({ version });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function unpublishAction(input: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = z.object({ id: Id, note: z.string().trim().max(500).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    const version = await unpublish("article", parsed.data.id, parsed.data.note);
    revalidateArticle(parsed.data.id);
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
    const version = await snapshot("article", parsed.data.id, parsed.data.label);
    revalidateArticle(parsed.data.id);
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
      "article",
      parsed.data.id,
      parsed.data.version,
      parsed.data.note
    );
    revalidateArticle(parsed.data.id);
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
    // `article` is in SCHEDULABLE_TYPES alongside `page`. Nothing fires a
    // scheduled document yet — the runner is still Phase 6, and the builder
    // says so rather than implying otherwise.
    const version = await schedule(
      "article",
      parsed.data.id,
      new Date(parsed.data.whenIso),
      parsed.data.note
    );
    revalidateArticle(parsed.data.id);
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
      type: "article",
      entityId: parsed.data.id,
      device: parsed.data.device,
    });
    return ok({ path: preview.path, expiresAt: preview.expiresAt });
  } catch (error) {
    return toActionResult(error);
  }
}
