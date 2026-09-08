import { z } from "zod";
import {
  convertStudio,
  studioSourceSchema,
  STUDIO_SOURCE_KEY,
} from "@/lib/blocks/studioPublishing";
import { createClient } from "@/lib/db/server";
import { createPage } from "@/lib/db/repositories/pages";
import { saveStudioDraft } from "@/lib/db/repositories/studioDrafts";
import type { Json } from "@/lib/db/database.types";
import { requirePermission } from "./auth";
import { getDocument, getDocumentBySlug, blockTreesOf } from "./documents";
import { reconcileEntityMedia } from "./media";

const inputSchema = z.object({
  id: z.string().uuid().optional(),
  expectedUpdatedAt: z.string().optional(),
  title: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  document: studioSourceSchema,
});
const reserved = new Set([
  "home",
  "admin",
  "api",
  "auth",
  "articles",
  "article",
  "product",
  "shop",
  "bag",
  "checkout",
  "membership",
  "sign-in",
  "forgot-password",
  "reset-password",
  "about",
  "preview",
]);
export async function saveStudioPage(input: unknown) {
  const user = await requirePermission("page.write");
  const result = inputSchema.safeParse(input);
  if (!result.success)
    throw new Error(
      "Enter a title, a lowercase hyphen-separated URL, and a valid Studio document (up to 8 MB)."
    );
  const data = result.data,
    db = await createClient();
  const current = data.id ? await getDocument("page", data.id) : null;
  if (
    data.id &&
    (!current || !(current.draft_data as Record<string, unknown>)?.[STUDIO_SOURCE_KEY])
  )
    throw new Error(
      "Only a saved Design Studio page can be updated here. Save as a new page to preserve existing content."
    );
  if (current && (current.title !== data.title || current.slug !== data.slug))
    throw new Error(
      "This page's title and URL are fixed here. Use Save as new page for a new title or URL."
    );
  if (current && !data.expectedUpdatedAt) throw new Error("Reopen this page before saving.");
  if (!current) {
    if (reserved.has(data.slug) || (await getDocumentBySlug("category", data.slug)))
      throw new Error("That URL is reserved for an existing site route.");
    if (await getDocumentBySlug("page", data.slug))
      throw new Error("That page URL is already in use. Choose another URL.");
  }
  const converted = convertStudio(data.document);
  // Only the active page travels into a page row. Workspace drafts are explicitly forbidden by the schema.
  const seo = data.document.source.seo as Record<string, unknown> | undefined;
  const payload = {
    sections: converted.sections,
    seo: {
      title: typeof seo?.title === "string" ? seo.title.slice(0, 200) : data.title,
      description: typeof seo?.description === "string" ? seo.description.slice(0, 500) : "",
    },
    pageSettings: { noIndex: seo?.index === false },
    [STUDIO_SOURCE_KEY]: data.document,
  } as unknown as Json;
  let id: string, updatedAt: string;
  if (current) {
    id = current.id;
    updatedAt = await saveStudioDraft(db, {
      id,
      expectedUpdatedAt: data.expectedUpdatedAt!,
      payload,
      updatedBy: user.id,
    });
  } else {
    const created = await createPage(db, {
      slug: data.slug,
      title: data.title,
      draftData: payload,
      createdBy: user.id,
    });
    id = created.id;
    updatedAt = created.updated_at;
  }
  try {
    await reconcileEntityMedia("page", id, blockTreesOf("page", payload));
  } catch (error) {
    console.error(`Studio media reconciliation failed for ${id}:`, error);
  }
  return { id, updatedAt, title: data.title, slug: data.slug, issues: converted.issues };
}

export async function loadStudioPage(id: string) {
  await requirePermission("page.write");
  if (!z.string().uuid().safeParse(id).success) throw new Error("Invalid page identifier.");
  const page = await getDocument("page", id);
  const document = studioSourceSchema.safeParse(
    (page?.draft_data as Record<string, unknown> | null)?.[STUDIO_SOURCE_KEY]
  );
  if (!page || !document.success) throw new Error("This page was not saved from Design Studio.");
  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    updatedAt: page.updated_at,
    document: document.data,
    issues: convertStudio(document.data).issues,
  };
}
