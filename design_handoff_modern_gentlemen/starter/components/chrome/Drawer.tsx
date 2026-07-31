"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useScrollLock } from "@/lib/useScrollLock";
import { useFocusTrap } from "@/lib/useFocusTrap";

/** Drawer groups. The sub-lists are the mega-menu's columns flattened in order
 *  (the prototype derives them from the same `megaData`), so the drawer and the
 *  desktop mega-menu can never drift apart. */
const GROUPS: { num: string; label: string; href: string; subs: [string, string][] }[] = [
  {
    num: "01",
    label: "Style",
    href: "/style",
    subs: [
      ["Tailoring", "/style"],
      ["Casualwear", "/style"],
      ["Footwear", "/style"],
      ["Accessories", "/style"],
      ["The Capsule Wardrobe", "/style"],
      ["Fabric & Cloth", "/style"],
      ["Seasonal Edits", "/style"],
    ],
  },
  {
    num: "02",
    label: "Grooming",
    href: "/grooming",
    subs: [
      ["Skincare", "/grooming"],
      ["Fragrance", "/grooming"],
      ["Hair", "/grooming"],
      ["Shaving", "/grooming"],
      ["The Seven-Minute Standard", "/grooming"],
      ["The Travel Kit", "/grooming"],
      ["Evening Reset", "/grooming"],
    ],
  },
  {
    num: "03",
    label: "Watches",
    href: "/watches",
    subs: [
      ["Chronographs", "/watches"],
      ["Dress Watches", "/watches"],
      ["Dive Watches", "/watches"],
      ["Vintage", "/watches"],
      ["Dial Symmetry", "/watches"],
      ["Movements 101", "/watches"],
      ["The Buying Guide", "/watches"],
    ],
  },
  {
    num: "04",
    label: "Culture",
    href: "/culture",
    subs: [
      ["Essays", "/culture"],
      ["Interviews", "/culture"],
      ["Travel", "/culture"],
      ["Machines", "/culture"],
      ["The Analog Weekend", "/culture"],
      ["The Art of Arriving Early", "/culture"],
      ["MG Film", "/film"],
    ],
  },
  { num: "05", label: "Film", href: "/film", subs: [] },
  { num: "06", label: "Store", href: "/shop", subs: [] },
];

const SECONDARY: [string, string][] = [
  ["ABOUT", "/about"],
  ["CONTACT", "/contact"],
  ["ARCHIVE", "/culture"],
];

const SOCIAL: { label: string; href: string; icon: React.ReactNode }[] = [
  {
    label: "Instagram",
    href: "https://instagram.com",
    icon: (
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden
      >
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "X",
    href: "https://x.com",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.21-6.82-5.96 6.82H1.68l7.73-8.84L1.25 2.25h6.82l4.71 6.23 5.46-6.23Zm-1.16 17.52h1.83L7.02 4.13H5.05l12.03 15.64Z" />
      </svg>
    ),
  },
  {
    label: "YouTube",
    href: "https://youtube.com",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden
      >
        <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
        <path d="M10.2 9.3l5 2.7-5 2.7V9.3Z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://linkedin.com",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0 0-5ZM3 9.5h4v11H3v-11Zm6.5 0h3.83v1.5h.05c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.78 2.5 4.78 5.75v5.7h-4v-5.05c0-1.2-.02-2.75-1.7-2.75-1.7 0-1.96 1.31-1.96 2.66v5.14h-4v-11Z" />
      </svg>
    ),
  },
];

/**
 * Slide-over menu drawer. Matches the prototype: 380px frosted panel entering
 * with `sidebarEntry: 'Fade'`, wordmark + round close, EST. 2026 / serif tagline
 * block, numbered accordion nav (Curtain in, Collapse out), secondary mono
 * links, a pinned BECOME A MEMBER pill and the FOLLOW social ring row.
 */
