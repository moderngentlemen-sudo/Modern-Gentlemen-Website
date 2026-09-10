"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { MediaImage } from "@/components/ui/MediaImage";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { useScrollLock } from "@/lib/useScrollLock";
import { searchLayoutById, type SearchAppearance } from "@/lib/domain/searchPresets";
import { searchWords } from "@/lib/domain/search";
import { animateSearch } from "./searchMotion";
import { useSearchCollection, type SearchResult } from "./useSearchCollection";
import styles from "./SearchCollection.module.css";
const POPULAR = ["Watches", "Style", "Grooming", "Film", "Accessories"];
const DIRECT = new Set([
  "refined-original",
  "one-clear-list",
  "editorial-store",
  "compact-overlay",
  "header-shelf",
  "side-drawer",
  "quick-index",
  "query-shortcuts",
  "topic-shortcuts",
  "three-at-a-time",
]);
const TABS = new Set(["editorial-store", "two-collections", "product-essentials", "showroom"]);
function Match({ text, query }: { text: string; query: string }) {
  const words = searchWords(query);
  if (!words.length) return <>{text}</>;
  return (
    <>
      {text
        .split(new RegExp(`(${words.join("|")})`, "gi"))
        .map((part, i) =>
          words.includes(part.toLocaleLowerCase()) ? <mark key={i}>{part}</mark> : part
        )}
    </>
  );
}
export default function SearchCollection({
  settings,
  onClose,
}: {
  settings: SearchAppearance;
  onClose: () => void;
}) {
  const layout = settings.layout === "legacy" ? "refined-original" : settings.layout;
  const preset = searchLayoutById(layout)!;
  const [q, setQ] = useState(""),
    [submitted, setSubmitted] = useState("");
  const [collection, setCollection] = useState(
      ["showroom", "product-essentials"].includes(layout) ? "Store" : "All"
    ),
    [topic, setTopic] = useState("All");
  const [selected, setSelected] = useState<SearchResult | null>(null),
    [pinned, setPinned] = useState<SearchResult | null>(null);
  const [remembered, setRemembered] = useState<Record<string, SearchResult>>({});
  const [trail, setTrail] = useState<SearchResult[]>([]),
    [revealed, setRevealed] = useState(false);
  const [count, setCount] = useState(
    layout === "three-at-a-time" ? 3 : layout === "compact-overlay" ? 4 : settings.initialResults
  );
  const [appearance, setAppearance] = useState<"light" | "dark">(() =>
    settings.appearance === "site"
      ? document.documentElement.dataset.mgtheme === "dark"
        ? "dark"
        : "light"
      : settings.appearance
  );
  const root = useRef<HTMLDivElement>(null),
    panel = useRef<HTMLElement>(null),
    input = useRef<HTMLInputElement>(null);
  const run = useRef<ReturnType<typeof animateSearch> | null>(null),
    closing = useRef(false),
    alive = useRef(true),
    peek = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useScrollLock(true);
  useFocusTrap(true, panel, { skipInitialFocus: true });
  const close = useCallback(() => {
    if (closing.current || !root.current) return;
    closing.current = true;
    const previous = run.current;
    const animation = animateSearch(root.current, settings.motion, false);
    previous?.cancel();
    run.current = animation;
    void animation.finished.then(() => {
      if (alive.current && run.current === animation) closeRef.current();
    });
  }, [settings.motion]);
  useEffect(() => {
    alive.current = true;
    input.current?.focus({ preventScroll: true });
    if (root.current) run.current = animateSearch(root.current, settings.motion, true);
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", escape);
    return () => {
      alive.current = false;
      run.current?.cancel();
      if (peek.current) clearTimeout(peek.current);
      document.removeEventListener("keydown", escape);
    };
  }, [settings.motion, close]);
  const query = (layout === "query-shortcuts" ? submitted : q).trim().toLocaleLowerCase();
  const { results, status, retry } = useSearchCollection(query, settings.debounceMs);
  const filtered = useMemo(
    () =>
      results.filter(
        (r) =>
          (collection === "All" || r.collection === collection) &&
          (topic === "All" || r.tag === topic)
      ),
    [results, collection, topic]
  );
  const visible = filtered.slice(0, count);
  const active =
    selected && filtered.some((r) => r.href === selected.href)
      ? selected
      : layout === "two-collections" &&
          remembered[collection] &&
          filtered.some((r) => r.href === remembered[collection].href)
        ? remembered[collection]
        : layout === "best-match"
          ? filtered[0] || null
          : null;
  const direct = DIRECT.has(layout),
    inline = layout === "inline-reveal",
    focus = layout === "focus" && !!active;
  const choose = (r: SearchResult, bringIntoView = false) => {
    setSelected(r);
    setRemembered((prev) => ({ ...prev, [collection]: r, [r.collection]: r }));
    setRevealed(false);
    setTrail((prev) => [r, ...prev.filter((v) => v.href !== r.href)].slice(0, 5));
    if (layout === "focus" || (bringIntoView && window.matchMedia("(max-width: 680px)").matches))
      requestAnimationFrame(() => {
        const target = root.current?.querySelector<HTMLElement>("[data-search-preview]");
        target?.focus({ preventScroll: true });
        target?.scrollIntoView?.({ block: "nearest", behavior: "instant" });
      });
  };
  const returnToResults = () => {
    const href = active?.href;
    setSelected(null);
    requestAnimationFrame(() => {
      const rows = Array.from(
        root.current?.querySelectorAll<HTMLButtonElement>("button[data-search-row]") || []
      );
      (rows.find((row) => row.dataset.resultHref === href) || input.current)?.focus();
    });
  };
  const changeQuery = (value: string) => {
    setQ(value);
    setRemembered({});
    setSelected(null);
    setPinned(null);
    setTopic("All");
    setCount(
      layout === "three-at-a-time" ? 3 : layout === "compact-overlay" ? 4 : settings.initialResults
    );
  };
  const thumbnail = (r: SearchResult) =>
    r.img ? (
      <div className={styles.media} data-search-media>
        <MediaImage src={r.img} alt="" slot="half" />
      </div>
    ) : null;
  const preview = (r: SearchResult, secondary = false) => (
    <section
      className={styles.preview}
      data-search-preview
      tabIndex={-1}
      aria-label={`${secondary ? "Pinned" : "Preview"}: ${r.title}`}
    >
      {(layout !== "words-first" || revealed) && thumbnail(r)}
      <div className={styles.previewText} data-search-text>
        <p className={styles.eyebrow}>
          {r.collection} · {r.tag}
        </p>
        <h3>{layout === "context-preview" ? <Match text={r.title} query={query} /> : r.title}</h3>
        <p className={styles.meta}>{r.meta}</p>
        {r.excerpt && (
          <p className={styles.excerpt}>
            {layout === "context-preview" ? <Match text={r.excerpt} query={query} /> : r.excerpt}
          </p>
        )}
        {(layout === "product-essentials" ||
          layout === "showroom" ||
          layout === "compare-alongside") &&
          r.specs && (
            <dl>
              {r.specs.slice(0, 4).map((s) => (
                <div key={s.label}>
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
        <div className={styles.actions}>
          <Link href={r.href} onClick={close} prefetch={false}>
            {r.collection === "Store" ? "View product" : "Read article"} <span aria-hidden>↗</span>
          </Link>
          {layout === "words-first" && r.img && !revealed && (
            <button onClick={() => setRevealed(true)}>Reveal image</button>
          )}
          {layout === "compare-alongside" && (
            <button onClick={() => setPinned(secondary ? null : r)}>
              {secondary ? "Unpin" : "Pin alongside"}
            </button>
          )}
          {!secondary && (
            <button className={focus ? undefined : styles.mobileBack} onClick={returnToResults}>
              Back to results
            </button>
          )}
        </div>
      </div>
    </section>
  );
  const row = (r: SearchResult, i: number) => (
    <div className={styles.rowWrap} key={r.href}>
      {direct ? (
        <Link className={styles.row} data-search-row href={r.href} onClick={close} prefetch={false}>
          {["refined-original", "compact-overlay", "header-shelf"].includes(layout) && thumbnail(r)}
          <span>
            <small>
              {r.collection} · {r.tag}
            </small>
            <strong>{r.title}</strong>
            <small>{r.meta}</small>
          </span>
          <span aria-hidden>↗</span>
        </Link>
      ) : (
        <button
          className={styles.row}
          data-search-row
          data-result-href={r.href}
          aria-expanded={active?.href === r.href}
          onClick={() => (inline && active?.href === r.href ? setSelected(null) : choose(r, true))}
          onMouseEnter={() => {
            if (layout === "instant-peek") {
              if (peek.current) clearTimeout(peek.current);
              peek.current = setTimeout(() => choose(r), 160);
            }
          }}
          onMouseLeave={() => {
            if (peek.current) clearTimeout(peek.current);
          }}
          onFocus={() => {
            if (layout === "instant-peek") choose(r);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const rows =
                panel.current?.querySelectorAll<HTMLButtonElement>("button[data-search-row]");
              rows?.[
                Math.max(0, Math.min(visible.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))
              ]?.focus();
            }
          }}
        >
          {layout === "showroom" && thumbnail(r)}
          <span>
            <small>
              {r.collection} · {r.tag}
            </small>
            <strong>
              {layout === "context-preview" ? <Match text={r.title} query={query} /> : r.title}
            </strong>
            <small>{r.meta}</small>
          </span>
          <span aria-hidden>{active?.href === r.href ? "−" : "+"}</span>
        </button>
      )}
      {inline && active?.href === r.href && preview(r)}
    </div>
  );
  return createPortal(
    <div
      ref={root}
      className={styles.root}
      data-search-layout={layout}
      data-search-motion={settings.motion}
      data-appearance={appearance}
      data-fullscreen={preset.fullscreen}
    >
      <div className={styles.scrim} data-search-scrim onClick={close} />
      <section
        ref={panel}
        className={styles.sheet}
        data-search-sheet
        id="mg-search-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mg-collection-search-label"
        tabIndex={-1}
      >
        <div className={styles.rule} data-search-rule />
        <div className={styles.rail}>
          <h2 id="mg-collection-search-label">Search Modern Gentlemen</h2>
          <div>
            <button
              onClick={() => setAppearance(appearance === "light" ? "dark" : "light")}
              aria-label={`Switch search to ${appearance === "light" ? "dark" : "light"} mode`}
            >
              {appearance === "light" ? "Dark" : "Light"}
            </button>
            <button onClick={close} aria-label="Close search">
              Close <span aria-hidden>×</span>
            </button>
          </div>
        </div>
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(q);
          }}
        >
          <span aria-hidden className={styles.magnifier}>
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <circle cx="10.5" cy="10.5" r="7.5" />
              <path d="m16 16 5 5" />
            </svg>
          </span>
          <input
            ref={input}
            aria-label="Search articles and store"
            value={q}
            onChange={(e) => changeQuery(e.target.value)}
            placeholder="What are you looking for?"
            maxLength={120}
            autoComplete="off"
            type="search"
          />
          {q && (
            <button
              type="button"
              onClick={() => {
                changeQuery("");
                setSubmitted("");
                input.current?.focus();
              }}
            >
              Clear
            </button>
          )}
          {layout === "query-shortcuts" && <button type="submit">Search</button>}
        </form>
        {!query ? (
          <div className={styles.empty}>
            <p className={styles.eyebrow}>
              {layout === "query-shortcuts" ? "Try a focused query" : "Explore editorial & store"}
            </p>
            <div className={styles.chips}>
              {POPULAR.map((term) => (
                <button
                  data-search-row
                  key={term}
                  onClick={() => {
                    changeQuery(term);
                    setSubmitted(term);
                  }}
                >
                  {term} <span aria-hidden>↗</span>
                </button>
              ))}
            </div>
            <p>Stories, considered objects, and everything in between.</p>
          </div>
        ) : (
          <>
            <div className={styles.bar} data-search-bar>
              <p role="status" aria-live="polite">
                {status === "loading"
                  ? "Searching editorial…"
                  : `${filtered.length} ${filtered.length === 1 ? "result" : "results"}`}
                {status === "loading" && results.length > 0 ? " · Store results ready" : ""}
              </p>
              <span>Editorial & store</span>
            </div>
            {status === "error" && (
              <p className={styles.error} role="status">
                Editorial search is temporarily unavailable.{" "}
                <button onClick={retry}>Try again</button> Store results remain available.
              </p>
            )}
            {TABS.has(layout) && (
              <div className={styles.chips} aria-label="Result collection">
                {["All", "Editorial", "Store"].map((name) => (
                  <button
                    key={name}
                    aria-pressed={collection === name}
                    onClick={() => {
                      setCollection(name);
                      setCount(settings.initialResults);
                    }}
                  >
                    {name} ·{" "}
                    {name === "All"
                      ? results.length
                      : results.filter((r) => r.collection === name).length}
                  </button>
                ))}
              </div>
            )}
            {layout === "topic-shortcuts" && (
              <div className={styles.chips} aria-label="Result categories">
                {["All", ...new Set(results.map((r) => r.tag))].map((name) => (
                  <button key={name} aria-pressed={topic === name} onClick={() => setTopic(name)}>
                    {name}
                  </button>
                ))}
              </div>
            )}
            {layout === "preview-trail" && trail.length > 0 && (
              <div className={styles.trail}>
                <span>Recently previewed</span>
                {trail.map((r) => (
                  <button
                    key={r.href}
                    onClick={() => {
                      if (!filtered.some((v) => v.href === r.href)) {
                        changeQuery(r.title);
                        setSubmitted(r.title);
                      }
                      choose(r);
                    }}
                  >
                    {r.title}
                  </button>
                ))}
              </div>
            )}
            <div className={styles.body} data-search-body data-focused={focus} data-direct={direct}>
              <div className={styles.results}>
                {["refined-original", "header-shelf"].includes(layout)
                  ? ["Editorial", "Store"].map((name) => (
                      <section key={name}>
                        <h3 className={styles.eyebrow}>{name}</h3>
                        {visible.filter((r) => r.collection === name).map(row)}
                      </section>
                    ))
                  : visible.map(row)}
                {filtered.length > visible.length && layout !== "compact-overlay" && (
                  <button className={styles.more} onClick={() => setCount((n) => n + 3)}>
                    Show {Math.min(3, filtered.length - visible.length)} more ·{" "}
                    {filtered.length - visible.length} remaining
                  </button>
                )}
                {layout === "compact-overlay" && filtered.length > visible.length && (
                  <button className={styles.more} onClick={() => setCount((n) => n + 3)}>
                    Show more results
                  </button>
                )}
                {!filtered.length && status !== "loading" && status !== "error" && (
                  <div className={styles.empty}>
                    <h3>No matches yet</h3>
                    <p>Try a shorter phrase or a different category.</p>
                  </div>
                )}
              </div>
              {!direct && !inline && (
                <div className={styles.previewColumn}>
                  {active ? (
                    preview(active)
                  ) : (
                    <div className={styles.previewPlaceholder} data-search-preview>
                      <span className={styles.eyebrow}>Preview on demand</span>
                      <p>Select a result to take a closer look.</p>
                      <span>Your search stays right here.</span>
                    </div>
                  )}
                  {layout === "compare-alongside" &&
                    pinned &&
                    pinned.href !== active?.href &&
                    preview(pinned, true)}
                  {focus && (
                    <div className={styles.actions}>
                      {[-1, 1].map((direction) => (
                        <button
                          key={direction}
                          disabled={
                            !filtered[
                              filtered.findIndex((r) => r.href === active?.href) + direction
                            ]
                          }
                          onClick={() =>
                            choose(
                              filtered[
                                filtered.findIndex((r) => r.href === active?.href) + direction
                              ]
                            )
                          }
                        >
                          {direction < 0 ? "Previous" : "Next"} result
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
        <footer className={styles.footer}>
          Considered search. <span>Esc to close</span>
        </footer>
      </section>
    </div>,
    document.body
  );
}
