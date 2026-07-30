import Link from "next/link";
import type { RelatedItem } from "@/lib/articles";
import { bgCover } from "@/lib/bgImage";

/** "KEEP READING" — a 3-up grid of related article cards (glass caption bar). */
export function RelatedGrid({ items }: { items: RelatedItem[] }) {
  return (
    <section className="mx-auto max-w-[1120px] px-6 pt-10 pb-20">
      <div className="mb-[22px] font-mono text-[10px] uppercase tracking-[0.24em] text-mg-accent">KEEP READING</div>
      <div data-gal className="grid grid-cols-3 gap-[18px]">
        {items.map((r) => (
          <Link
            key={r.href}
            data-relcard
            data-darkband
            href={r.href}
            className="relative block min-h-[230px] overflow-hidden rounded-[10px] text-white"
          >
            <div className="absolute inset-0 bg-[#0d0d0d] bg-cover bg-center" style={bgCover(r.image, 640)} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(13,13,13,0) 45%, rgba(13,13,13,0.6) 100%)" }} />
            <div
              className="absolute inset-x-0 bottom-0 border-t border-white/[0.14] p-[14px_18px]"
              style={{ background: "rgba(16,16,18,0.45)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#ff4d5e]">{r.tag}</div>
              <h3 className="mt-1.5 font-grotesk font-medium text-[19px] leading-[1.15] tracking-[-0.02em] text-white">{r.title}</h3>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
