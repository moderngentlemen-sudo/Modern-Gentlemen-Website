import { requirePermission } from "./auth";
import {
  getPublishedArticle,
  getPublishedArticleBuilder,
  listPublishedArticleCards,
} from "./publicEditorial";
import { expandPublicPatterns } from "./publicContent";
import { z } from "zod";
export async function listArticleDesignPreviews() {
  await requirePermission("page.read");
  const choices: { slug: string; title: string }[] = [];
  for (let offset = 0; ; offset += 48) {
    const result = await listPublishedArticleCards({ limit: 48, offset });
    choices.push(
      ...result.items.map((item) => ({ slug: item.href.split("/").pop()!, title: item.title }))
    );
    if (result.items.length < 48) return choices;
  }
}
export async function loadArticleDesignPreview(slug: string) {
  await requirePermission("page.read");
  z.string()
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .parse(slug);
  const [article, builder] = await Promise.all([
    getPublishedArticle(slug),
    getPublishedArticleBuilder(slug),
  ]);
  if (!article || !builder) throw new Error("Published article not found.");
  return {
    content: {
      slug: article.slug,
      title: article.title,
      dek: builder.editorial?.dek || article.dek,
      category: article.category,
      author: article.author,
      issue: article.issue,
      read: parseInt(article.read) || undefined,
      image: article.heroImage,
      media:
        article.featuredMedia ||
        (article.videoUrl
          ? { kind: "video" as const, video: { kind: "video" as const, url: article.videoUrl } }
          : undefined),
    },
    sections: await expandPublicPatterns(builder.sections),
    template: article.template,
    presentation: article.presentation,
  };
}
