"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { editorialConcept } from "@/lib/domain/editorialCollection";
import { createPage } from "@/lib/services/documents";
import { createArticle } from "@/lib/services/articles";
import { toActionResult } from "../_lib/errors";
import { ok, type ActionResult } from "../_lib/action-result";

const CreateInput = z
  .object({
    concept: z.string().refine((id) => !!editorialConcept(id), "Choose a collection design."),
    title: z.string().trim().min(1, "Enter a title.").max(200),
    slug: z
      .string()
      .trim()
      .min(1, "Enter a slug.")
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens."),
  })
  .strict();

export async function createCollectionDraftAction(
  input: unknown
): Promise<ActionResult<{ path: string }>> {
  const parsed = CreateInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message || "Invalid input." };
  const concept = editorialConcept(parsed.data.concept)!;
  const { title, slug } = parsed.data;
  try {
    const article = concept.kind === "article";
    const document = article
      ? await createArticle({ title, slug, collectionId: concept.id })
      : await createPage({ title, slug, collectionId: concept.id });
    revalidatePath(article ? "/admin/articles" : "/admin/pages");
    return ok({ path: article ? `/admin/articles/${document.id}` : `/admin/pages/${document.id}` });
  } catch (error) {
    return toActionResult(error);
  }
}
