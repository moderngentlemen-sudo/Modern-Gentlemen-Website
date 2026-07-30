"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTheme } from "@/lib/theme";
import { useHideOnScroll } from "@/lib/useHideOnScroll";
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

/** Routes that show the bag button. The editorial prototypes' header carries
 *  search + theme only (see `Modern Gentlemen Homepage.dc.html` and
 *  `handoff/screenshots/homepage-desktop.png`), while the store flow needs the
 *  drawer trigger and its count badge that `MG Header.dc.html` / `04_CHROME.md`
 *  specify — so the third icon appears on the store journey and nowhere else. */
const STORE_ROUTES = ["/shop", "/product", "/bag", "/checkout"];
const isStoreRoute = (path: string | null) =>
  !!path && STORE_ROUTES.some((r) => path === r || path.startsWith(`${r}/`));

/** Full chrome header: dark, frosted-on-scroll nav that slides away on
 *  scroll-down and returns on scroll-up (no resize — brand rejected resize
 *  motion, EXECUTION_PLAN §10), mega-menu, drawer, search, bag drawer, theme
 *  toggle, live bag badge. Always-dark chrome via data-darkband. See
 *  04_CHROME.md. */
export function Header() {
  const { theme, toggle } = useTheme();
  const cart = useCart();
  const showBag = isStoreRoute(usePathname());
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const [bag, setBag] = useState(false);
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [navHover, setNavHover] = useState(false);
  const [spin, setSpin] = useState(0);

  // An open overlay or mega-menu pins the bar: the overlays lock the body (which
  // fires non-gesture scroll events) and a menu must never slide out from under
  // the pointer. Hovering the bar pins it too (prototype `navHover`).
  const { scrolled, hidden, reveal } = useHideOnScroll({
    pinned: drawer || search || (bag && showBag) || !!menuKey || navHover,
  });

  // Prototype: `on = scrolled || megaOpen || navHover` drives the frost.
  const frosted = scrolled || !!menuKey || navHover;
  const openMenu = (key: string) => setMenuKey(MENU_KEYS.includes(key) ? key : null);

  // 'Frost only' nav motion (the prototype's chosen default).
  const MOTION = "0.45s cubic-bezier(.4,0,.2,1)";
  const slide = hidden ? "translateY(-100%)" : "none";

  return (
    <>
      {/* Top vignette scrim — fades out as the nav frosts in, and slides away
          with the bar so no band is left hanging at the top edge. */}
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 z-40 h-[85px] pointer-events-none will-change-[opacity,transform]"
        style={{
          opacity: frosted ? 0 : 1,
          transform: slide,
          transition: `opacity ${MOTION}, transform ${MOTION}`,
          background: "linear-gradient(180deg,rgba(8,8,9,0.34) 0%,rgba(8,8,9,0.14) 52%,transparent 100%)",
        }}
      />
      {/* Nav zone: sits 2px above the viewport top so the 72px bar's content box
          (72 − 2px padding − 1px rule) centers on y=34.5, exactly as the
          prototype's `top:-2px` + `padding:2px … 0` bar does. */}
      <div
        data-darkband
        data-hidden={hidden || undefined}
        className="fixed inset-x-0 top-[-2px] z-50 text-white will-change-transform"
        style={{ transform: slide, transition: `transform ${MOTION}` }}
        onMouseEnter={() => setNavHover(true)}
        onMouseLeave={() => {
          setNavHover(false);
          setMenuKey(null);
        }}
        // Tabbing into chrome that has slid away must bring it back into view.
        onFocus={reveal}
      >
        <header
          // ≤680 the bar insets 20px, two below the sections' 22px.
          className="container-mg max-[680px]:!px-5 box-border flex items-center justify-between h-[72px] pt-[2px] border-b"
          style={{
            background: frosted ? "rgba(13,13,13,0.55)" : "transparent",
            backdropFilter: frosted ? "blur(20px)" : "none",
            WebkitBackdropFilter: frosted ? "blur(20px)" : "none",
            borderBottomColor: frosted ? "rgba(255,255,255,0.12)" : "transparent",
            // Slide-away only — the bar keeps its 72px height (EXECUTION_PLAN §10).
            // The global prefers-reduced-motion rule zeroes the durations.
            //
            // `backdrop-filter` is deliberately NOT transitioned: animating it
            // re-runs a full-width blur every frame for the whole 450ms, on
            // every frost-in and frost-out (/PERFORMANCE.md). The blur toggles
            // instantly while the background tint and border still fade, which
            // is what actually reads as the frost arriving.
            transition: `background ${MOTION}, border-color ${MOTION}`,
          }}
        >
          {/* LEFT — burger (Sq thin pair) + monogram */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              aria-label="Open menu"
              title="Menu"
              aria-expanded={drawer}
              onClick={() => setDrawer(true)}
              // 24×22 box, squares flush left — the prototype's geometry. The
              // ::after ring below expands the hit area to 44px without adding
              // a single visible pixel.
              className="relative flex flex-col items-start justify-center gap-[4px] w-6 min-h-[22px] after:absolute after:-inset-[11px] after:content-['']"
            >
              <span className="block h-[6px] w-[6px] bg-[#f4f4f4]" />
              <span className="block h-[6px] w-[6px] bg-mg-accent" style={{ boxShadow: "0 0 8px 0 rgba(200,16,46,0.45)" }} />
            </button>
            <Link href="/" aria-label="Modern Gentlemen — home" className="flex items-center text-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mg-logo.svg" alt="Modern Gentlemen" className="block h-[19px] w-auto" />
            </Link>
          </div>

          {/* CENTER — nav (hidden ≤820px) */}
          <nav
            className="hidden min-[821px]:flex flex-1 min-w-0 justify-center gap-6 px-4 whitespace-nowrap"
            aria-label="Primary"
          >
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
                  className="mg-underline font-nav text-[12.5px] font-medium leading-[normal] tracking-[0.14em] text-[rgba(255,255,255,0.78)] hover:text-white"
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          {/* RIGHT — icon cluster: search · bag · theme */}
          <div className="flex items-center gap-[5px] min-[681px]:gap-3.5 shrink-0">
            <IconButton label="Search" title="Search" onClick={() => setSearch(true)}>
              <SearchIcon />
            </IconButton>
            {showBag && (
              <IconButton label="Bag" title="Bag" onClick={() => setBag(true)}>
                <BagIcon />
                {cart.count > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 grid place-items-center rounded-full bg-mg-accent text-white font-grotesk font-semibold text-[10px] leading-none">
                    {cart.count}
                  </span>
                )}
              </IconButton>
            )}
            <IconButton
              label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
              title="Toggle light / dark"
              className="overflow-hidden"
              onClick={() => {
                toggle();
                setSpin((s) => s + 1);
              }}
            >
              {/* Alternating spin direction, matching mgSpin / mgSpinB. */}
              <span
                key={spin}
                className={`flex ${
                  spin === 0
                    ? ""
                    : spin % 2 === 1
                      ? "motion-safe:animate-[mgSpin_.5s_cubic-bezier(.34,1.4,.5,1)]"
                      : "motion-safe:animate-[mgSpinB_.5s_cubic-bezier(.34,1.4,.5,1)]"
                }`}
              >
                <ThemeIcon dark={theme === "dark"} />
              </span>
            </IconButton>
          </div>
        </header>

        <MegaMenu activeKey={menuKey} onClose={() => setMenuKey(null)} />
      </div>

      <Drawer open={drawer} onClose={() => setDrawer(false)} />
      <SearchOverlay open={search} onClose={() => setSearch(false)} />
      {/* Gated on `showBag` too, so navigating off the store journey with the
          drawer open can't leave it hanging with no trigger to close it. */}
      <BagDrawer open={bag && showBag} onClose={() => setBag(false)} />
    </>
  );
}

/** 38px icon button. `iconBubbles` is off in the prototype, so the circle is
 *  fully transparent — only the 16px glyph shows — and `iconHover: 'Scale'`
 *  grows it 1.2× on hover. */
function IconButton({
  label,
  title,
  onClick,
  className = "",
  children,
}: {
  label: string;
  title?: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      onClick={onClick}
      className={`relative flex items-center justify-center h-[38px] w-[38px] rounded-full border border-transparent bg-transparent text-white transition-transform duration-[240ms] ease-[cubic-bezier(.34,1.4,.5,1)] hover:scale-[1.2] active:scale-95 ${className}`}
    >
      {children}
    </button>
  );
}

/* --- inline icons (stroke = currentColor), 16px as the prototype sizes them --- */
function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  );
}
function BagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </svg>
  );
}
/** Half-filled circle: outlined ring with one hemisphere filled — the fill flips
 *  side with the theme (prototype `themeArc`). */
function ThemeIcon({ dark }: { dark: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <path d={dark ? "M12 4a8 8 0 0 1 0 16Z" : "M12 4a8 8 0 0 0 0 16Z"} fill="currentColor" stroke="none" />
    </svg>
  );
}
