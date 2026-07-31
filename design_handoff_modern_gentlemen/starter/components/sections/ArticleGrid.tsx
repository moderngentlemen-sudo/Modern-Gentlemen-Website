import Link from "next/link";
import { RailLabel } from "../ui/RailLabel";

interface Card {
  tag: string;
  title: string;
  read: string;
  image: string;
  href: string;
}

/** Category "MORE IN {CAT}" — a 3-up article-card grid (2-up ≤1024, 1-up ≤680)
 *  with a decorative LOAD MORE control (the demo has no further pages). */
export function ArticleGrid({ label, items, loadMoreLabel = "LOAD MORE STORIES" }: { label: string; items: Card[]; loadMoreLabel?: string }) {
  return (
    <section className="container-mg pt-[52px]">
      <RailLabel className="mb-[26px]">{label}</RailLabel>
      <div className="grid grid-cols-1 gap-[20px] min-[681px]:grid-cols-2 min-[1025px]:grid-cols-3">
        {items.map((c) => (
          <Link
            key={c.href + c.title}
            href={c.href}
            className="group block overflow-hidden border border-mg-bd/[0.09] bg-mg-surface text-mg-fg"
          >
            <div className="relative h-[230px] overflow-hidden">
              <div
                aria-hidden
                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                style={{ backgroundImage: `url(${c.image})` }}
              />
            </div>
            <div className="p-[20px_22px_26px]">
              <div className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-[#ff4d5e]">{c.tag}</div>
              <h3 className="mt-[11px] font-grotesk font-medium text-[22px] leading-[1.12] tracking-[-0.02em] text-balance">{c.title}</h3>
              <div className="mt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-mg-fg/[0.42]">{c.read}</div>
            </div>
          </Link>
        ))}
      </div>
      <div className="mt-[44px] flex justify-center">
        <span className="border border-mg-bd/25 px-[34px] py-[14px] font-mono text-[10px] uppercase tracking-[0.2em] text-mg-fg/85">{loadMoreLabel}</span>
      </div>
    </section>
  );
}
