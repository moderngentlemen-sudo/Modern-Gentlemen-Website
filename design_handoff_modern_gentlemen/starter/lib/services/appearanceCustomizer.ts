import { z } from "zod";
import { requirePermission } from "./auth";
import { getDocument, listDocuments } from "./documents";
import { createClient } from "@/lib/db/server";
import { getThemeByKey, saveThemeDraftIfCurrent } from "@/lib/db/repositories/theme";
import { saveStudioDraft } from "@/lib/db/repositories/studioDrafts";
import {
  parseThemeSettings,
  themeSettingsSchema,
  THEME_KEY,
  THEME_PAYLOAD_VERSION,
} from "@/lib/domain/theme";
import {
  applyAppearanceChanges,
  appearanceChangesSchema,
  type AppearancePayload,
} from "@/lib/blocks/appearanceCustomizer";
import type { Json } from "@/lib/db/database.types";
import { expandPatternRefs } from "./patterns";

export async function loadAppearancePage(id: string) {
  await requirePermission("page.read");
  z.string().uuid().parse(id);
  const page = await getDocument("page", id);
  if (!page) throw new Error("Page not found.");
  const payload = page.draft_data as unknown as AppearancePayload;
  if (!Array.isArray(payload?.sections)) throw new Error("This page has no editable section tree.");
  return { id: page.id, title: page.title, slug: page.slug, updatedAt: page.updated_at, payload };
}
export async function loadAppearanceTheme() {
  await requirePermission("theme.read");
  const row = await getThemeByKey(await createClient(), THEME_KEY);
  if (!row) throw new Error("Theme not found.");
  return { updatedAt: row.updated_at, settings: parseThemeSettings(row.draft_data) };
}
export async function listAppearancePages() {
  await requirePermission("page.read");
  const pages = [];
  for (let offset = 0; ; offset += 100) {
    const batch = await listDocuments("page", { limit: 100, offset });
    pages.push(...batch.map(({ id, title, slug }) => ({ id, title, slug })));
    if (batch.length < 100) return pages;
  }
}
const pageInput = z
  .object({
    id: z.string().uuid(),
    expectedUpdatedAt: z.string().min(1),
    changes: appearanceChangesSchema,
  })
  .strict();
export async function saveAppearancePage(input: unknown) {
  const user = await requirePermission("page.write");
  const data = pageInput.parse(input);
  const page = await loadAppearancePage(data.id);
  const payload = applyAppearanceChanges(page.payload, data.changes);
  const updatedAt = await saveStudioDraft(await createClient(), {
    id: data.id,
    expectedUpdatedAt: data.expectedUpdatedAt,
    payload: payload as unknown as Json,
    updatedBy: user.id,
  });
  // Only appearance changes are accepted: media URLs, SEO, identity and content cannot change.
  return { ...page, payload, updatedAt };
}
export async function saveAppearanceTheme(input: unknown) {
  await requirePermission("theme.write");
  const data = z
    .object({ expectedUpdatedAt: z.string().min(1), settings: themeSettingsSchema })
    .strict()
    .parse(input);
  const db = await createClient();
  const row = await getThemeByKey(db, THEME_KEY);
  if (!row) throw new Error("Theme not found.");
  const updatedAt = await saveThemeDraftIfCurrent(db, row.id, data.expectedUpdatedAt, {
    version: THEME_PAYLOAD_VERSION,
    ...data.settings,
  });
  return { updatedAt, settings: parseThemeSettings(data.settings) };
}
export async function previewAppearancePage(input: unknown) {
  await requirePermission("page.read");
  const data = pageInput.parse(input);
  const page = await loadAppearancePage(data.id);
  if (page.updatedAt !== data.expectedUpdatedAt)
    throw new Error("This page changed in another editor. Reopen it to refresh the preview.");
  const payload = applyAppearanceChanges(page.payload, data.changes);
  return {
    sections: await expandPatternRefs(payload.sections, { preferDraft: true }),
    pageSettings: payload.pageSettings,
  };
}
