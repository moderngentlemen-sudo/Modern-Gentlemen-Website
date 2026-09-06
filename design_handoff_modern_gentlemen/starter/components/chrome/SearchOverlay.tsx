"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useScrollLock } from "@/lib/useScrollLock";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { useCatalog } from "@/lib/catalog/CatalogProvider";
import { formatGBP } from "@/lib/domain/money";
import { matchesSearchQuery, type EditorialSearchEntry } from "@/lib/domain/search";

type Row = {
  tag: string;
  title: string;
  meta: string;
  href: string;
  img: string;
  section: "Editorial" | "Shop";
};

/**
 * Four prototype-only destinations cannot come from the articles table. Keep
 * them as compatibility shortcuts while published article results come from
 * Supabase. The three film titles intentionally open the film landing, and the
 * newsletter opens membership, exactly as the original overlay did.
 */
const EDITORIAL_SHORTCUTS: EditorialSearchEntry[] = [
  {
    tag: "FILM",
    title: "Inside a Coachbuilder’s Workshop",
    meta: "14:20",
    href: "/film",
    img: "/images/film-workshop.jpg",
  },
  {
    tag: "FILM",
    title: "A Tailor’s Archive",
    meta: "09:52",
    href: "/film",
    img: "/images/film-tailor.jpg",
  },
  {
    tag: "FILM",
    title: "The Watchmaker of the Grid",
    meta: "11:38",
    href: "/film",
    img: "/images/film-watchmaker.jpg",
  },
  {
    tag: "MEMBERSHIP",
    title: "The Debrief — Weekly Newsletter",
    meta: "JOIN",
    href: "/membership",
    img: "/images/film-tailor.jpg",
  },
];

const POPULAR = ["Watches", "Grooming", "Film", "Racing Green", "The Debrief"];

/**
 * Full-screen search overlay, matching the prototype: mono SEARCH / ESC rail, a
 * red 26px magnifier beside a fluid-size field with a round clear button, then
 * either POPULAR SEARCHES chips (empty query) or EDITORIAL / STORE result groups
 * with thumbnails, per-group counts and hairline row rules.
 */
