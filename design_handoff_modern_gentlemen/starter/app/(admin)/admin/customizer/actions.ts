"use server";
import { z } from "zod";
import {
  loadAppearancePage,
  loadAppearanceTheme,
  saveAppearancePage,
  saveAppearanceTheme,
  previewAppearancePage,
} from "@/lib/services/appearanceCustomizer";
import { toActionResult } from "../_lib/errors";
import { ok } from "../_lib/action-result";
import { publishAction } from "../pages/[id]/actions";
import { publishThemeAction } from "../theme/actions";
export async function loadPageAction(id: string) {
  try {
    return ok(await loadAppearancePage(id));
  } catch (e) {
    return toActionResult(e);
  }
}
export async function savePageAction(input: unknown) {
  try {
    return ok(await saveAppearancePage(input));
  } catch (e) {
    return toActionResult(e);
  }
}
export async function saveThemeAction(input: unknown) {
  try {
    return ok(await saveAppearanceTheme(input));
  } catch (e) {
    return toActionResult(e);
  }
}
export async function previewPageAction(input: unknown) {
  try {
    return ok(await previewAppearancePage(input));
  } catch (e) {
    return toActionResult(e);
  }
}
export async function publishAppearanceAction(input: unknown) {
  try {
    const data = z
      .object({
        scope: z.enum(["page", "theme"]),
        id: z.string().uuid().optional(),
        expectedUpdatedAt: z.string().min(1),
      })
      .strict()
      .parse(input);
    const saved =
      data.scope === "theme"
        ? await loadAppearanceTheme()
        : await loadAppearancePage(z.string().uuid().parse(data.id));
    if (saved.updatedAt !== data.expectedUpdatedAt)
      throw new Error(
        "The draft changed after your last review. Reopen and review it before publishing."
      );
    return data.scope === "theme"
      ? await publishThemeAction({ note: "Published from Appearance Studio" })
      : await publishAction({ id: data.id, note: "Published from Appearance Studio" });
  } catch (e) {
    return toActionResult(e);
  }
}
