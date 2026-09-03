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
import { useVisibleNavigation } from "@/lib/useVisibleNavigation";

/** Routes that show the bag button. The editorial prototypes' header carries
 *  search + theme only (see `Modern Gentlemen Homepage.dc.html` and
 *  `handoff/screenshots/homepage-desktop.png`), while the store flow needs the
 *  drawer trigger and its count badge that `MG Header.dc.html` / `04_CHROME.md`
 *  specify — so the third icon appears on the store journey and nowhere else. */
const STORE_ROUTES = ["/shop", "/product", "/bag", "/checkout"];
const isStoreRoute = (path: string | null) =>
  !!path && STORE_ROUTES.some((r) => path === r || path.startsWith(`${r}/`));

/** Full chrome header: dark, frosted-on-scroll nav that slides away on
 *  scroll-down and returns on scroll-up. The compatibility preset does not
 *  resize; editors may explicitly enable the compact height. Mega-menu,
 *  drawer, search, bag drawer, theme
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
  const visibleNav = useVisibleNavigation(nav);
  const visibleSecondary = useVisibleNavigation(drawerSecondary);

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
  const announcementHeight = settings.announcementText ? 28 : 0;
  const chromeHeight = headerHeight + announcementHeight;

  // Dynamic is the verified prototype behavior; the other two are explicit
  // editor choices and leave menu/overlay behavior unchanged.
  const frosted =
    settings.background === "solid" ||
    (settings.background === "dynamic" && (scrolled || !!menuKey || navHover));

  // An entry opens the mega-menu if it has children. `menuKey` is that entry's
  // id — the allowlist it replaced was a constant that had to be kept in step
  // with the menu data by hand.
  const megaKeys = new Set(
    visibleNav.filter((entry) => entry.children.length > 0).map((entry) => entry.id)
  );
  const activeEntry = visibleNav.find((entry) => entry.id === menuKey) ?? null;
  const openMenu = (key: string) => setMenuKey(megaKeys.has(key) ? key : null);

  // Frost-only motion remains the compatibility default.
  const MOTION = "0.45s cubic-bezier(.4,0,.2,1)";
  const slide = hidden ? "translateY(-100%)" : "none";
  const splitAt = Math.ceil(visibleNav.length / 2);

  const navigation = (items: NavLink[], label = "Primary", align = "justify-center") => (
    <nav
      className={`hidden min-[821px]:flex min-w-0 gap-6 whitespace-nowrap ${align}`}
      aria-label={label}
      style={{ transform: `scale(${settings.scale})` }}
    >
      {items.map((item) => {
        const hasMenu = megaKeys.has(item.id);
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-haspopup={hasMenu || undefined}
            aria-expanded={hasMenu ? menuKey === item.id : undefined}
            data-mega={hasMenu ? item.id : ""}
            onFocus={() => openMenu(item.id)}
            onClick={(event) => {
              if (hasMenu && menuKey !== item.id) {
                event.preventDefault();
                setMenuKey(item.id);
              }
            }}
            className="mg-underline font-nav text-[12.5px] font-medium uppercase leading-[normal] tracking-[0.14em] text-[rgba(255,255,255,0.78)] hover:text-white"
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const burgerButton = <BurgerButton expanded={drawer} onClick={() => setDrawer(true)} />;
  const logoLink = <LogoLink />;
  const actions = (
    <HeaderActions
      settings={settings}
      theme={theme}
      cartCount={cart.count}
      showBag={showBag}
      search={search}
      bag={bag}
      spin={spin}
      onSearch={() => setSearch(true)}
      onBag={() => setBag(true)}
      onTheme={() => {
        toggle();
        setSpin((value) => value + 1);
      }}
    />
  );

  return (
    <>
      {/* Top vignette scrim — fades out as the nav frosts in, and slides away
          with the bar so no band is left hanging at the top edge. */}
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 z-40 pointer-events-none will-change-[opacity,transform]"
        style={{
          height: chromeHeight + 13,
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
        {settings.announcementText && (
          <div
            className="flex h-7 items-center justify-center border-b border-white/10 bg-[#0d0d0d]/90 px-5 text-center font-nav text-[10px] font-medium uppercase tracking-[0.14em] text-white/85 backdrop-blur-xl"
            data-testid="header-announcement"
          >
            {settings.announcementHref ? (
              <Link className="mg-underline hover:text-white" href={settings.announcementHref}>
                {settings.announcementText}
              </Link>
            ) : (
              <span>{settings.announcementText}</span>
            )}
          </div>
        )}
        <header
          // ≤680 the bar insets 20px, two below the sections' 22px.
          data-header-composition={settings.composition}
          className={`container-mg max-[680px]:!px-5 box-border items-center pt-[2px] border-b ${
            settings.composition === "centered-logo"
              ? "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
              : "flex"
          }`}
          style={{
            height: headerHeight,
            background: frosted ? "rgba(13,13,13,0.55)" : "transparent",
            backdropFilter: frosted ? "blur(20px)" : "none",
            WebkitBackdropFilter: frosted ? "blur(20px)" : "none",
            borderBottomColor:
              frosted || settings.divider ? "rgba(255,255,255,0.12)" : "transparent",
            // The global prefers-reduced-motion rule zeroes the durations.
            transition: `height ${MOTION}, background ${MOTION}, backdrop-filter ${MOTION}, border-color ${MOTION}`,
          }}
        >
          {settings.composition === "centered-logo" ? (
            <>
              <div className="flex min-w-0 items-center gap-6 overflow-hidden">
                {burgerButton}
                {navigation(
                  visibleNav.slice(0, splitAt),
                  "Primary navigation, first group",
                  "justify-start"
                )}
              </div>
              <div style={{ transform: `scale(${settings.scale})` }}>{logoLink}</div>
              <div className="flex min-w-0 items-center justify-end gap-6 overflow-hidden">
                {navigation(
                  visibleNav.slice(splitAt),
                  "Primary navigation, second group",
                  "justify-end"
                )}
                {actions}
              </div>
            </>
          ) : (
            <>
              <div
                className="flex shrink-0 items-center gap-1 transition-transform"
                style={{ transform: `scale(${settings.scale})` }}
              >
                {burgerButton}
                {logoLink}
              </div>
              <div
                className={`min-w-0 px-4 ${
                  settings.composition === "navigation-left" ? "flex-none" : "flex-1"
                }`}
              >
                {navigation(
                  visibleNav,
                  "Primary",
                  settings.composition === "navigation-left" ? "justify-start" : "justify-center"
                )}
              </div>
              <div className="ml-auto">{actions}</div>
            </>
          )}
        </header>

        <MegaMenu entry={activeEntry} onClose={() => setMenuKey(null)} />
      </div>

      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        groups={visibleNav}
        secondary={visibleSecondary}
      />
      <SearchOverlay open={settings.showSearch && search} onClose={() => setSearch(false)} />
      {/* Gated on `showBag` too, so navigating off the store journey with the
          drawer open can't leave it hanging with no trigger to close it. */}
      <BagDrawer open={bag && showBag} onClose={() => setBag(false)} />
    </>
  );
}