export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [closing, setClosing] = useState(false);
  const [editorialResults, setEditorialResults] = useState<EditorialSearchEntry[]>([]);
  const [editorialState, setEditorialState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openedAt = useRef(0);
  const router = useRouter();
  useScrollLock(open);
  useFocusTrap(open, panelRef, { skipInitialFocus: true });

  useEffect(() => {
    if (!open) return;
    setClosing(false);
    openedAt.current = Date.now();
    inputRef.current?.focus({ preventScroll: true });
  }, [open]);

  /** Run the exit animation, then unmount and clear the query (as the prototype
   *  does — reopening always starts from POPULAR SEARCHES). */
  const close = () => {
    setClosing((already) => {
      if (already) return already;
      window.setTimeout(() => {
        setClosing(false);
        setQ("");
        onClose();
      }, 200);
      return true;
    });
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const query = q.trim().toLowerCase();
  const { allProducts } = useCatalog();

  useEffect(() => {
    if (!open || !query) {
      setEditorialResults([]);
      setEditorialState("idle");
      return;
    }

    const controller = new AbortController();
    setEditorialResults([]);
    setEditorialState("loading");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/articles?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error("Search unavailable");
        const payload = (await response.json()) as { results?: unknown };
        const results = Array.isArray(payload.results)
          ? payload.results.filter(isEditorialSearchEntry)
          : [];
        setEditorialResults(results);
        setEditorialState("ready");
      } catch {
        if (controller.signal.aborted) return;
        setEditorialResults([]);
        setEditorialState("error");
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  const results = useMemo<Row[]>(() => {
    if (!query) return [];
    const shortcuts = EDITORIAL_SHORTCUTS.filter((row) =>
      matchesSearchQuery([row.title, row.tag, row.meta], query)
    );
    const shortcutTitles = new Set(shortcuts.map((row) => row.title.toLocaleLowerCase()));
    const ed: Row[] = shortcuts
      .concat(editorialResults.filter((row) => !shortcutTitles.has(row.title.toLocaleLowerCase())))
      .map((row) => ({ ...row, section: "Editorial" }));
    const shop: Row[] = allProducts()
      .filter((p) => matchesSearchQuery([p.name, p.catLabel, p.material, p.tag], query))
      .map((p) => ({
        tag: p.catLabel,
        title: p.name,
        meta: formatGBP(p.price),
        href: `/product/${p.slug}`,
        img: p.images?.[0] ?? "",
        section: "Shop" as const,
      }));
    return ed.concat(shop);
  }, [query, editorialResults, allProducts]);

  const editorial = results.filter((r) => r.section !== "Shop");
  const shop = results.filter((r) => r.section === "Shop");

  const go = (href: string) => {
    router.push(href);
    close();
  };

  return (
    <div
      // Prepare the static shell before the first interaction. display:none
      // keeps it out of layout, painting, tab order and the accessibility tree;
      // opening does not need to create the field and all of its controls.
      hidden={!open}
      id="mg-search-overlay"
      data-screen-label="Search"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      // Scrim click closes — but not within 450ms of opening, so the tap that
      // opened it can't immediately dismiss it (the prototype's guard).
      onClick={(e) => {
        if (e.target === e.currentTarget && Date.now() - openedAt.current > 450) close();
      }}
      className="fixed inset-0 z-[200] flex flex-col items-center px-6 text-[#f4f4f4]"
      style={{
        display: open ? undefined : "none",
        paddingTop: "var(--mg-safe-top)",
        paddingBottom: "var(--mg-safe-bottom)",
        paddingLeft: "max(24px, var(--mg-safe-left))",
        paddingRight: "max(24px, var(--mg-safe-right))",
        overflowY: "auto",
        background: "rgba(8,8,9,0.82)",
        backdropFilter: "blur(22px)",
        WebkitBackdropFilter: "blur(22px)",
        animation: closing ? "mgFadeOut .2s ease forwards" : "mgFade .24s ease both",
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        data-searchpanel
        className="w-full max-w-[760px] mt-[8vh] min-[681px]:mt-[14vh] outline-none will-change-[opacity,transform]"
        style={{
          animation: closing
            ? "mgFadeOut .16s ease forwards"
            : "mgRise .2s cubic-bezier(.22,1,.36,1) both",
        }}
      >
        {/* SEARCH · ESC rail — centred on phones, split on desktop. */}
        <div className="relative flex items-center justify-center min-[681px]:justify-between mb-[22px]">
          <span className="font-mono text-[11px] leading-[normal] tracking-[0.24em] text-[rgba(244,244,244,0.5)]">
            SEARCH
          </span>
          <button
            type="button"
            onClick={close}
            aria-label="Close search"
            className="absolute right-0 flex items-center gap-2 font-mono text-[10px] leading-[normal] tracking-[0.2em] text-[rgba(244,244,244,0.5)] min-[681px]:static"
          >
            ESC
            <span className="flex items-center justify-center h-7 w-7 rounded-full border border-[rgba(244,244,244,0.25)]">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </span>
          </button>
        </div>

        {/* Query bar */}
        <div className="flex items-center gap-4 pb-5 border-b-[1.5px] border-[rgba(244,244,244,0.22)]">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#C8102E"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
            className="shrink-0"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
          <div className="relative flex flex-1 min-w-0 items-center">
            <input
              ref={inputRef}
              type="text"
              value={q}
              maxLength={100}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search editorial and store"
              placeholder="Search style, watches, film…"
              className="w-full box-border bg-transparent border-none outline-none text-[#f4f4f4] font-grotesk text-[clamp(22px,6.5vw,34px)] leading-[1.1] tracking-[-0.02em] py-px pl-0.5 pr-10 placeholder:text-[rgba(244,244,244,0.4)]"
            />
            {q.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center h-[34px] w-[34px] rounded-full bg-[rgba(120,120,120,0.14)] border border-[rgba(120,120,120,0.28)] touch-manipulation transition-[color,background] duration-200 hover:bg-[rgba(200,16,46,0.16)] hover:text-mg-accentInk"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Chips or results. Scrolling/touching the list blurs the field so the
            phone keyboard gets out of the way. */}
        <div
          data-searchscroll
          onTouchStart={() => inputRef.current?.blur()}
          onWheel={() => inputRef.current?.blur()}
          className="mt-[26px] max-h-[60vh] min-[681px]:max-h-[52vh] overflow-y-auto pr-2.5"
        >
          {!query ? (
            <div>
              <div className="font-mono text-[10px] leading-[normal] tracking-[0.24em] text-[rgba(244,244,244,0.4)] mb-4 max-[680px]:text-center">
                POPULAR SEARCHES
              </div>
              <div className="flex flex-wrap gap-2.5 max-[680px]:justify-center">
                {POPULAR.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setQ(label);
                      inputRef.current?.focus();
                    }}
                    className="px-[18px] py-[9px] bg-[rgba(244,244,244,0.06)] border border-[rgba(244,244,244,0.16)] text-[rgba(244,244,244,0.8)] font-mono text-[11px] leading-[normal] tracking-[0.14em] transition-[background,color] duration-200 hover:bg-[rgba(244,244,244,0.12)] hover:text-[#f4f4f4]"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : editorialState === "loading" && results.length === 0 ? (
            <div
              className="py-7 px-1 font-grotesk font-light text-base leading-[1.6] text-[rgba(244,244,244,0.55)]"
              role="status"
            >
              Searching editorial and store…
            </div>
          ) : results.length === 0 ? (
            <div className="py-7 px-1 font-grotesk font-light text-base leading-[1.6] text-[rgba(244,244,244,0.55)]">
              {editorialState === "error" ? (
                <>Editorial search is temporarily unavailable. Please try again.</>
              ) : (
                <>
                  No results for <span className="text-[#f4f4f4]">&ldquo;{q}&rdquo;</span>. Try
                  &ldquo;watches&rdquo;, &ldquo;grooming&rdquo;, or &ldquo;film&rdquo;.
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {editorialState === "loading" && (
                <p
                  className="px-1.5 pt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-[rgba(244,244,244,0.4)]"
                  role="status"
                >
                  Searching editorial…
                </p>
              )}
              {editorialState === "error" && (
                <p
                  className="px-1.5 pt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-[rgba(244,244,244,0.5)]"
                  role="status"
                >
                  Editorial results unavailable
                </p>
              )}
              {editorial.length > 0 && <GroupHead label="EDITORIAL" n={editorial.length} />}
              {editorial.map((r, i) => (
                <ResultRow key={`e${i}`} row={r} onGo={go} />
              ))}
              {shop.length > 0 && <GroupHead label="STORE" n={shop.length} />}
              {shop.map((r, i) => (
                <ResultRow key={`s${i}`} row={r} onGo={go} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function isEditorialSearchEntry(value: unknown): value is EditorialSearchEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return ["tag", "title", "meta", "href", "img"].every((key) => typeof row[key] === "string");
}

function GroupHead({ label, n }: { label: string; n: number }) {
  return (
    <div
      data-searchgroup
      className="flex items-baseline justify-between gap-3 pt-5 px-1.5 pb-[9px]"
    >
      <span className="font-mono text-[10px] leading-[normal] tracking-[0.26em] text-mg-accentInk">
        {label}
      </span>
      <span className="font-mono text-[9px] leading-[normal] tracking-[0.14em] text-[rgba(244,244,244,0.4)]">
        {`${n} ${n === 1 ? "RESULT" : "RESULTS"}`}
      </span>
    </div>
  );
}

/** Result row: thumb · tag + title · meta. The meta column is dropped ≤680px,
 *  where the thumb also narrows to 52px. */
function ResultRow({ row, onGo }: { row: Row; onGo: (href: string) => void }) {
  const isShop = row.section === "Shop";
  return (
    <a
      data-searchrow
      href={row.href}
      onClick={(e) => {
        e.preventDefault();
        onGo(row.href);
      }}
      className="grid grid-cols-[52px_1fr] min-[681px]:grid-cols-[64px_1fr_auto] gap-3.5 items-center py-3 px-1.5 border-b border-[rgba(244,244,244,0.08)] text-[#f4f4f4] no-underline bg-transparent transition-[background] duration-[180ms] hover:bg-[rgba(244,244,244,0.04)]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={row.img}
        alt=""
        className="block h-[46px] w-[52px] min-[681px]:w-16 object-cover bg-[#1a1a1c]"
      />
      <div className="min-w-0 flex flex-col gap-[3px]">
        <span className="font-mono text-[9px] leading-[normal] tracking-[0.18em] text-mg-accentInk">
          {row.tag}
        </span>
        <span className="font-grotesk font-medium text-base leading-[1.2] tracking-[-0.015em] truncate">
          {row.title}
        </span>
      </div>
      <span
        data-searchmeta
        className={`hidden min-[681px]:block whitespace-nowrap ${
          isShop
            ? "font-grotesk font-medium text-[13px] tracking-[-0.01em] text-[#f4f4f4]"
            : "font-mono text-[9px] text-[rgba(244,244,244,0.4)]"
        }`}
      >
        {row.meta}
      </span>
    </a>
  );
}
