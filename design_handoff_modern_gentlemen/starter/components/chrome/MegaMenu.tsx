"use client";

import Link from "next/link";
import { navColumns, type NavLink } from "@/lib/domain/navigation";

/** Full-width frosted mega-menu. Rendered when a nav item with a menu is
 *  hovered/focused (desktop) or tapped (touch). Parent owns the open key.
 *
 *  The columns and the feature card are the active entry's own data now — its
 *  children grouped by `options.group`, and `options.feature` — rather than the
 *  `MENUS` constant that used to live here. Same markup, different source; the
 *  content moved to `lib/demo/navigation.ts` as seed input. */
export function MegaMenu({ entry, onClose }: { entry: NavLink | null; onClose: () => void }) {
  if (!entry || entry.children.length === 0) return null;
  const columns = navColumns(entry.children);
  const feature = entry.feature;
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
          {columns.map((col) => (
            <div key={col.heading ?? "ungrouped"}>
              <div className="font-mono text-[10px] leading-[normal] tracking-[0.22em] text-mg-accent mb-[18px]">
                {col.heading}
              </div>
              <div className="flex flex-col gap-3">
                {col.items.map((link) => (
                  <Link
                    key={link.id}
                    href={link.href}
                    onClick={onClose}
                    className="w-fit font-grotesk font-medium text-[17px] leading-[1.05] tracking-[-0.015em] text-[rgba(244,244,244,0.6)] transition-[color,transform] duration-[180ms] hover:text-white hover:translate-x-1"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {feature && (
          <Link
            href={feature.href}
            onClick={onClose}
            className="group block w-[342px] shrink-0 overflow-hidden bg-[#161618] border border-white/10 text-white transition-[transform,border-color] duration-[220ms] ease-[cubic-bezier(.4,0,.2,1)] hover:-translate-y-[3px] hover:border-white/[0.28]"
          >
            <div
              className="relative h-[172px] bg-[#0d0d0d] bg-cover bg-center"
              style={{ backgroundImage: `url(${feature.image})` }}
            >
              <span className="absolute top-3 left-[14px] bg-[rgba(200,16,46,0.9)] px-2.5 py-1 font-mono text-[9px] leading-[normal] tracking-[0.2em] text-white">
                FEATURED
              </span>
            </div>
            <div className="px-[18px] pt-4 pb-[18px]">
              <div className="font-mono text-[9.5px] leading-[normal] tracking-[0.2em] text-[#ff4d5e] mb-2">
                {feature.tag}
              </div>
              <div className="font-grotesk font-medium text-[19px] leading-[1.2] tracking-[-0.02em]">
                {feature.title}
              </div>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
