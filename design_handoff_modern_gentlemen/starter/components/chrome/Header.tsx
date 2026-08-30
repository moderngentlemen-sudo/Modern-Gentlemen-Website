"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/lib/theme";
import { useHideOnScroll } from "@/lib/useHideOnScroll";
import { useCart } from "@/lib/cart/CartProvider";
import { Drawer } from "./Drawer";
import { SearchOverlay } from "./SearchOverlay";
import { BagDrawer } from "./BagDrawer";
import { MegaMenu } from "./MegaMenu";
import type { NavLink } from "@/lib/domain/navigation";
import { DEFAULT_THEME_HEADER, type ThemeHeader } from "@/lib/domain/theme";

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
 *  04_CHROME.md.
 *
 *  The nav is passed in rather than declared here: `app/(site)/layout.tsx` reads
 *  `header-primary` from Supabase and hands it down. An entry with children
 *  opens the mega-menu, which is what the `MENU_KEYS` allowlist used to decide —
 *  the tree now says so itself, so there is nothing to keep in step.
 *
 *  Labels arrive in title case ("Style") because the drawer shows them that way;
 *  the `uppercase` class is what makes this bar read "STYLE" as it always has.
 *  A CSS transform emits the same glyphs as the literal string it replaced. */
export function Header({
  nav = [],
  drawerSecondary = [],
  settings = DEFAULT_THEME_HEADER,
}: {
  nav?: NavLink[];
  drawerSecondary?: NavLink[];
  settings?: ThemeHeader;
}) {
  const { theme, toggle } = useTheme();
  const cart = useCart();
  const storeRoute = isStoreRoute(usePathname());
  const showBag =
    settings.cartVisibility === "always" ||
    (settings.cartVisibility === "store-only" && storeRoute);
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const [bag, setBag] = useState(false);
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [navHover, setNavHover] = useState(false);
  const [spin, setSpin] = useState(0);
  const navZoneRef = useRef<HTMLDivElement>(null);

  // Touch devices synthesise a mouseenter on tap but often never fire the
  // matching mouseleave, which would leave the bar frosted AND pinned open for
  // the rest of the session — hide-on-scroll silently dead on mobile. The
  // prototype's guard: any pointerdown outside the nav zone drops both states.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const zone = navZoneRef.current;
      if (zone && e.target instanceof Node && zone.contains(e.target)) return;
      setNavHover(false);
      setMenuKey(null);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  // An open overlay or mega-menu pins the bar: the overlays lock the body (which
  // fires non-gesture scroll events) and a menu must never slide out from under
  // the pointer. Hovering the bar pins it too (prototype `navHover`).
  const {
    scrolled,
    hidden: scrollHidden,
    reveal,
  } = useHideOnScroll({
    pinned: drawer || search || (bag && showBag) || !!menuKey || navHover,
  });
  const hidden = settings.scrollBehavior === "hide-on-scroll" && scrollHidden;
  const compact = settings.shrinkOnScroll && scrolled && !drawer && !search && !bag && !menuKey;
  const headerHeight = compact ? settings.shrunkHeight : settings.height;

  // Dynamic is the verified prototype behavior; the other two are explicit
  // editor choices and leave menu/overlay behavior unchanged.
  const frosted =
    settings.background === "solid" ||
    (settings.background === "dynamic" && (scrolled || !!menuKey || navHover));

  // An entry opens the mega-menu if it has children. `menuKey` is that entry's
  // id — the allowlist it replaced was a constant that had to be kept in step
  // with the menu data by hand.
  const megaKeys = new Set(nav.filter((entry) => entry.children.length > 0).map((e) => e.id));
  const activeEntry = nav.find((entry) => entry.id === menuKey) ?? null;
  const openMenu = (key: string) => setMenuKey(megaKeys.has(key) ? key : null);

  // 'Frost only' nav motion (the prototype's chosen default).
  const MOTION = "0.45s cubic-bezier(.4,0,.2,1)";
  const slide = hidden ? "translateY(-100%)" : "none";

  return (
    <>
      {/* Top vignette scrim — fades out as the nav frosts in, and slides away
          with the bar so no band is left hanging at the top edge. */}
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 z-40 pointer-events-none will-change-[opacity,transform]"
        style={{
          height: headerHeight + 13,
          opacity: frosted ? 0 : 1,
          transform: slide,
          transition: `opacity ${MOTION}, transform ${MOTION}`,
          background:
            "linear-gradient(180deg,rgba(8,8,9,0.34) 0%,rgba(8,8,9,0.14) 52%,transparent 100%)",
        }}
      />
      {/* Nav zone: sits 2px above the viewport top so the 72px bar's content box
          (72 − 2px padding − 1px rule) centers on y=34.5, exactly as the
          prototype's `top:-2px` + `padding:2px … 0` bar does. */}
      <div
        ref={navZoneRef}
        data-darkband
        data-hidden={hidden || undefined}
        className="fixed inset-x-0 top-[-2px] z-50 text-white will-change-transform"
        style={{ transform: slide, transition: `transform ${MOTION}` }}
        // Frost/pin follows the pointer being over a nav LINK or the open
        // panel — not merely over the bar. Hovering the logo, the icons or the
        // gaps unfrosts (but never closes an open panel: that empty space
        // bridges the nav and the dropdown). Matches the prototype's
        // `_megaOver`, and is what keeps a stationary cursor at the top of the
        // screen from pinning the header open for good.
        onMouseOver={(e) => {
          const t = e.target as HTMLElement | null;
          if (!t?.closest) return;
          const link = t.closest("a[data-mega]");
          if (link) {
            const key = link.getAttribute("data-mega") || "";
            setMenuKey(megaKeys.has(key) ? key : null);
            setNavHover(true);
          } else if (t.closest("[data-mega-panel]")) {
            setNavHover(true);
          } else if (menuKey === null) {
            setNavHover(false);
          }
        }}
        onMouseLeave={() => {
          setNavHover(false);
          setMenuKey(null);
        }}
        // Tabbing into chrome that has slid away must bring it back into view.
        onFocus={reveal}
      >
        <header
          // ≤680 the bar insets 20px, two below the sections' 22px.
          className="container-mg max-[680px]:!px-5 box-border flex items-center justify-between pt-[2px] border-b"
          style={{
            height: headerHeight,
            background: frosted ? "rgba(13,13,13,0.55)" : "transparent",
            backdropFilter: frosted ? "blur(20px)" : "none",
            WebkitBackdropFilter: frosted ? "blur(20px)" : "none",
            borderBottomColor:
              frosted || settings.divider ? "rgba(255,255,255,0.12)" : "transparent",
            // Slide-away only — the bar keeps its 72px height (EXECUTION_PLAN §10).
            // The global prefers-reduced-motion rule zeroes the durations.
            transition: `height ${MOTION}, background ${MOTION}, backdrop-filter ${MOTION}, border-color ${MOTION}`,
          }}
        >
          {/* LEFT — burger (Sq thin pair) + monogram */}
          <div
            className="flex items-center gap-1 shrink-0 transition-transform"
            style={{ transform: `scale(${settings.scale})` }}
          >
            <button
              aria-label="Open menu"
              title="Menu"
              aria-expanded={drawer}
              onClick={() => setDrawer(true)}
              // 24×22 box, squares flush left — the prototype's geometry. The
              // ::after ring below expands the hit area to 44px without adding
              // a single visible pixel.
              //
              // Hover = burgerHover 'Staircase': the two squares stretch into
              // stepped bars, 12px then 17px, on the springy .3s curve. The mark
              // itself does NOT scale — the prototype's generic
              // `[data-burger]:hover{scale(1.06)}` is overridden inside the nav
              // by its header-scale rule, so the bars are the whole animation.
              className="group/burger relative flex flex-col items-start justify-center gap-[4px] w-6 min-h-[22px] after:absolute after:-inset-[11px] after:content-['']"
            >
              <span className="block h-[6px] w-[6px] bg-[#f4f4f4] transition-[width,transform,background-color,box-shadow] duration-300 ease-[cubic-bezier(.34,1.4,.5,1)] group-hover/burger:w-3" />
              <span
                className="block h-[6px] w-[6px] bg-mg-accent transition-[width,transform,background-color,box-shadow] duration-300 ease-[cubic-bezier(.34,1.4,.5,1)] group-hover/burger:w-[17px]"
                style={{ boxShadow: "0 0 8px 0 rgba(200,16,46,0.45)" }}
              />
            </button>
            <Link
              href="/"
              aria-label="Modern Gentlemen — home"
              className="flex items-center text-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mg-logo.svg" alt="Modern Gentlemen" className="block h-[19px] w-auto" />
            </Link>
          </div>

          {/* CENTER — nav (hidden ≤820px) */}
          <nav
            className="hidden min-[821px]:flex flex-1 min-w-0 justify-center gap-6 px-4 whitespace-nowrap"
            aria-label="Primary"
            style={{ transform: `scale(${settings.scale})` }}
          >
            {nav.map((n) => {
              const hasMenu = megaKeys.has(n.id);
              return (
                <Link
                  key={n.id}
                  href={n.href}
                  aria-haspopup={hasMenu || undefined}
                  aria-expanded={hasMenu ? menuKey === n.id : undefined}
                  data-mega={hasMenu ? n.id : ""}
                  onFocus={() => openMenu(n.id)}
                  onClick={(e) => {
                    // Coarse-pointer / no-hover: first tap opens the mega-menu
                    // instead of navigating; a second tap follows the link.
                    if (hasMenu && menuKey !== n.id) {
                      e.preventDefault();
                      setMenuKey(n.id);
                    }
                  }}
                  className="mg-underline font-nav text-[12.5px] font-medium uppercase leading-[normal] tracking-[0.14em] text-[rgba(255,255,255,0.78)] hover:text-white"
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          {/* RIGHT — icon cluster: search · bag · theme */}
          <div
            className="flex items-center gap-[5px] min-[681px]:gap-3.5 shrink-0 transition-transform"
            style={{ transform: `scale(${settings.scale})` }}
          >
            {settings.showSearch && (
              <IconButton
                label="Search"
                title="Search"
                expanded={search}
                controls="mg-search-overlay"
                bubbles={settings.iconBubbles}
                hover={settings.iconHover}
                onClick={() => setSearch(true)}
              >
                <SearchIcon />
              </IconButton>
            )}
            {showBag && (
              <IconButton
                label="Bag"
                title="Bag"
                expanded={bag}
                controls="mg-bag-drawer"
                bubbles={settings.iconBubbles}
                hover={settings.iconHover}
                onClick={() => setBag(true)}
              >
                <BagIcon />
                {cart.count > 0 && (
                  <span className="absolute -top-[3px] -right-[3px] box-border min-w-[17px] h-[17px] px-1 grid place-items-center bg-mg-accent text-white font-grotesk font-semibold text-[10px] leading-none">
                    {cart.count}
                  </span>
                )}
              </IconButton>
            )}
            {settings.showThemeToggle && (
              <IconButton
                label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
                title="Toggle light / dark"
                className="overflow-hidden"
                bubbles={settings.iconBubbles}
                hover={settings.iconHover}
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
            )}
          </div>
        </header>

        <MegaMenu entry={activeEntry} onClose={() => setMenuKey(null)} />
      </div>

      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        groups={nav}
        secondary={drawerSecondary}
      />
      <SearchOverlay open={settings.showSearch && search} onClose={() => setSearch(false)} />
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
  expanded,
  controls,
  bubbles = false,
  hover = "scale",
  children,
}: {
  label: string;
  title?: string;
  onClick: () => void;
  className?: string;
  /**
   * Present only on the buttons that open an overlay.
   *
   * The drawer trigger has carried `aria-expanded` since Track A; search and bag
   * open the same kind of modal dialog and did not, which a screen-reader user
   * hears as an ordinary button that appears to do nothing. `undefined` keeps
   * the attribute off buttons that toggle nothing — an always-false
   * `aria-expanded` on the theme switch would be a different lie.
   */
  expanded?: boolean;
  /** The dialog this button opens, so the relationship is announced too. */
  controls?: string;
  bubbles?: boolean;
  hover?: ThemeHeader["iconHover"];
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      aria-expanded={expanded}
      aria-controls={expanded === undefined ? undefined : controls}
      onClick={onClick}
      className={`relative flex items-center justify-center h-[38px] w-[38px] rounded-full border text-white transition-all duration-[240ms] ease-[cubic-bezier(.34,1.4,.5,1)] active:scale-95 ${
        bubbles ? "border-white/15 bg-white/[0.08]" : "border-transparent bg-transparent"
      } ${
        hover === "scale"
          ? "hover:scale-[1.2]"
          : hover === "lift"
            ? "hover:-translate-y-1"
            : hover === "circle"
              ? "hover:border-white/25 hover:bg-white/[0.12]"
              : hover === "glow"
                ? "hover:shadow-[0_0_22px_rgba(200,16,46,0.55)]"
                : ""
      } ${className}`}
    >
      {children}
    </button>
  );
}

/* --- inline icons (stroke = currentColor), 16px as the prototype sizes them --- */
function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  );
}
function BagIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6.5 8h11l-1 12h-9l-1-12Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}
/** Half-filled circle: outlined ring with one hemisphere filled — the fill flips
 *  side with the theme (prototype `themeArc`). */
function ThemeIcon({ dark }: { dark: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <circle cx="12" cy="12" r="8" />
      <path
        d={dark ? "M12 4a8 8 0 0 1 0 16Z" : "M12 4a8 8 0 0 0 0 16Z"}
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
