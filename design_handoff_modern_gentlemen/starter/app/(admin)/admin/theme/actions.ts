"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { publishTheme, rollbackTheme, saveThemeDraft, unpublishTheme } from "@/lib/services/theme";
import { themeSettingsSchema } from "@/lib/domain/theme";
import { ok, type ActionResult } from "../_lib/action-result";
import { toActionResult } from "../_lib/errors";

/**
 * Theme actions.
 *
 * Written out one per operation rather than generated from a factory, for the
 * reason the navigation and article actions both record: a `"use server"` module
 * may export only async functions and Next assigns each export an action id at
 * build time, so a factory-produced export would *probably* work — and
 * "probably", with a failure mode that only appears when a real browser opens a
 * real page, is the exact combination that broke every builder load in Phase 4.
 *
 * **Every write revalidates `/` as a layout, and this is the widest blast radius
 * of any action in the admin.** The `<style>` block carrying the tokens is in
 * `app/layout.tsx` — the *root* layout, above both route groups — so a theme
 * change touches all 65 static pages plus the admin. Revalidating one path would
 * leave the rest serving the old palette until their hour was up.
 *
 * No permission check here. `lib/services/theme.ts` asserts `theme.write` /
 * `theme.publish` on every entry point and RLS re-asserts it underneath; an
 * action that checked as well would be a third copy to keep in step.
 */

const Note = z.object({ note: z.string().trim().max(500).optional() }).optional();

/**
 * The colours arrive as a plain object from the form and are validated by the
 * domain schema rather than a form-shaped one. There is no second shape to
 * describe: unlike a product, where `MetaInput` exists because a form field is
 * not a product fact, a theme *is* its colours.
 */
const SaveDraft = themeSettingsSchema;

function invalid(error: z.ZodError): ActionResult<never> {
  const issue = error.issues[0];
  const path = issue?.path.join(".");
  return {
    ok: false,
    error: path ? `${path}: ${issue?.message}` : (issue?.message ?? "Invalid input"),
  };
}

/** The tokens are in the root layout, so every page is affected. */
function done(): ActionResult {
  revalidatePath("/admin/theme", "layout");
  revalidatePath("/", "layout");
  return ok(undefined);
}

export async function saveThemeDraftAction(input: unknown): Promise<ActionResult> {
  const parsed = SaveDraft.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    await saveThemeDraft(parsed.data);
    // Deliberately still revalidates. Saving a draft changes nothing the public
    // can see — but it changes what /admin/theme must show on the next load, and
    // that page is force-dynamic anyway, so the cost is a cache hint nobody
    // pays for twice.
    return done();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function publishThemeAction(input: unknown): Promise<ActionResult> {
  const parsed = Note.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    await publishTheme(parsed.data?.note);
    return done();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function unpublishThemeAction(input: unknown): Promise<ActionResult> {
  const parsed = Note.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    await unpublishTheme(parsed.data?.note);
    return done();
  } catch (error) {
    return toActionResult(error);
  }
}

/**
 * Restore an earlier theme into the draft.
 *
 * `HistoryView` is shared with every document type, so it passes `{ id, version }`
 * — but there is exactly one theme row and the service looks it up by key, so
 * the id is accepted and ignored rather than trusted. Taking an id from the
 * client and writing to whatever row it named is how a shared component turns
 * into a way to edit something else.
 *
 * Unlike the other three actions here, this does **not** revalidate `/`: a
 * rollback lands in the draft and the public site is still serving the last
 * published palette. Revalidating would be a lie about what changed, and an
 * expensive one — the `<style>` block lives in the root layout, so it rebuilds
 * every static page.
 */
const Rollback = z.object({
  id: z.string().uuid().optional(),
  version: z.number().int().nonnegative(),
  note: z.string().max(500).optional(),
});

export async function rollbackThemeAction(
  input: unknown
): Promise<ActionResult<{ version: number }>> {
  const parsed = Rollback.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    const version = await rollbackTheme(parsed.data.version, parsed.data.note);
    revalidatePath("/admin/theme");
    revalidatePath("/admin/theme/history");
    return ok({ version });
  } catch (error) {
    return toActionResult(error);
  }
}
