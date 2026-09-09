"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import type { MegaTypography, StudioMegaMenuConfig } from "@/lib/blocks/studioFeatures";
import { libraryFontStack, libraryFontStylesheet } from "@/lib/domain/fontLibrary";
import { studioThemeInk } from "@/lib/blocks/studioTheme";
import { MediaImage } from "../ui/MediaImage";
import styles from "./StudioMegaMenu.module.css";
import { studioPixels } from "@/lib/blocks/studioSizing";

export function StudioMegaMenu({
  config,
  mobile = false,
}: {
  config: StudioMegaMenuConfig;
  width: number;
  mobile?: boolean;
}) {
  const [active, setActive] = useState(0);
  const [edges, setEdges] = useState({ start: true, end: false });
  const track = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const firstRender = useRef(true);
  const id = useId();
  const category = config.categories[active];
  const { storyAnimation = "rise", animationDuration = 220 } = config;
  const unit = studioPixels;
  const typography = (
    style: MegaTypography | undefined,
    font: string,
    size: number,
    heading = false
  ): CSSProperties => ({
    fontFamily: libraryFontStack(style?.font || font),
    fontSize: unit(style?.size ?? size),
    fontWeight: style?.weight ?? 400,
    lineHeight: style?.leading ?? (font === "google:DM Sans" ? 1.4 : 1.12),
    letterSpacing: unit(style?.tracking ?? 0),
    textAlign: style?.align ?? "left",
    fontStyle: (style?.italic ?? heading) ? "italic" : "normal",
    color: studioThemeInk(style?.color || config.color || "#f8f7f3"),
  });
  const font = config.font || "google:Instrument Serif";
  const fonts = new Set([
    font,
    "google:DM Sans",
    "google:IBM Plex Mono",
    ...Object.values(config.typeStyles || {}).map((style) => style.font),
  ]);
  const updateEdges = () => {
    const el = track.current;
    if (el)
      setEdges({
        start: el.scrollLeft <= 1,
        end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
      });
  };
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    el.scrollLeft = 0;
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    let animation: Animation | undefined;
    if (
      !firstRender.current &&
      storyAnimation !== "none" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const from =
        storyAnimation === "fade"
          ? "none"
          : storyAnimation === "slide"
            ? "translateX(18px)"
            : "translateY(7px)";
      animation = el.animate(
        [
          { opacity: 0, transform: from },
          { opacity: 1, transform: "none" },
        ],
        { duration: animationDuration, easing: "ease-out" }
      );
    }
    firstRender.current = false;
    return () => {
      observer.disconnect();
      animation?.cancel();
    };
  }, [active, animationDuration, storyAnimation]);
  const scroll = (direction: number) =>
    track.current?.scrollBy({
      left: direction * track.current.clientWidth * 0.85,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  if (!category) return null;
  return (
    <>
      {[...fonts]
        .map(libraryFontStylesheet)
        .filter((url): url is string => !!url)
        .map((url) => (
          <link key={url} rel="stylesheet" href={url} />
        ))}
      <div
        className={styles.menu}
        data-mobile={mobile || undefined}
        data-hover={config.hoverAnimation || "slide"}
        aria-label="Editorial categories"
        style={
          {
            "--mega-unit": unit(1),
            "--mega-accent": studioThemeInk(config.accent || "#c8102e"),
            "--mega-duration": `${animationDuration}ms`,
            color: studioThemeInk(config.color || "#f8f7f3"),
          } as CSSProperties
        }
      >
        <div
          className={styles.categories}
          role="tablist"
          aria-label="Story categories"
          aria-orientation="vertical"
        >
          {config.categories.map((item, index) => (
            <button
              key={index}
              type="button"
              role="tab"
              ref={(el) => {
                tabs.current[index] = el;
              }}
              id={`${id}-tab-${index}`}
              aria-controls={`${id}-panel`}
              aria-selected={active === index}
              tabIndex={active === index ? 0 : -1}
              style={typography(config.typeStyles?.category, font, mobile ? 42 : 48)}
              onClick={() => setActive(index)}
              onKeyDown={(event) => {
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? config.categories.length - 1
                      : event.key === "ArrowDown"
                        ? (index + 1) % config.categories.length
                        : event.key === "ArrowUp"
                          ? (index + config.categories.length - 1) % config.categories.length
                          : undefined;
                if (next !== undefined) {
                  event.preventDefault();
                  setActive(next);
                  tabs.current[next]?.focus();
                }
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className={styles.content}>
          <div
            className={styles.track}
            ref={track}
            role="tabpanel"
            id={`${id}-panel`}
            aria-labelledby={`${id}-tab-${active}`}
            tabIndex={0}
            onScroll={updateEdges}
          >
            {category.stories.map((story, index) => {
              const Body = story.url ? "a" : "div";
              return (
                <article className={styles.story} key={`${active}-${index}`}>
                  <Body {...(story.url ? { href: story.url, "aria-label": story.title } : {})}>
                    {story.image && (
                      <div className={styles.image}>
                        <MediaImage
                          src={story.image}
                          alt={story.alt ?? story.title}
                          slot="studioStory"
                        />
                      </div>
                    )}
                    <p className={styles.eyebrow}>{category.label}</p>
                    <h3
                      style={typography(config.typeStyles?.heading, font, mobile ? 28 : 23, true)}
                    >
                      {story.title}
                    </h3>
                    <p
                      className={styles.description}
                      style={typography(
                        config.typeStyles?.subtitle,
                        "google:DM Sans",
                        mobile ? 14 : 13
                      )}
                    >
                      {story.description}
                    </p>
                    {story.url && (
                      <span className={styles.cta}>
                        Read story <span aria-hidden="true">→</span>
                      </span>
                    )}
                  </Body>
                </article>
              );
            })}
          </div>
          <div className={styles.controls}>
            <span className={styles.status} aria-live="polite">
              {category.label} · {category.stories.length} stories
            </span>
            <button
              type="button"
              aria-label="Previous stories"
              disabled={edges.start}
              onClick={() => scroll(-1)}
            >
              ←
            </button>
            <button
              type="button"
              aria-label="Next stories"
              disabled={edges.end}
              onClick={() => scroll(1)}
            >
              →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
