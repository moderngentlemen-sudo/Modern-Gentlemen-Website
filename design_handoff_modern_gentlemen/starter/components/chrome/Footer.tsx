import Link from "next/link";

const NAV: [string, string][] = [
  ["Style", "/style"], ["Grooming", "/grooming"], ["Watches", "/watches"], ["Culture", "/culture"], ["Film", "/film"], ["Store", "/shop"],
];
const SOCIAL: { label: string; href: string; icon: React.ReactNode }[] = [
  {
    label: "Instagram",
    href: "https://instagram.com",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.21-6.82-5.96 6.82H1.68l7.73-8.84L1.25 2.25h6.82l4.71 6.23 5.46-6.23Zm-1.16 17.52h1.83L7.02 4.13H5.05l12.03 15.64Z" />
      </svg>
    ),
  },
  {
    label: "YouTube",
    href: "https://youtube.com",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
        <path d="M10.2 9.3l5 2.7-5 2.7V9.3Z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://linkedin.com",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0 0-5ZM3 9.5h4v11H3v-11Zm6.5 0h3.83v1.5h.05c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.78 2.5 4.78 5.75v5.7h-4v-5.05c0-1.2-.02-2.75-1.7-2.75-1.7 0-1.96 1.31-1.96 2.66v5.14h-4v-11Z" />
      </svg>
    ),
  },
];
const LEGAL: [string, string][] = [
  ["About", "/about"], ["Contact", "/contact"], ["Store", "/shop"], ["Archive", "/archive"], ["Privacy", "/privacy"],
];

/** Footer is ALWAYS dark, regardless of theme — do not wire to data-mgtheme. */
export function Footer() {
  return (
    <footer className="bg-[#0d0d0d] text-[#f4f4f4] border-t border-mg-band">
      {/* ≤680 every footer row insets 22px, matching the sections. */}
      {/* Brand + nav */}
      <div className="container-mg max-[680px]:!px-[22px] grid grid-cols-1 min-[681px]:grid-cols-[1fr_auto] gap-6 min-[681px]:gap-10 min-[681px]:items-center py-11 border-b border-white/10">
        <div className="flex flex-col gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mg-logo-wide.svg" alt="Modern Gentlemen" className="h-[22px] w-auto self-start" />
          <span className="font-serif italic text-[19px] leading-[1.3] text-[#f4f4f4]/60">
            A field guide to the considered life — style, watches, film &amp; the art of doing things properly.
          </span>
        </div>
        {/* Same grow-underline treatment as the top nav (prototype reuses
            `[data-navmenu]` here, which also sets the 6px underline offset). */}
        <nav className="flex flex-wrap gap-x-5 gap-y-3.5 min-[681px]:gap-x-7 min-[681px]:justify-end" aria-label="Footer">
          {NAV.map(([label, href]) => (
            <Link key={label} href={href} className="mg-underline font-nav font-medium uppercase text-[11px] leading-[normal] tracking-[0.16em] text-[rgba(255,255,255,0.78)]">{label}</Link>
          ))}
        </nav>
      </div>

      {/* Follow + socials */}
      <div className="container-mg max-[680px]:!px-[22px] flex flex-col min-[681px]:flex-row min-[681px]:items-center justify-between gap-3.5 min-[681px]:gap-5 py-[26px] border-b border-white/[0.06]">
        <span className="font-mono uppercase text-[9px] tracking-[0.24em] text-[#f4f4f4]/40">Follow Modern Gentlemen</span>
        <div className="flex gap-3 text-[#f4f4f4]/55">
          {SOCIAL.map((s) => (
            <a key={s.label} href={s.href} title={s.label} aria-label={s.label} className="flex items-center justify-center h-10 w-10 rounded-full border border-white/[0.18] transition-colors hover:bg-mg-accent hover:border-mg-accent hover:text-white">
              {s.icon}
            </a>
          ))}
        </div>
      </div>

      {/* Legal. The prototype sets this line as plain text; the labels stay
          linked here, with literal " · " separators so the run measures the
          same as the design's single string. */}
      <div className="container-mg max-[680px]:!px-[22px] flex flex-col min-[681px]:flex-row justify-between gap-3.5 min-[681px]:gap-3 py-[22px] font-mono uppercase text-[10px] leading-[normal] tracking-[0.14em] text-[#f4f4f4]/40">
        <span>© {new Date().getFullYear()} Modern Gentlemen — Est. 2026</span>
        <span className="whitespace-pre-wrap">
          {LEGAL.map(([label, href], i) => (
            <span key={label}>
              {i > 0 && " · "}
              <Link href={href} className="hover:text-white transition-colors">{label}</Link>
            </span>
          ))}
        </span>
      </div>
    </footer>
  );
}
