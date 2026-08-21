"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { saveDraft } from "@/lib/services/documents";
import { publish, rollback, snapshot, unpublish } from "@/lib/services/publishing";
import { AREA_NAME_PATTERN, AREAS_KEY } from "@/lib/blocks/areas";
import type { Json } from "@/lib/db/database.types";
import { ok, type ActionResult } from "../../_lib/action-result";
import { toActionResult } from "../../_lib/errors";

/**
 * The builder's bridge to the services, for templates.
 *
 * Structurally the pattern actions with two differences:
 *
 *   1. **The payload holds a map of trees, not one tree.** `SavePayload` below
 *      is the only place in the app that has to say so — everything downstream
 *      already understood areas: `blockTreesOf` has walked them since Phase 3,
 *      so publish validation, revisions and version diffing cover every area
 *      without a line of change here.
 *   2. **Nothing revalidates a public path**, because nothing public renders a
 *      template yet. `template_assignments` resolves one to a record, and
 *      `resolveTemplateFor` has no caller on the render path. When that
 *      changes, this file needs the equivalent of `revalidatePublicPage` and it
 *      will not be a one-liner: a template applies to *every* record assigned
 *      to it, so publishing one invalidates a set rather than a path.
 */
const Id = z.string().uuid();

/** Structural validation only; content validation is the manifests' job at publish. */
const BlockNodeish = z.object({ _key: z.string().min(1), _type: z.string().min(1) }).passthrough();

/**
 * `{ areas: { <name>: BlockNode[] } }`.
 *
 * The key regex is not decoration. An area name reaches the client as a string
 * an editor typed, and it ends up inside a validation path
 * (`areas.main.0.headline`) that `stripTreePrefix` takes apart on the way back —
 * so a name carrying a dot would put an issue on the wrong control, or on none.
 * The store refuses one too; this is the boundary that does not trust it.
 */
const SavePayload = z
  .object({
    [AREAS_KEY]: z.record(z.string().regex(AREA_NAME_PATTERN), z.array(BlockNodeish)),
  })
  .passthrough();

export async function saveDraftAction(input: unknown): Promise<ActionResult<{ savedAt: string }>> {
  const parsed = z.object({ id: Id, payload: SavePayload }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That template payload is not in a valid shape." };
  }

  try {
    await saveDraft("template", parsed.data.id, parsed.data.payload as Json);
    // No revalidatePath, for the same reason the page action gives: this fires
    // every couple of seconds while an editor types.
    return ok({ savedAt: new Date().toISOString() });
  } catch (error) {
    return toActionResult(error);
  }
}

function revalidateTemplate(id: string): void {
  revalidatePath("/admin/templates");
  revalidatePath(`/admin/templates/${id}`);
}

export async function publishAction(input: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = z.object({ id: Id, note: z.string().trim().max(500).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    const version = await publish("template", parsed.data.id, parsed.data.note);
    revalidateTemplate(parsed.data.id);
    return ok({ version });
  } catch (error) {
    // InvalidDocumentError carries its issues through, each prefixed with the
    // area it came from, which is what lets the publish bar open the right area
    // before selecting the block.
    return toActionResult(error);
  }
}

export async function unpublishAction(input: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = z.object({ id: Id, note: z.string().trim().max(500).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    const version = await unpublish("template", parsed.data.id, parsed.data.note);
    revalidateTemplate(parsed.data.id);
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
    const version = await snapshot("template", parsed.data.id, parsed.data.label);
    revalidateTemplate(parsed.data.id);
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
      "template",
      parsed.data.id,
      parsed.data.version,
      parsed.data.note
    );
    revalidateTemplate(parsed.data.id);
    return ok({ version });
  } catch (error) {
    return toActionResult(error);
  }
}

/**
 * Templates cannot be previewed, and this refuses rather than pretending.
 *
 * `Builder` is passed `canPreview={false}` on the template route so the button
 * is not offered at all — but the action is a prop on a shape every builder
 * route fills in, and an action that silently minted a token for something
 * `/preview/[token]` renders as empty would be worse than one that says why.
 * `BLOCK_TREE_KEY.template` is `null`, so the preview route resolves a template
 * to no sections; giving it an area to render is a slice of its own.
 */
export async function createPreviewAction(): Promise<
  ActionResult<{ path: string; expiresAt: string }>
> {
  return {
    ok: false,
    error: "Templates cannot be previewed yet — the preview route renders one tree, not areas.",
  };
}
