import Link from "next/link";
import { RailLabel } from "../ui/RailLabel";

interface LeadArticle {
  kicker: string;   // e.g. "STYLE · 041"
  title: string;
  dek?: string;
  author?: string;
  read?: string;
  image: string;
  href: string;
}

/** Category "THE LEAD" — one large featured-article card (cover image meeting
 *  an editorial column). The whole card links to the article; image zooms on
 *  hover. Collapses to a single column ≤680px. */
export function FeaturedLead({ label = "THE LEAD", article }: { label?: string; article: LeadArticle }) {
  return (
    <section className="container-mg pt-[64px]">
      <RailLabel className="mb-[26px]">{label}</RailLabel>
      <Link
        href={article.href}
        className="group grid grid-cols-1 min-[681px]:grid-cols-[1.15fr_1fr] overflow-hidden rounded-[12px] border border-mg-bd/10 bg-mg-surface text-mg-fg"
      >
        <div className="relative min-h-[280px] min-[681px]:min-h-[420px] overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
            style={{ backgroundImage: `url(${article.image})` }}
          />
        </div>
        <div className="flex flex-col justify-center p-[44px_46px]">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#ff4d5e]">{article.kicker}</div>
          <h2 className="mt-4 font-grotesk font-semibold text-[40px] leading-[1.02] tracking-[-0.035em] text-balance">{article.title}</h2>
          {article.dek && <p className="mt-[18px] font-grotesk font-light text-[16px] leading-[1.6] text-mg-fg/[0.66] text-pretty">{article.dek}</p>}
          {(article.author || article.read) && (
            <div className="mt-[26px] font-mono text-[10px] uppercase tracking-[0.18em] text-mg-fg/50">
              WORDS · {article.author}&nbsp;·&nbsp;{article.read}
            </div>
          )}
        </div>
      </Link>
    </section>
  );
}
