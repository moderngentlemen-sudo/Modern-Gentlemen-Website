"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { OverlayScrim } from "./OverlayScrim";
import { useScrollLock } from "@/lib/useScrollLock";
import { allProducts, formatGBP } from "@/lib/catalog";

/** Editorial index — replace with a CMS-backed search index in production. */
const EDITORIAL = [
  { title: "The only five jackets a man needs", cat: "STYLE", href: "/style" },
  { title: "Why the field watch never went away", cat: "WATCHES", href: "/watches" },
  { title: "A seven-minute morning, refined", cat: "GROOMING", href: "/grooming" },
  { title: "The Analog Weekend", cat: "CULTURE", href: "/culture" },
  { title: "Inside a Coachbuilder’s Workshop", cat: "FILM", href: "/film" },
];
const POPULAR = ["Watches", "Grooming", "Film", "Racing Green", "The Debrief"];

/** Full-screen search overlay with EDITORIAL + STORE grouped results. */
export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  useScrollLock(open);

  const query = q.trim().toLowerCase();
  const editorial = useMemo(
    () => (query ? EDITORIAL.filter((e) => (e.title + " " + e.cat).toLowerCase().includes(query)) : []),
    [query]
  );
  const store = useMemo(
    () =>
      query
        ? allProducts()
            .filter((p) => (p.name + " " + p.catLabel + " " + p.material + " " + p.tag).toLowerCase().includes(query))
            .slice(0, 8)
        : [],
    [query]
  );

  return (
    // blur={false}: this panel covers the whole viewport, so the scrim behind
    // it is never seen — its blur was a second full-screen backdrop-filter
    // stacked under this one for no visible gain (/PERFORMANCE.md).
    <OverlayScrim open={open} onClose={onClose} align="center" label="Search" blur={false}>
      {/* ≤820px the panel's own blur is dropped too, matching the prototype's
          `mobileSearchBlur` opt-out ("lighter, cheaper blur so the search
          overlay opens without lag on mobile"). At 95% background opacity the
          blur contributes almost nothing, so this is near-invisible. */}
      <div className="h-full w-full bg-mg-bg/95 backdrop-blur-lg max-[820px]:backdrop-blur-none text-mg-fg overflow-auto animate-[fadeUp_.26s_ease]">
        <div className="mx-auto max-w-3xl px-6 sm:px-8 pt-[14vh] pb-16">
          <div className="flex items-center justify-between mb-6">
            <span className="font-mono text-xs uppercase tracking-[0.26em] text-mg-fg/50">Search</span>
            <button onClick={onClose} className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-mg-accent">
              Esc <span aria-hidden className="grid place-items-center h-6 w-6 rounded-full border border-mg-bd/30">×</span>
            </button>
          </div>

          <div className="flex items-center gap-3 border-b-[1.5px] border-mg-bd/25 pb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden className="text-mg-accent shrink-0">
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="21" y2="21" />
            </svg>
            <input
              autoFocus
              aria-label="Search editorial and store"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search style, watches, film…"
              className="flex-1 min-w-0 bg-transparent text-3xl md:text-4xl font-grotesk outline-none placeholder:text-mg-fg/30"
            />
            {q && <button onClick={() => setQ("")} aria-label="Clear search" className="text-mg-fg/50 text-2xl">×</button>}
          </div>

          {!query && (
            <div className="mt-10">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-mg-fg/50 mb-4">Popular searches</p>
              <div className="flex flex-wrap gap-3">
                {POPULAR.map((term) => (
                  <button
                    key={term}
                    onClick={() => setQ(term)}
                    className="px-4 py-2 border border-mg-bd/20 rounded-full font-mono text-xs uppercase tracking-[0.12em] hover:border-mg-accent hover:text-mg-accent transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {editorial.length > 0 && (
            <Group label="EDITORIAL" count={editorial.length}>
              {editorial.map((e) => (
                <Link key={e.title} href={e.href} onClick={onClose} className="flex items-center justify-between py-3 border-b border-mg-bd/10 hover:text-mg-accent">
                  <span className="font-grotesk">{e.title}</span>
                  <span className="font-mono text-[10px] tracking-[0.15em] text-mg-fg/40">{e.cat}</span>
                </Link>
              ))}
            </Group>
          )}

          {store.length > 0 && (
            <Group label="STORE" count={store.length}>
              {store.map((p) => (
                <Link key={p.slug} href={`/product/${p.slug}`} onClick={onClose} className="flex items-center justify-between py-3 border-b border-mg-bd/10 hover:text-mg-accent">
                  <span className="font-grotesk">{p.name}</span>
                  <span className="font-mono text-sm text-mg-fg/60">{formatGBP(p.price)}</span>
                </Link>
              ))}
            </Group>
          )}

          {query && editorial.length === 0 && store.length === 0 && (
            <p className="mt-10 font-mono text-sm text-mg-fg/50">No results for &ldquo;{q}&rdquo;. Try &ldquo;watches&rdquo;, &ldquo;grooming&rdquo;, or &ldquo;film&rdquo;.</p>
          )}
        </div>
      </div>
    </OverlayScrim>
  );
}

function Group({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <div className="mt-10">
      <div className="flex items-baseline gap-3 mb-2">
        <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-mg-accent">{label}</h3>
        <span className="font-mono text-[10px] tracking-[0.14em] text-mg-fg/40">{count} {count === 1 ? "RESULT" : "RESULTS"}</span>
      </div>
      {children}
    </div>
  );
}