function BurgerButton({ expanded, onClick }: { expanded: boolean; onClick: () => void }) {
  return (
    <button
      aria-label="Open menu"
      title="Menu"
      aria-expanded={expanded}
      onClick={onClick}
      className="group/burger relative flex min-h-[22px] w-6 shrink-0 flex-col items-start justify-center gap-[4px] after:absolute after:-inset-[11px] after:content-['']"
    >
      <span className="block h-[6px] w-[6px] bg-[#f4f4f4] transition-[width,transform,background-color,box-shadow] duration-300 ease-[cubic-bezier(.34,1.4,.5,1)] group-hover/burger:w-3" />
      <span
        className="block h-[6px] w-[6px] bg-mg-accent transition-[width,transform,background-color,box-shadow] duration-300 ease-[cubic-bezier(.34,1.4,.5,1)] group-hover/burger:w-[17px]"
        style={{ boxShadow: "0 0 8px 0 rgba(200,16,46,0.45)" }}
      />
    </button>
  );
}

function LogoLink() {
  return (
    <Link href="/" aria-label="Modern Gentlemen — home" className="flex items-center text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mg-logo.svg" alt="Modern Gentlemen" className="block h-[19px] w-auto" />
    </Link>
  );
}

function HeaderActions({
  settings,
  theme,
  cartCount,
  showBag,
  search,
  bag,
  spin,
  onSearch,
  onBag,
  onTheme,
}: {
  settings: ThemeHeader;
  theme: "light" | "dark";
  cartCount: number;
  showBag: boolean;
  search: boolean;
  bag: boolean;
  spin: number;
  onSearch: () => void;
  onBag: () => void;
  onTheme: () => void;
}) {
  return (
    <div
      className="flex shrink-0 items-center gap-[5px] transition-transform min-[681px]:gap-3.5"
      style={{ transform: `scale(${settings.scale})` }}
    >
      {settings.ctaLabel && settings.ctaHref && (
        <Link
          href={settings.ctaHref}
          className="hidden border border-white/25 px-4 py-2 font-nav text-[10px] font-medium uppercase tracking-[0.14em] text-white transition-colors hover:border-mg-accent hover:bg-mg-accent min-[681px]:block"
        >
          {settings.ctaLabel}
        </Link>
      )}
      {settings.showSocials && settings.instagramHref && (
        <Link
          href={settings.instagramHref}
          aria-label="Instagram"
          className="hidden font-nav text-[10px] font-medium uppercase tracking-[0.14em] text-white/75 transition-colors hover:text-white min-[1100px]:block"
        >
          IG
        </Link>
      )}
      {settings.showSocials && settings.xHref && (
        <Link
          href={settings.xHref}
          aria-label="X"
          className="hidden font-nav text-[10px] font-medium uppercase tracking-[0.14em] text-white/75 transition-colors hover:text-white min-[1100px]:block"
        >
          X
        </Link>
      )}
      {settings.showAccount && settings.accountHref && (
        <Link
          href={settings.accountHref}
          aria-label="Account"
          title="Account"
          className={`relative flex h-[38px] w-[38px] items-center justify-center rounded-full border text-white transition-all duration-[240ms] ease-[cubic-bezier(.34,1.4,.5,1)] active:scale-95 ${
            settings.iconBubbles ? "border-white/15 bg-white/[0.08]" : "border-transparent"
          } ${headerHoverClass(settings.iconHover)}`}
        >
          <AccountIcon />
        </Link>
      )}
      {settings.showSearch && (
        <IconButton
          label="Search"
          title="Search"
          expanded={search}
          controls="mg-search-overlay"
          bubbles={settings.iconBubbles}
          hover={settings.iconHover}
          onClick={onSearch}
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
          onClick={onBag}
        >
          <BagIcon />
          {cartCount > 0 && (
            <span className="absolute -top-[3px] -right-[3px] box-border grid h-[17px] min-w-[17px] place-items-center bg-mg-accent px-1 font-grotesk text-[10px] font-semibold leading-none text-white">
              {cartCount}
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
          onClick={onTheme}
        >
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
      } ${headerHoverClass(hover)} ${className}`}
    >
      {children}
    </button>
  );
}

function headerHoverClass(hover: ThemeHeader["iconHover"]): string {
  return hover === "scale"
    ? "hover:scale-[1.2]"
    : hover === "lift"
      ? "hover:-translate-y-1"
      : hover === "circle"
        ? "hover:border-white/25 hover:bg-white/[0.12]"
        : hover === "glow"
          ? "hover:shadow-[0_0_22px_rgba(200,16,46,0.55)]"
          : "";
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
function AccountIcon() {
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
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
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
