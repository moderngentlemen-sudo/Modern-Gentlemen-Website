"use client";

import Link from "next/link";

const MENUS: Record<string, { links: [string, string][]; feature: { title: string; image: string; href: string } }> = {
  STYLE: {
    links: [["The Wardrobe", "/style"], ["Tailoring", "/style"], ["Footwear", "/style"], ["Accessories", "/style"]],
    feature: { title: "The Monochrome Wardrobe, Engineered", image: "/images/style-mono.jpg", href: "/style" },
  },
  GROOMING: {
    links: [["Skin", "/grooming"], ["Hair", "/grooming"], ["Fragrance", "/grooming"], ["Tools", "/grooming"]],
    feature: { title: "The Seven-Minute Standard", image: "/images/grooming.jpg", href: "/grooming" },
  },
  WATCHES: {
    links: [["Dive", "/watches"], ["Field", "/watches"], ["Dress", "/watches"], ["Chronograph", "/watches"]],
    feature: { title: "Chronographs Born on the Grid", image: "/images/watch-gear.jpg", href: "/watches" },
  },
  CULTURE: {
    links: [["Essays", "/culture"], ["Interviews", "/culture"], ["The Analog Weekend", "/culture"]],
    feature: { title: "Inside a Coachbuilder's Workshop", image: "/images/film-workshop.jpg", href: "/culture" },
  },
};

/** Full-width frosted mega-menu. Rendered when a nav item with a menu is
 *  hovered/focused (desktop) or tapped (touch). Parent owns the open key. */
export function MegaMenu({ activeKey, onClose }: { activeKey: string | null; onClose: () => void }) {
  if (!activeKey || !MENUS[activeKey]) return null;
  const menu = MENUS[activeKey];
  return (
    <div
      className="absolute inset-x-0 top-full bg-mg-bg/90 backdrop-blur-lg border-b border-mg-bd/10"
      onMouseLeave={onClose}
    >
      <div className="container-mg py-10 grid grid-cols-[1fr_1.4fr] gap-12">
        <ul className="space-y-3">
          {menu.links.map(([label, href]) => (
            <li key={label}>
              <Link href={href} onClick={onClose} className="font-grotesk text-xl inline-block pb-1 border-b-2 border-transparent hover:border-mg-accent">{label}</Link>
            </li>
          ))}
        </ul>
        <Link href={menu.feature.href} onClick={onClose} className="group relative aspect-[16/9] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={menu.feature.image} alt={menu.feature.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <span className="absolute bottom-4 left-4 right-4 text-white font-grotesk text-lg">{menu.feature.title}</span>
        </Link>
      </div>
    </div>
  );
}

export const MENU_KEYS = Object.keys(MENUS);
