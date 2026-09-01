import Link from "next/link";
import { RailLabel } from "../ui/RailLabel";

interface Card {
  title: string;
  body: string;
  href: string;
}

/** About "What we cover" — three text link cards to the category pages; lift and
 *  redden their border on hover. Collapses to a single column ≤820px. */
export function CoverCards({ label, cards }: { label: string; cards: Card[] }) {
  return (
    <section
      className="pt-20"
      style={{
        paddingInline:
          "max(var(--layout-mobile-gutter), calc((100% - var(--layout-content-width)) / 2))",
      }}
    >
      <RailLabel className="mb-[30px]">{label}</RailLabel>
      <div className="grid grid-cols-1 gap-[20px] min-[821px]:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="mg-card block border border-mg-bd/10 bg-mg-surface p-[32px_30px] transition-[transform,border-color] duration-200 hover:-translate-y-1 hover:border-mg-accent/50"
          >
            <div className="font-grotesk font-medium text-[24px] tracking-[-0.02em]">{c.title}</div>
            <p className="mt-3 font-grotesk font-light text-[15px] leading-[1.6] text-mg-fg/60 text-pretty">
              {c.body}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
