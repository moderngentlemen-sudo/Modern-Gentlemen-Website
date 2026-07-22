import Link from "next/link";

const NAV: [string, string][] = [
  ["Style", "/style"], ["Grooming", "/grooming"], ["Watches", "/watches"], ["Culture", "/culture"], ["Film", "/film"], ["Store", "/shop"],
];
const SOCIAL: { label: string; mark: string; href: string }[] = [
  { label: "Instagram", mark: "I", href: "#" },
  { label: "X", mark: "X", href: "#" },
  { label: "YouTube", mark: "Y", href: "#" },
  { label: "LinkedIn", mark: "in", href: "#" },
];
const LEGAL: [string, string][] = [
  ["About", "/about"], ["Contact", "/contact"], ["Store", "/shop"], ["Archive", "/archive"], ["Privacy", "/privacy"],
];

/** Footer is ALWAYS dark, regardless of theme — do not wire to data-mgtheme. */
export function Footer() {
  return (
    <footer className="bg-[#0d0d0d] text-[#f4f4f4] mt-20 border-t border-white/12">
      <div className="container-mg py-14">
        {/* Brand + nav */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 md:items-start">
          <div className="max-w-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mg-logo-wide.svg" alt="Modern Gentlemen" className="h-[22px] w-auto" />
            <p className="mt-4 font-serif italic text-white/60 text-lg text-pretty">
              A field guide to the considered life — style, watches, film &amp; the art of doing things properly.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 md:justify-end" aria-label="Footer">
            {NAV.map(([label, href]) => (
              <Link key={label} href={href} className="font-nav uppercase text-[12.5px] tracking-[0.14em] text-white/60 hover:text-mg-accentSerif transition-colors">{label}</Link>
            ))}
          </nav>
        </div>

        {/* Follow + socials */}
        <div className="mt-12 flex flex-col sm:flex-row sm:items-center justify-between gap-5 border-t border-white/10 pt-10">
          <p className="font-mono uppercase text-[11px] tracking-[0.2em] text-white/50">Follow Modern Gentlemen</p>
          <div className="flex gap-3">
            {SOCIAL.map((s) => (
              <a key={s.label} href={s.href} aria-label={s.label} className="grid place-items-center h-[38px] w-[38px] rounded-full border border-white/20 font-nav text-xs uppercase transition-colors hover:bg-mg-accent hover:border-mg-accent">
                {s.mark}
              </a>
            ))}
          </div>
        </div>

        {/* Legal */}
        <div className="mt-10 flex flex-col sm:flex-row justify-between gap-3 font-mono uppercase text-[11px] tracking-[0.14em] text-white/40">
          <span>© {new Date().getFullYear()} Modern Gentlemen — Est. 2026</span>
          <div className="flex flex-wrap gap-5">
            {LEGAL.map(([label, href]) => (
              <Link key={label} href={href} className="hover:text-white transition-colors">{label}</Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
