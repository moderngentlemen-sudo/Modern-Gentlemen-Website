"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { saveDraft } from "@/lib/services/documents";
import { getTemplate, publicPathsForTemplate } from "@/lib/services/templates";
import { createPreview } from "@/lib/services/preview";
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
 *   2. **Publishing revalidates a set of paths, not one.** This was predicted
 *      here while it was still untrue, and it landed exactly as predicted: a
 *      template applies to every record assigned to it, so
 *      `revalidatePublicPage`'s one-slug shape does not carry over.
 *      `publicPathsForTemplate` resolves the set; `revalidatePublicTemplate`
 *      below walks it.
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

/**
 * Every public path this template frames, invalidated on publish.
 *
 * The set-valued sibling of `revalidatePublicPage`, and it takes the same stance
 * on failure for the same reason: a publish that succeeded has succeeded, and
 * failing the action because a cache hint could not be sent would report a false
 * failure for something the hourly `revalidate` backstop corrects by itself.
 *
 * ⚠️ **Unpublishing revalidates too.** A template that stops being published
 * stops framing its pages — `publishedTemplateArea` reads `status = 'published'`
 * — so the pages have to be rebuilt without it. Getting this wrong leaves the
 * old frame on the live site with nothing in the admin to explain it.
 */
async function revalidatePublicTemplate(id: string): Promise<void> {
  try {
    for (const path of await publicPathsForTemplate(id)) revalidatePath(path);
    const template = await getTemplate(id);
    if (template?.kind === "header" || template?.kind === "footer") {
      revalidatePath("/", "layout");
    }
  } catch (error) {
    console.error(`Published template ${id} but could not revalidate its pages:`, error);
  }
}

export async function publishAction(input: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = z.object({ id: Id, note: z.string().trim().max(500).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    const version = await publish("template", parsed.data.id, parsed.data.note);
    revalidateTemplate(parsed.data.id);
    await revalidatePublicTemplate(parsed.data.id);
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
    await revalidatePublicTemplate(parsed.data.id);
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
    // Rollback republishes an older payload, so the framed pages change — the
    // same reason the pages action revalidates here and not on `snapshot`.
    await revalidatePublicTemplate(parsed.data.id);
    return ok({ version });
  } catch (error) {
    return toActionResult(error);
  }
}

/**
 * Templates can be previewed now, and the token carries an area in its query
 * string rather than in the session row.
 *
 * This function used to refuse — `BLOCK_TREE_KEY.template` is `null`, so
 * `/preview/[token]` resolved a template to no sections and the honest thing
 * was to say so rather than mint a token for a blank page. The route reads
 * areas now, so the refusal is gone; what remains of the old reasoning is the
 * `area` parameter, which is the whole difference between this action and the
 * five identical ones beside it.
 *
 * **The area is validated here and again by the route**, and neither check is
 * redundant. This one is the client's claim about which area is open in the
 * builder, checked only for *shape*: the action cannot know which areas the
 * template has without a read it does not otherwise need, and a name that does
 * not exist is not a security problem — it is a link that falls back to the
 * marker's area. The route does the membership check, against the payload it
 * has already loaded. A token pasted with `?area=` hand-edited never reaches
 * this function at all, which is why the route is where that check has to live.
 */
export async function createPreviewAction(
  input: unknown
): Promise<ActionResult<{ path: string; expiresAt: string }>> {
  const parsed = z
    .object({
      id: Id,
      device: z.enum(["desktop", "tablet", "mobile"]).optional(),
      area: z.string().regex(AREA_NAME_PATTERN).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    const preview = await createPreview({
      type: "template",
      entityId: parsed.data.id,
      device: parsed.data.device,
    });

    const path = parsed.data.area
      ? `${preview.path}?area=${encodeURIComponent(parsed.data.area)}`
      : preview.path;

    return ok({ path, expiresAt: preview.expiresAt });
  } catch (error) {
    return toActionResult(error);
  }
}
