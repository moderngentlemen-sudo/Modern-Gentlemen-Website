"use client";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { MediaImage } from "@/components/ui/MediaImage";
import { type ArticleFeaturedMedia } from "@/lib/domain/articles";
import { articleDesignById, type ArticleDesign } from "@/lib/domain/articleDesign";
import { ArticleDesignMedia } from "./ArticleDesignMedia";
import styles from "./EditorialArticle.module.css";
export interface EditorialArticleContent {
  slug: string;
  title: string;
  dek?: string;
  category?: string;
  issue?: string;
  author?: string;
  read?: number;
  image?: string;
  media?: ArticleFeaturedMedia;
}
export function EditorialArticle({
  article,
  design,
  children,
  preview = false,
}: {
  article: EditorialArticleContent;
  design: ArticleDesign;
  children?: ReactNode;
  preview?: boolean;
}) {
  const preset = articleDesignById(design.preset);
  const content = useRef<HTMLDivElement>(null),
    prefix = useId().replaceAll(":", "");
  const [headings, setHeadings] = useState<{ id: string; text: string }[]>([]),
    [large, setLarge] = useState(false),
    [saved, setSaved] = useState(false),
    [notice, setNotice] = useState(""),
    [player, setPlayer] = useState(false);
  const playerChange = useCallback((open: boolean) => setPlayer(open), []);
  useEffect(() => {
    content.current?.querySelector("p")?.setAttribute("data-article-intro", "true");
    const entries = Array.from(
      content.current?.querySelectorAll<HTMLElement>("h2,h3") || []
    ).filter((el) => el.textContent?.trim());
    entries.forEach((el, i) => {
      if (!el.id) el.id = `article-${prefix}-${i}`;
    });
    setHeadings(entries.map((el) => ({ id: el.id, text: el.textContent || "" })));
  }, [children, prefix]);
  useEffect(() => {
    if (preview) return;
    try {
      const values = JSON.parse(localStorage.getItem("mg-saved-articles") || "[]");
      setSaved(
        Array.isArray(values) && values.some((v: { slug?: string }) => v?.slug === article.slug)
      );
    } catch {}
  }, [article.slug, preview]);
  if (!preset) return <>{children}</>;
  const save = () => {
    if (preview) {
      setSaved((v) => !v);
      return;
    }
    try {
      const raw = JSON.parse(localStorage.getItem("mg-saved-articles") || "[]");
      const values = (Array.isArray(raw) ? raw : []).filter((v) => v?.slug !== article.slug);
      if (!saved) values.unshift({ slug: article.slug, title: article.title });
      localStorage.setItem("mg-saved-articles", JSON.stringify(values.slice(0, 100)));
      setSaved(!saved);
      setNotice(saved ? "Removed from saved articles." : "Saved on this device.");
    } catch {
      setNotice("This browser could not save the article.");
    }
  };
  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/article/${article.slug}`);
      setNotice("Article link copied.");
    } catch {
      setNotice("Copy the article address from your browser to share it.");
    }
  };
  const secondary = article.media?.gallery?.[1];
  const vars = {
    "--ad-body-width": `${design.bodyWidth || 720}px`,
    "--ad-body-size": `${(design.bodySize || 18) + (large ? 2 : 0)}px`,
    "--ad-title-size": design.titleSize ? `${design.titleSize}px` : undefined,
    "--ad-hero-height": design.heroHeight ? `${design.heroHeight}px` : undefined,
    "--ad-title-color": design.titleColor,
    "--ad-title-align": design.titleAlign,
    "--ad-media-fit": design.mediaFit || "cover",
    "--ad-media-position": `${design.focalX ?? 50}% ${design.focalY ?? 50}%`,
    "--ad-image-filter": design.imageColor === false ? "grayscale(1)" : "none",
  } as CSSProperties;
  return (
    <div className={styles.frame}>
      <article
        className={`${styles.root} ${styles[preset.layout]}`}
        style={vars}
        data-custom-height={!!design.heroHeight}
        data-custom-size={!!design.titleSize}
        data-custom-align={!!design.titleAlign}
        data-custom-color={!!design.titleColor}
        data-article-design={preset.id}
        data-player-open={player}
        data-has-media={
          !!(
            article.image ||
            article.media?.cover ||
            article.media?.video ||
            article.media?.embedUrl ||
            article.media?.gallery?.length
          )
        }
        data-custom-overlay={!!design.overlay && design.overlay.mode !== "none"}
      >
        <header className={styles.hero}>
          <ArticleDesignMedia
            media={article.media}
            image={article.image}
            title={article.title}
            design={design}
            onPlayerChange={playerChange}
          />
          {secondary && (
            <figure className={styles["secondary-media"]}>
              <MediaImage src={secondary.url} alt={secondary.alt || ""} slot="gallery" />
            </figure>
          )}
          <div className={styles["hero-head"]}>
            <div className={styles.eyebrow}>
              <span className={styles.category}>{article.category || "Editorial"}</span>
              {article.read && (
                <>
                  <span className={styles["meta-dot"]} aria-hidden />
                  <span className={styles["reading-time"]}>{article.read} min read</span>
                </>
              )}
            </div>
            <h1>{article.title}</h1>
            {article.dek && <p className={styles.deck}>{article.dek}</p>}
            <div className={styles.byline}>
              <span className={styles["author-mark"]} aria-hidden>
                {(article.author || "Modern Gentlemen")
                  .split(" ")
                  .map((v) => v[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <div className={styles["author-copy"]}>
                {article.author || "Modern Gentlemen"}
                {article.issue && <small>Issue {article.issue}</small>}
              </div>
              <button className={styles["hero-save"]} aria-pressed={saved} onClick={save}>
                {saved ? "Saved" : "Save article"}
              </button>
            </div>
          </div>
          {article.media?.cover?.alt && (
            <figcaption className={styles["hero-note"]}>
              <strong>In focus</strong>
              {article.media.cover.alt}
            </figcaption>
          )}
          {article.issue && (
            <span className={styles.folio}>Modern Gentlemen · {article.issue}</span>
          )}
        </header>
        <div className={styles["article-shell"]}>
          <aside className={styles["reading-rail"]} aria-label="Reading tools">
            <span className={styles["rail-label"]}>The article</span>
            <button onClick={() => setLarge((v) => !v)} aria-pressed={large}>
              <span className={styles["type-symbol"]} aria-hidden>
                Aa
              </span>{" "}
              {large ? "Regular type" : "Larger type"}
            </button>
            <button onClick={() => void share()}>Share ↗</button>
            <button onClick={save} aria-pressed={saved}>
              {saved ? "Saved" : "Save"}
            </button>
            {notice && <p role="status">{notice}</p>}
          </aside>
          <div ref={content} className={styles.prose}>
            {children}
          </div>
          {headings.length > 0 && (
            <nav className={styles["story-aside"]} aria-label="In this article">
              <span className={styles["aside-label"]}>In this article</span>
              {headings.map((heading, i) => (
                <a key={heading.id} href={`#${heading.id}`}>
                  <span>{String(i + 1).padStart(2, "0")}</span> {heading.text}
                </a>
              ))}
            </nav>
          )}
        </div>
      </article>
    </div>
  );
}
