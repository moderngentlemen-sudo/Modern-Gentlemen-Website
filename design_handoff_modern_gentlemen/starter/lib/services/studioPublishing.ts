import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import {
  convertStudio,
  studioSourceSchema,
  studioMediaReferences,
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
  if (!result.success) {
    const fields: Record<string, string> = {
      source: "Current draft",
      desktop: "Desktop layout",
      tablet: "Tablet layout",
      mobile: "Mobile layout",
      title: "Page title",
      slug: "URL",
      id: "element ID",
      x: "horizontal position",
      y: "vertical position",
      w: "width",
      h: "height",
      height: "height",
      layoutDevice: "screen size",
      page: "background color",
    };
    const details = result.error.issues.slice(0, 4).map((issue) => {
      const path = issue.path.filter((part) => part !== "document" && part !== "views");
      const label =
        path
          .map((part, index) => {
            if (part === "nodes" || part === "sections") return "";
            if (typeof part === "number")
              return `${path[index - 1] === "nodes" ? "element" : "section"} ${part + 1}`;
            return fields[part] || part;
          })
          .filter(Boolean)
          .join(" · ") || "Studio document";
      return `${label}: ${issue.message}`;
    });
    const more =
      result.error.issues.length > 4
        ? ` (${result.error.issues.length - 4} more validation errors.)`
        : "";
    throw new Error(
      `Save to site failed. ${details.join("; ")}${more} Your browser draft is still available.`
    );
  }
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
    await reconcileEntityMedia(
      "page",
      id,
      blockTreesOf("page", payload),
      [],
      studioMediaReferences(data.document)
    );
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
  const converted = convertStudio(document.data);
  if (
    !converted.issues.length &&
    !isDeepStrictEqual((page.draft_data as Record<string, unknown>).sections, converted.sections)
  )
    converted.issues.push({
      path: "page",
      message:
        "Click Save to site again to update this saved layout with the current Studio publishing support.",
    });
  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    updatedAt: page.updated_at,
    document: document.data,
    issues: converted.issues,
  };
}
