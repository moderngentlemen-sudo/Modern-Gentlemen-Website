"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme } from "@/lib/theme";
import { useCart } from "@/lib/cart/CartProvider";
import { Drawer } from "./Drawer";
import { SearchOverlay } from "./SearchOverlay";
import { BagDrawer } from "./BagDrawer";
import { MegaMenu, MENU_KEYS } from "./MegaMenu";

const NAV = [
  { label: "STYLE", href: "/style", key: "STYLE" },
  { label: "GROOMING", href: "/grooming", key: "GROOMING" },
  { label: "WATCHES", href: "/watches", key: "WATCHES" },
  { label: "CULTURE", href: "/culture", key: "CULTURE" },
  { label: "FILM", href: "/film", key: "" },
  { label: "STORE", href: "/shop", key: "" },
];

/** Full chrome header: dark, frosted-on-scroll nav (no resize — brand rejected
 *  resize motion, EXECUTION_PLAN §10), mega-menu, drawer, search, bag drawer,
 *  theme toggle, live bag badge. Always-dark chrome via data-darkband. See
 *  04_CHROME.md. */
export function Header() {
  const { theme, toggle } = useTheme();
  const cart = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const [bag, setBag] = useState(false);
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [spin, setSpin] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const frosted = scrolled || !!menuKey;
  const openMenu = (key: string) => setMenuKey(MENU_KEYS.includes(key) ? key : null);

  return (
    <>
      {/* Top vignette scrim — fades out as the nav frosts in. */}
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 z-40 h-[85px] pointer-events-none transition-opacity duration-500"
        style={{
          opacity: frosted ? 0 : 1,
          background: "linear-gradient(180deg,rgba(8,8,9,0.34) 0%,rgba(8,8,9,0.14) 52%,transparent 100%)",
        }}
      />
      <header
        data-darkband
        className={`fixed inset-x-0 top-0 z-50 text-[#f4f4f4] transition-[background-color,backdrop-filter,border-color] duration-500 ${
          frosted
            ? "bg-[rgba(13,13,13,0.55)] backdrop-blur-[20px] border-b border-white/10"
            : "bg-transparent border-b border-transparent"
        }`}
        onMouseLeave={() => setMenuKey(null)}
      >
        <div className="container-mg flex items-center justify-between h-[72px]">
          {/* LEFT — burger (Sq thin pair) + monogram */}
          <div className="flex items-center gap-5">
            <button
              aria-label="Open menu"
              aria-expanded={drawer}
              onClick={() => setDrawer(true)}
              className="grid place-content-center gap-[4px] min-h-[44px] min-w-[44px] -ml-2.5"
            >
              <span className="block h-[6px] w-[6px] bg-[#f4f4f4]" />
              <span className="block h-[6px] w-[6px] bg-mg-accent" style={{ boxShadow: "0 0 8px rgba(200,16,46,0.45)" }} />
            </button>
            <Link href="/" aria-label="Modern Gentlemen — home" className="inline-flex">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mg-logo.svg" alt="Modern Gentlemen" className="h-[19px] w-auto" />
            </Link>
          </div>

          {/* CENTER — nav (hidden ≤820px) */}
          <nav className="hidden min-[821px]:flex items-center gap-6" aria-label="Primary">
            {NAV.map((n) => {
              const hasMenu = MENU_KEYS.includes(n.key);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-haspopup={hasMenu || undefined}
                  aria-expanded={hasMenu ? menuKey === n.key : undefined}
                  onMouseEnter={() => openMenu(n.key)}
                  onFocus={() => openMenu(n.key)}
                  onClick={(e) => {
                    // Coarse-pointer / no-hover: first tap opens the mega-menu
                    // instead of navigating; a second tap follows the link.
                    if (hasMenu && menuKey !== n.key) {
                      e.preventDefault();
                      setMenuKey(n.key);
                    }
                  }}
                  className="mg-underline font-nav text-[12.5px] font-medium tracking-[0.14em] text-[rgba(244,244,244,0.8)]"
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          {/* RIGHT — icon cluster: search · bag · theme */}
          <div className="flex items-center gap-3.5">
            <IconButton label="Search" onClick={() => setSearch(true)}>
              <SearchIcon />
            </IconButton>
            <IconButton label="Bag" onClick={() => setBag(true)}>
              <BagIcon />
              {cart.count > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 grid place-items-center rounded-full bg-mg-accent text-white font-grotesk font-semibold text-[10px] leading-none">
                  {cart.count}
                </span>
              )}
            </IconButton>
            <IconButton
              label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
              onClick={() => {
                toggle();
                setSpin((s) => s + 1);
              }}
            >
              <span key={spin} className={`inline-flex ${spin ? "motion-safe:animate-[mgSpin_.5s_ease]" : ""}`}>
                {theme === "light" ? <SunIcon /> : <MoonIcon />}
              </span>
            </IconButton>
          </div>
        </div>

        <MegaMenu activeKey={menuKey} onClose={() => setMenuKey(null)} />
      </header>

      <Drawer open={drawer} onClose={() => setDrawer(false)} />
      <SearchOverlay open={search} onClose={() => setSearch(false)} />
      <BagDrawer open={bag} onClose={() => setBag(false)} />
    </>
  );
}

/** 40px circular glass icon button. */
function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="relative grid place-items-center h-10 w-10 rounded-full border border-white/20 bg-white/10 backdrop-blur-md text-[#f4f4f4] transition-transform hover:scale-[1.09]"
    >
      {children}
    </button>
  );
}

/* --- inline icons (stroke = currentColor) --- */
function SearchIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  );
}
function BagIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </svg>
  );
}
function SunIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
