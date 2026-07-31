"use client";

import Link from "next/link";

type Column = { heading: string; links: [string, string][] };
type Menu = {
  columns: Column[];
  feature: { tag: string; title: string; image: string; href: string };
};

const MENUS: Record<string, Menu> = {
  STYLE: {
    columns: [
      {
        heading: "Categories",
        links: [
          ["Tailoring", "/style"],
          ["Casualwear", "/style"],
          ["Footwear", "/style"],
          ["Accessories", "/style"],
        ],
      },
      {
        heading: "Guides",
        links: [
          ["The Capsule Wardrobe", "/style"],
          ["Fabric & Cloth", "/style"],
          ["Seasonal Edits", "/style"],
        ],
      },
    ],
    feature: {
      tag: "STYLE · 041",
      title: "Racing Green Is the New Navy",
      image: "/images/style-mono.jpg",
      href: "/style",
    },
  },
  GROOMING: {
    columns: [
      {
        heading: "Categories",
        links: [
          ["Skincare", "/grooming"],
          ["Fragrance", "/grooming"],
          ["Hair", "/grooming"],
          ["Shaving", "/grooming"],
        ],
      },
      {
        heading: "Routines",
        links: [
          ["The Seven-Minute Standard", "/grooming"],
          ["The Travel Kit", "/grooming"],
          ["Evening Reset", "/grooming"],
        ],
      },
    ],
    feature: {
      tag: "GROOMING · 039",
      title: "The Case Against 12-Step Routines",
      image: "/images/grooming.jpg",
      href: "/grooming",
    },
  },
  WATCHES: {
    columns: [
      {
        heading: "Categories",
        links: [
          ["Chronographs", "/watches"],
          ["Dress Watches", "/watches"],
          ["Dive Watches", "/watches"],
          ["Vintage", "/watches"],
        ],
      },
      {
        heading: "Collecting",
        links: [
          ["Dial Symmetry", "/watches"],
          ["Movements 101", "/watches"],
          ["The Buying Guide", "/watches"],
        ],
      },
    ],
    feature: {
      tag: "WATCHES · 040",
      title: "Chronographs Born on the Grid",
      image: "/images/watch-gear.jpg",
      href: "/watches",
    },
  },
  CULTURE: {
    columns: [
      {
        heading: "Sections",
        links: [
          ["Essays", "/culture"],
          ["Interviews", "/culture"],
          ["Travel", "/culture"],
          ["Machines", "/culture"],
        ],
      },
      {
        heading: "Series",
        links: [
          ["The Analog Weekend", "/culture"],
          ["The Art of Arriving Early", "/culture"],
          ["MG Film", "/film"],
        ],
      },
    ],
    feature: {
      tag: "CULTURE · 042",
      title: "The Art of Arriving Early",
      image: "/images/film-workshop.jpg",
      href: "/culture",
    },
  },
};

/** Full-width frosted mega-menu. Rendered when a nav item with a menu is
 *  hovered/focused (desktop) or tapped (touch). Parent owns the open key. */
export function MegaMenu({
  activeKey,
  onClose,
}: {
  activeKey: string | null;
  onClose: () => void;
}) {
  if (!activeKey || !MENUS[activeKey]) return null;
  const menu = MENUS[activeKey];
  return (
    <div
      data-mega-panel
      className="border-b border-white/10 text-[#f4f4f4] motion-safe:animate-[mgMegaDrop_.3s_ease]"
      style={{
        background: "rgba(11,11,12,0.6)",
        backdropFilter: "blur(30px) saturate(1.4)",
        WebkitBackdropFilter: "blur(30px) saturate(1.4)",
        boxShadow: "0 26px 54px rgba(0,0,0,0.42)",
      }}
      onMouseLeave={onClose}
    >
      {/* Capped-and-centred with its own inset — not `.container-mg`. The
          prototype's cap is content-box, so 1320 of content + 2×48 padding =
          1416 in border-box terms. */}
      <div className="mx-auto max-w-[1416px] flex items-start gap-[60px] px-12 pt-[38px] pb-11">
        {/* Columns are a 2-up grid, not a flex row — that's what holds the
            second column at a fixed track rather than hugging its content. */}
        <div className="flex-1 grid grid-cols-2 gap-x-12 gap-y-8">
          {menu.columns.map((col) => (
            <div key={col.heading}>
              <div className="font-mono text-[10px] leading-[normal] tracking-[0.22em] text-mg-accent mb-[18px]">
                {col.heading}
              </div>
              <div className="flex flex-col gap-3">
                {col.links.map(([label, href]) => (
                  <Link
                    key={label}
                    href={href}
                    onClick={onClose}
                    className="w-fit font-grotesk font-medium text-[17px] leading-[1.05] tracking-[-0.015em] text-[rgba(244,244,244,0.6)] transition-[color,transform] duration-[180ms] hover:text-white hover:translate-x-1"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Link
          href={menu.feature.href}
          onClick={onClose}
          className="group block w-[342px] shrink-0 overflow-hidden bg-[#161618] border border-white/10 text-white transition-[transform,border-color] duration-[220ms] ease-[cubic-bezier(.4,0,.2,1)] hover:-translate-y-[3px] hover:border-white/[0.28]"
        >
          <div
            className="relative h-[172px] bg-[#0d0d0d] bg-cover bg-center"
            style={{ backgroundImage: `url(${menu.feature.image})` }}
          >
            <span className="absolute top-3 left-[14px] bg-[rgba(200,16,46,0.9)] px-2.5 py-1 font-mono text-[9px] leading-[normal] tracking-[0.2em] text-white">
              FEATURED
            </span>
          </div>
          <div className="px-[18px] pt-4 pb-[18px]">
            <div className="font-mono text-[9.5px] leading-[normal] tracking-[0.2em] text-[#ff4d5e] mb-2">
              {menu.feature.tag}
            </div>
            <div className="font-grotesk font-medium text-[19px] leading-[1.2] tracking-[-0.02em]">
              {menu.feature.title}
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

export const MENU_KEYS = Object.keys(MENUS);
