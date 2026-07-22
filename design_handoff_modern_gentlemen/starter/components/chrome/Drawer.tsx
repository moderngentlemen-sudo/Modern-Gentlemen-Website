"use client";

import { useState } from "react";
import Link from "next/link";
import { OverlayScrim } from "./OverlayScrim";
import { useScrollLock } from "@/lib/useScrollLock";

const GROUPS: { num: string; label: string; href: string; links: [string, string][] }[] = [
  { num: "01", label: "Style", href: "/style", links: [["The Capsule Wardrobe", "/style"], ["Tailoring", "/style"], ["Footwear", "/style"], ["Accessories", "/style"]] },
  { num: "02", label: "Grooming", href: "/grooming", links: [["Skincare", "/grooming"], ["Fragrance", "/grooming"], ["Hair", "/grooming"], ["Shaving", "/grooming"]] },
  { num: "03", label: "Watches", href: "/watches", links: [["Chronographs", "/watches"], ["Dress Watches", "/watches"], ["Dive Watches", "/watches"], ["Vintage", "/watches"]] },
  { num: "04", label: "Culture", href: "/culture", links: [["Essays", "/culture"], ["Interviews", "/culture"], ["Travel", "/culture"], ["Machines", "/culture"]] },
  { num: "05", label: "Film", href: "/film", links: [] },
  { num: "06", label: "Store", href: "/shop", links: [] },
];
const SECONDARY: [string, string][] = [["About", "/about"], ["Contact", "/contact"], ["Archive", "/archive"]];
const SOCIAL: [string, string][] = [["Instagram", "#"], ["X", "#"], ["YouTube", "#"], ["LinkedIn", "#"]];

/** Slide-over drawer (left). Accordion categories + member CTA + socials.
 *  Category links use the red animated underline 6px below text (04_CHROME.md). */
export function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  useScrollLock(open);

  return (
    <OverlayScrim open={open} onClose={onClose} align="left" label="Menu">
      <aside className="h-full w-full max-w-[380px] bg-[rgba(14,14,16,0.94)] backdrop-blur-[30px] text-[#f4f4f4] border-r border-white/10 flex flex-col px-11 pt-8 pb-10 overflow-auto animate-[slideIn_.26s_ease]">
        {/* Header: wordmark + close */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" onClick={onClose} aria-label="Modern Gentlemen — home" className="inline-flex">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mg-logo-wide.svg" alt="Modern Gentlemen" className="h-[15px] w-auto" />
          </Link>
          <button onClick={onClose} aria-label="Close menu" className="grid place-items-center h-9 w-9 rounded-full border border-white/20 text-lg leading-none hover:bg-white/10">
            ×
          </button>
        </div>

        {/* Eyebrow */}
        <div className="mb-8">
          <p className="font-mono uppercase text-[10px] tracking-[0.24em] text-mg-accent">Est. 2026</p>
          <p className="font-serif italic text-mg-accentSerif text-xl mt-1">The Men’s Lifestyle Guide</p>
        </div>

        <nav className="flex-1" aria-label="Drawer">
          {GROUPS.map((g) => {
            const isOpen = expanded === g.num;
            return (
              <div key={g.num} className="border-b border-white/10">
                <div className="flex items-center justify-between py-4">
                  <Link href={g.href} onClick={onClose} className="mg-underline font-nav text-[18px] tracking-[0.02em] text-[rgba(244,244,244,0.85)]">
                    <span className="font-mono text-[11px] text-mg-accent mr-3 align-middle">{g.num}</span>
                    {g.label}
                  </Link>
                  {g.links.length > 0 && (
                    <button
                      aria-label={`${isOpen ? "Collapse" : "Expand"} ${g.label}`}
                      aria-expanded={isOpen}
                      onClick={() => setExpanded(isOpen ? null : g.num)}
                      className={`grid place-items-center h-7 w-7 text-mg-accent transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                  )}
                </div>
                {isOpen && g.links.length > 0 && (
                  <ul className="pb-4 pl-9 space-y-2.5">
                    {g.links.map(([label, href]) => (
                      <li key={label}>
                        <Link href={href} onClick={onClose} className="font-grotesk text-[12.5px] text-white/60 hover:text-white transition-colors">
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        {/* Secondary links */}
        <div className="mt-6 flex gap-6 font-mono uppercase text-[11px] tracking-[0.18em] text-white/50">
          {SECONDARY.map(([label, href]) => (
            <Link key={label} href={href} onClick={onClose} className="hover:text-white transition-colors">{label}</Link>
          ))}
        </div>

        <Link href="/membership" onClick={onClose} className="mt-8 inline-flex items-center justify-center bg-mg-accent text-white py-3.5 font-mono uppercase text-xs tracking-[0.2em] hover:bg-white hover:text-mg-accent transition-colors">
          Become a member →
        </Link>

        <div className="mt-7">
          <p className="font-mono uppercase text-[10px] tracking-[0.24em] text-white/40 mb-3">Follow</p>
          <div className="flex gap-5 font-mono uppercase text-[11px] tracking-[0.12em] text-white/60">
            {SOCIAL.map(([label, href]) => (
              <a key={label} href={href} className="hover:text-white transition-colors">{label}</a>
            ))}
          </div>
        </div>
      </aside>
    </OverlayScrim>
  );
}
