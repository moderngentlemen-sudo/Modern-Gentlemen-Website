import { ArticleBody } from "@/components/article/ArticleBody";
import { ArticleHero } from "@/components/article/ArticleHero";
import { authorInitial, layoutFor, type ArticlePresentation } from "@/lib/domain/articles";

const PREVIEW_SCALE = 0.5;

/**
 * The article editor's unsaved composition preview.
 *
 * It renders the same hero and body dispatchers as `/article/[slug]`; the only
 * difference is a scale transform and a clipped viewport. That keeps template,
 * header and appearance previews tied to production markup instead of a second
 * set of thumbnails that can drift from it.
 */
export function ArticlePresentationPreview({
  template,
  presentation,
  title,
  dek,
  category,
  issue,
  author,
  readingMinutes,
  image,
}: {
  template: string;
  presentation: ArticlePresentation;
  title: string;
  dek?: string | null;
  category?: string | null;
  issue?: string | null;
  author?: string | null;
  readingMinutes?: number | null;
  image?: string | null;
}) {
  const layout = layoutFor(template);
  const displayAuthor = author || "Modern Gentlemen";
  const kicker = `${category || "Editorial"}${issue ? ` · NO. ${issue}` : ""}`;
  const byline = `WORDS · ${displayAuthor}${readingMinutes ? ` · ${readingMinutes} MIN READ` : ""}`;

  return (
    <section
      aria-label="Article presentation preview"
      data-article-presentation-preview
      data-preview-template={template}
      data-preview-hero={layout.hero}
      data-preview-body={layout.body}
      data-preview-header={presentation.headerMode}
      data-preview-appearance={presentation.appearance}
      className="overflow-hidden border border-mg-bd/15 bg-mg-bg"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-mg-bd/15 px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-mg-fg/60">
          Live composition preview
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-mg-fg/50">
          {layout.hero} hero · {layout.body} body
        </span>
      </div>
      <div
        aria-hidden
        className="pointer-events-none relative h-[460px] overflow-hidden bg-mg-bg select-none"
      >
        <div
          style={{
            width: `${100 / PREVIEW_SCALE}%`,
            transform: `scale(${PREVIEW_SCALE})`,
            transformOrigin: "top left",
          }}
        >
          <div className="pt-[72px]">
            <ArticleHero
              variant={layout.hero}
              kicker={kicker}
              title={title.trim() || "Untitled article"}
              dek={dek?.trim() || undefined}
              byline={byline}
              image={image || undefined}
              presentation={presentation}
            />
            <ArticleBody
              variant={layout.body}
              author={displayAuthor}
              authorInitial={authorInitial(displayAuthor)}
              issue={issue || ""}
            />
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-mg-bg to-transparent" />
      </div>
    </section>
  );
}
