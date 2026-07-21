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
  { title: "Inside a Coachbuilder's Workshop", cat: "FILM", href: "/film" },
];

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
    <OverlayScrim open={open} onClose={onClose} align="center">
      <div className="h-full w-full bg-mg-bg/95 backdrop-blur-lg text-mg-fg overflow-auto animate-[fadeUp_.26s_ease]">
        <div className="container-mg pt-24 pb-16 max-w-3xl mx-auto">
          <div className="flex items-center gap-4 border-b-2 border-mg-accent pb-4">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search editorial and store…"
              className="flex-1 bg-transparent text-3xl md:text-4xl font-grotesk outline-none placeholder:text-mg-fg/30"
            />
            {q && <button onClick={() => setQ("")} aria-label="Clear" className="text-mg-fg/50 text-2xl">×</button>}
            <button onClick={onClose} aria-label="Close" className="font-mono text-xs uppercase tracking-[0.2em] text-mg-accent">Esc</button>
          </div>

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
            <p className="mt-10 font-mono text-sm text-mg-fg/50">No results for &ldquo;{q}&rdquo;.</p>
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
