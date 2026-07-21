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

/** Full chrome header: frosted-on-scroll nav, mega-menu, drawer, search,
 *  bag drawer, theme toggle, live bag badge. See 04_CHROME.md. */
export function Header() {
  const { theme, toggle } = useTheme();
  const cart = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const [bag, setBag] = useState(false);
  const [menuKey, setMenuKey] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 z-40 h-[85px] pointer-events-none"
        style={{ background: "linear-gradient(180deg,rgba(8,8,9,0.34) 0%,rgba(8,8,9,0.14) 52%,transparent 100%)" }}
      />
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-colors ${scrolled || menuKey ? "bg-mg-bg/80 backdrop-blur-md border-b border-mg-bd/10" : "bg-transparent"}`}
        onMouseLeave={() => setMenuKey(null)}
      >
        <div className="flex items-center justify-between px-6 md:px-10 h-[64px] text-mg-fg">
          <div className="flex items-center gap-4">
            <button aria-label="Open menu" onClick={() => setDrawer(true)} className="h-8 w-8 bg-mg-accent" />
            <Link href="/" className="font-grotesk font-bold text-xl tracking-tight">MG</Link>
          </div>

          <nav className="hidden lg:flex items-center gap-7">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onMouseEnter={() => setMenuKey(MENU_KEYS.includes(n.key) ? n.key : null)}
                onFocus={() => setMenuKey(MENU_KEYS.includes(n.key) ? n.key : null)}
                className="font-nav text-sm tracking-wide pb-1.5 border-b-2 border-transparent hover:border-mg-accent transition-colors"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-5">
            <button aria-label="Search" onClick={() => setSearch(true)} className="font-mono text-xs">⌕</button>
            <button aria-label="Bag" onClick={() => setBag(true)} className="relative font-mono text-xs">
              BAG
              {cart.count > 0 && (
                <span className="absolute -top-2 -right-3 h-4 min-w-4 px-1 grid place-items-center rounded-full bg-mg-accent text-white text-[10px]">{cart.count}</span>
              )}
            </button>
            <button aria-label="Toggle theme" onClick={toggle} className="font-mono text-xs">{theme === "light" ? "◐" : "◑"}</button>
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
