"use client";

import { useState } from "react";
import Link from "next/link";
import { OverlayScrim } from "./OverlayScrim";
import { useScrollLock } from "@/lib/useScrollLock";

const GROUPS = [
  { num: "01", label: "Style", href: "/style", links: [["The Wardrobe", "/style"], ["Tailoring", "/style"], ["Footwear", "/style"]] },
  { num: "02", label: "Grooming", href: "/grooming", links: [["Skin", "/grooming"], ["Hair", "/grooming"], ["Fragrance", "/grooming"]] },
  { num: "03", label: "Watches", href: "/watches", links: [["Dive", "/watches"], ["Field", "/watches"], ["Dress", "/watches"]] },
  { num: "04", label: "Culture", href: "/culture", links: [["Essays", "/culture"], ["Interviews", "/culture"]] },
  { num: "05", label: "Film", href: "/film", links: [] },
  { num: "06", label: "Store", href: "/shop", links: [] },
];
const SOCIAL = ["Instagram", "YouTube", "Newsletter"];

/** Slide-over drawer (left). Accordion categories + member CTA + socials.
 *  Menu links use the red animated underline 6px below text (04_CHROME.md). */
export function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  useScrollLock(open);

  return (
    <OverlayScrim open={open} onClose={onClose} align="left">
      <aside className="h-full w-full max-w-[420px] bg-[#0d0d0d] text-[#f4f4f4] flex flex-col p-8 overflow-auto animate-[slideIn_.26s_ease]">
        <div className="flex items-center justify-between mb-10">
          <span className="font-grotesk font-bold text-2xl">Modern Gentlemen</span>
          <button onClick={onClose} aria-label="Close menu" className="text-2xl leading-none">×</button>
        </div>

        <nav className="flex-1">
          {GROUPS.map((g) => (
            <div key={g.num} className="border-b border-white/10">
              <div className="flex items-center justify-between py-4">
                <Link href={g.href} onClick={onClose} className="font-grotesk text-2xl inline-block pb-1.5 border-b-2 border-transparent hover:border-mg-accent">
                  <span className="font-mono text-xs text-white/40 mr-3">{g.num}</span>{g.label}
                </Link>
                {g.links.length > 0 && (
                  <button aria-label="Expand" onClick={() => setExpanded(expanded === g.num ? null : g.num)} className={`text-mg-accent transition-transform ${expanded === g.num ? "rotate-45" : ""}`}>+</button>
                )}
              </div>
              {expanded === g.num && g.links.length > 0 && (
                <ul className="pb-4 pl-8 space-y-2">
                  {g.links.map(([label, href]) => (
                    <li key={label}><Link href={href} onClick={onClose} className="text-white/70 hover:text-white text-sm">{label}</Link></li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </nav>

        <Link href="/membership" onClick={onClose} className="mt-8 block text-center bg-mg-accent text-white py-3 font-mono text-xs uppercase tracking-[0.2em]">Become a member</Link>
        <div className="mt-6 flex gap-5 font-mono text-xs text-white/50">
          {SOCIAL.map((s) => <a key={s} href="#" className="hover:text-white">{s}</a>)}
        </div>
      </aside>
    </OverlayScrim>
  );
}
