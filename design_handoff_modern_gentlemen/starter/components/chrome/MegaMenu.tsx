"use client";

import Link from "next/link";

type Column = { heading: string; links: [string, string][] };
type Menu = { columns: Column[]; feature: { tag: string; title: string; image: string; href: string } };

const MENUS: Record<string, Menu> = {
  STYLE: {
    columns: [
      { heading: "Categories", links: [["Tailoring", "/style"], ["Casualwear", "/style"], ["Footwear", "/style"], ["Accessories", "/style"]] },
      { heading: "Guides", links: [["The Capsule Wardrobe", "/style"], ["Fabric & Cloth", "/style"], ["Seasonal Edits", "/style"]] },
    ],
    feature: { tag: "STYLE · 041", title: "Racing Green Is the New Navy", image: "/images/style-mono.jpg", href: "/style" },
  },
  GROOMING: {
    columns: [
      { heading: "Categories", links: [["Skincare", "/grooming"], ["Fragrance", "/grooming"], ["Hair", "/grooming"], ["Shaving", "/grooming"]] },
      { heading: "Routines", links: [["The Seven-Minute Standard", "/grooming"], ["The Travel Kit", "/grooming"], ["Evening Reset", "/grooming"]] },
    ],
    feature: { tag: "GROOMING · 039", title: "The Case Against 12-Step Routines", image: "/images/grooming.jpg", href: "/grooming" },
  },
  WATCHES: {
    columns: [
      { heading: "Categories", links: [["Chronographs", "/watches"], ["Dress Watches", "/watches"], ["Dive Watches", "/watches"], ["Vintage", "/watches"]] },
      { heading: "Collecting", links: [["Dial Symmetry", "/watches"], ["Movements 101", "/watches"], ["The Buying Guide", "/watches"]] },
    ],
    feature: { tag: "WATCHES · 040", title: "Chronographs Born on the Grid", image: "/images/watch-gear.jpg", href: "/watches" },
  },
  CULTURE: {
    columns: [
      { heading: "Sections", links: [["Essays", "/culture"], ["Interviews", "/culture"], ["Travel", "/culture"], ["Machines", "/culture"]] },
      { heading: "Series", links: [["The Analog Weekend", "/culture"], ["The Art of Arriving Early", "/culture"], ["MG Film", "/film"]] },
    ],
    feature: { tag: "CULTURE · 042", title: "The Art of Arriving Early", image: "/images/film-workshop.jpg", href: "/culture" },
  },
};

/** Full-width frosted mega-menu. Rendered when a nav item with a menu is
 *  hovered/focused (desktop) or tapped (touch). Parent owns the open key. */
export function MegaMenu({ activeKey, onClose }: { activeKey: string | null; onClose: () => void }) {
  if (!activeKey || !MENUS[activeKey]) return null;
  const menu = MENUS[activeKey];
  return (
    <div
      className="absolute inset-x-0 top-full border-b border-white/10 text-[#f4f4f4] motion-safe:animate-[mgMegaDrop_.3s_ease]"
      style={{ background: "rgba(11,11,12,0.6)", backdropFilter: "blur(30px) saturate(1.4)", boxShadow: "0 26px 54px rgba(0,0,0,0.42)" }}
      onMouseLeave={onClose}
    >
      <div className="container-mg flex gap-[60px] py-10">
        <div className="flex flex-1 gap-12">
          {menu.columns.map((col) => (
            <div key={col.heading} className="min-w-[150px]">
              <p className="font-mono uppercase text-[10px] tracking-[0.22em] text-mg-accent mb-4">{col.heading}</p>
              <ul className="space-y-2.5">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <Link
                      href={href}
                      onClick={onClose}
                      className="inline-block font-grotesk text-[17px] text-[rgba(244,244,244,0.6)] hover:text-white transition-[color,transform] duration-200 hover:translate-x-1"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Link href={menu.feature.href} onClick={onClose} className="group w-[340px] shrink-0">
          <div className="relative h-[172px] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={menu.feature.image} alt={menu.feature.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <span className="absolute top-3 left-3 bg-mg-accent text-white font-mono uppercase text-[9px] tracking-[0.18em] px-2 py-1">Featured</span>
          </div>
          <p className="mt-3 font-mono uppercase text-[10px] tracking-[0.22em] text-mg-accentSerif">{menu.feature.tag}</p>
          <p className="mt-1.5 font-grotesk text-[19px] leading-snug">{menu.feature.title}</p>
        </Link>
      </div>
    </div>
  );
}

export const MENU_KEYS = Object.keys(MENUS);