export function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  // `expanded` is the open group; `collapsing` holds it for the 300ms exit.
  const [expanded, setExpanded] = useState<string | null>(null);
  const [collapsing, setCollapsing] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const openedAt = useRef(0);
  const subTimer = useRef<number | undefined>(undefined);
  useScrollLock(open);
  useFocusTrap(open, panelRef);

  useEffect(() => {
    if (!open) return;
    setClosing(false);
    openedAt.current = Date.now();
  }, [open]);

  useEffect(() => () => window.clearTimeout(subTimer.current), []);

  /** Run the panel's exit animation, then unmount and reset the accordion. */
  const close = () => {
    setClosing((already) => {
      if (already) return already;
      window.setTimeout(() => {
        setClosing(false);
        setExpanded(null);
        setCollapsing(null);
        onClose();
      }, 280);
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

  /** Accordion toggle: opening is immediate, closing plays Collapse for 300ms
   *  before the sub-list unmounts. */
  const toggle = (key: string) => {
    window.clearTimeout(subTimer.current);
    if (expanded === key) {
      setCollapsing(key);
      subTimer.current = window.setTimeout(() => {
        setExpanded(null);
        setCollapsing(null);
      }, 300);
    } else {
      setCollapsing(null);
      setExpanded(key);
    }
  };

  if (!open) return null;

  return (
    <div
      data-screen-label="Menu"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      onClick={(e) => {
        if (e.target === e.currentTarget && Date.now() - openedAt.current > 450) close();
      }}
      className="fixed inset-0 z-[190]"
      style={{
        background: "rgba(8,8,9,0.6)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        animation: closing ? "mgFadeOut .28s ease forwards" : "mgFade .28s ease",
      }}
    >
      <aside
        ref={panelRef}
        tabIndex={-1}
        data-mhover="Underline"
        className="absolute inset-y-0 left-0 flex flex-col w-[471px] max-w-[86vw] max-[820px]:w-screen max-[820px]:max-w-[100vw] overflow-y-auto overflow-x-hidden box-border pt-8 pr-11 pb-10 pl-[46px] border-r border-white/[0.12] max-[820px]:border-r-0 text-[#f4f4f4] outline-none"
        style={{
          background: "rgba(14,14,16,0.75)",
          backdropFilter: "blur(30px)",
          WebkitBackdropFilter: "blur(28px)",
          animation: closing
            ? "mgPanFadeOut .26s ease forwards"
            : "mgPanFadeIn .34s cubic-bezier(.22,1,.36,1)",
        }}
      >
        {/* Wordmark + close */}
        <div className="flex items-center justify-between mb-11">
          <span className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mg-logo-wide.svg" alt="Modern Gentlemen" className="block h-[15px] w-auto" />
          </span>
          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="flex items-center justify-center h-[34px] w-[34px] rounded-full bg-white/[0.08] border border-white/20 text-[#f4f4f4]"
          >
            <svg
              width="14"
              height="14"
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
          </button>
        </div>

        {/* EST. 2026 + tagline */}
        <div className="-mt-5 mb-[30px] pb-[26px] border-b border-white/10">
          <div className="font-mono text-[9px] leading-[normal] tracking-[0.26em] text-mg-accent mb-2.5">
            EST. 2026
          </div>
          <div className="font-serif italic text-[22px] leading-[1.3] text-[rgba(244,244,244,0.82)]">
            The Men’s Lifestyle Guide
          </div>
        </div>

        {/* Numbered accordion nav */}
        <div data-drawernav className="flex flex-col">
          {GROUPS.map((g) => {
            const isOpen = expanded === g.num;
            const isExiting = collapsing === g.num;
            return (
              <div key={g.num} className="border-b border-white/[0.08]">
                <div className="flex items-center gap-3 py-[9px]">
                  <span className="shrink-0 font-mono text-[10px] leading-[normal] tracking-[0.16em] text-mg-accent">
                    {g.num}
                  </span>
                  <Link
                    href={g.href}
                    onClick={close}
                    className="mg-underline text-white font-nav font-medium text-[18px] leading-none tracking-[-0.01em]"
                  >
                    {g.label}
                  </Link>
                  {g.subs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggle(g.num)}
                      aria-label="Toggle subcategories"
                      aria-expanded={isOpen && !isExiting}
                      className="flex items-center justify-center h-[26px] w-[26px] shrink-0 rounded-full bg-white/[0.06] border border-white/[0.14] text-[rgba(244,244,244,0.7)]"
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                        style={{
                          transform: isOpen && !isExiting ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform .28s cubic-bezier(.4,0,.2,1)",
                        }}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                  )}
                </div>
                {isOpen && g.subs.length > 0 && (
                  <div
                    data-drawersubs
                    data-exiting={isExiting ? "true" : "false"}
                    className="flex flex-col gap-px pt-0.5 pb-4 pl-[26px]"
                  >
                    {g.subs.map(([label, href]) => (
                      <Link
                        key={label}
                        href={href}
                        onClick={close}
                        className="w-fit py-1.5 font-grotesk text-[12.5px] leading-[1.15] tracking-[-0.01em] text-[rgba(244,244,244,0.62)] hover:text-white transition-colors"
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Secondary mono links */}
        <div
          data-drawernav
          data-dsecondary
          className="flex flex-wrap gap-x-[26px] gap-y-5 mt-[26px] font-mono text-[11px] leading-[normal] tracking-[0.16em] text-[rgba(244,244,244,0.6)]"
        >
          {SECONDARY.map(([label, href]) => (
            <Link key={label} href={href} onClick={close} className="mg-underline">
              {label}
            </Link>
          ))}
        </div>

        {/* Member CTA — pinned to the bottom of the scroll area */}
        <Link
          href="/membership"
          onClick={close}
          className="mt-auto flex items-center justify-center p-[13px] bg-mg-accent text-white font-mono text-[11px] leading-[normal] tracking-[0.2em]"
        >
          BECOME A MEMBER →
        </Link>

        {/* FOLLOW */}
        <div className="mt-[26px] pt-[22px] border-t border-white/10">
          <div className="font-mono text-[9px] leading-[normal] tracking-[0.24em] text-[rgba(244,244,244,0.4)] mb-3.5">
            FOLLOW
          </div>
          <div data-social className="flex gap-3 text-[rgba(244,244,244,0.6)]">
            {SOCIAL.map((s) => (
              <a
                key={s.label}
                href={s.href}
                title={s.label}
                aria-label={s.label}
                className="flex items-center justify-center h-[42px] w-[42px] rounded-full border border-white/20 text-inherit transition-colors hover:bg-mg-accent hover:border-mg-accent hover:text-white"
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
