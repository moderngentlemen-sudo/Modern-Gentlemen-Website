import Link from "next/link";
import { Eyebrow, MonoLabel } from "../ui/Eyebrow";

interface Item {
  kind?: "feature" | "image" | "membership";
  kicker?: string;
  title: string;
  body?: string;
  meta?: string;
  href?: string;
  image?: string;
}
interface Props {
  heading?: string;
  eyebrow?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  variant?: "threeCol" | "featureLeft" | "mosaic" | "sixUp";
  items: Item[];
}

/** The Latest — editorial magazine grid. `sixUp` = the homepage canon (dark
 *  feature tile + image tiles with frosted captions + a red membership tile;
 *  6-col ≥1025px, 2-col ≤1024px, 1-col ≤680px). Other variants keep a plain
 *  card grid for reuse on other pages. */
export function LatestGrid({ heading = "The Latest", eyebrow, viewAllHref, viewAllLabel = "View all →", variant = "threeCol", items }: Props) {
  if (variant === "sixUp") {
    return (
      <section className="container-mg py-16 md:py-24">
        <SectionHead heading={heading} eyebrow={eyebrow} viewAllHref={viewAllHref} viewAllLabel={viewAllLabel} />
        <div className="grid grid-cols-1 min-[681px]:grid-cols-2 min-[1025px]:grid-cols-6 gap-[18px]">
          {items?.map((it, i) => <Tile key={i} item={it} />)}
        </div>
      </section>
    );
  }

  const cols = variant === "featureLeft" ? "min-[681px]:grid-cols-2" : variant === "mosaic" ? "min-[681px]:grid-cols-4" : "min-[681px]:grid-cols-3";
  return (
    <section className="container-mg py-16 md:py-24">
      <SectionHead heading={heading} eyebrow={eyebrow} viewAllHref={viewAllHref} viewAllLabel={viewAllLabel} />
      <div className={`grid grid-cols-1 ${cols} gap-8`}>
        {items?.map((it, i) => <SimpleCard key={i} item={it} />)}
      </div>
    </section>
  );
}

function SectionHead({ heading, eyebrow, viewAllHref, viewAllLabel }: { heading?: string; eyebrow?: string; viewAllHref?: string; viewAllLabel?: string }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-8">
      <div>
        {eyebrow && <Eyebrow className="block">{eyebrow}</Eyebrow>}
        <h2 className="mt-2 font-grotesk font-semibold text-3xl md:text-[42px] leading-none tracking-[-0.02em]">{heading}</h2>
      </div>
      {viewAllHref && (
        <Link href={viewAllHref} className="shrink-0 font-mono uppercase text-[11px] tracking-[0.2em] text-mg-accent whitespace-nowrap">{viewAllLabel}</Link>
      )}
    </div>
  );
}

function Tile({ item }: { item: Item }) {
  if (item.kind === "feature") {
    return (
      <article data-darkband className="flex flex-col bg-[#0d0d0d] text-[#f4f4f4] p-6 min-h-[210px]">
        {item.kicker && <MonoLabel className="!text-[#ff4d5e]">{item.kicker}</MonoLabel>}
        <div className="mt-auto pt-6">
          <h3 className="font-grotesk text-xl leading-snug text-pretty">{item.title}</h3>
          {item.body && <p className="mt-2 text-sm text-white/55 text-pretty">{item.body}</p>}
          {item.meta && <p className="mt-4 font-mono text-[10px] tracking-[0.14em] text-white/40">{item.meta}</p>}
        </div>
      </article>
    );
  }

  if (item.kind === "membership") {
    const inner = (
      <div className="flex flex-col h-full bg-mg-accent text-white p-6 min-h-[210px]">
        {item.kicker && <span className="font-mono uppercase text-[10px] tracking-[0.2em] text-white/80">{item.kicker}</span>}
        <div className="mt-auto pt-6">
          <h3 className="font-grotesk text-2xl leading-tight">{item.title}</h3>
          {item.body && <p className="mt-2 font-mono uppercase text-[10px] tracking-[0.18em] text-white/85">{item.body}</p>}
        </div>
      </div>
    );
    return item.href ? <Link href={item.href} className="block">{inner}</Link> : inner;
  }

  const inner = (
    <article className="group relative min-h-[210px] overflow-hidden bg-mg-surface">
      {item.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.image} alt={item.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      )}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#0d0d0d]/55 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4 border-t border-white/15" style={{ background: "rgba(16,16,18,0.45)", backdropFilter: "blur(18px)" }}>
        {item.kicker && <span className="block font-mono uppercase text-[10px] tracking-[0.18em] text-[#ff4d5e]">{item.kicker}</span>}
        <h3 className="mt-1 font-grotesk text-white text-[15px] leading-snug text-pretty">{item.title}</h3>
      </div>
    </article>
  );
  return item.href ? <Link href={item.href} className="block">{inner}</Link> : inner;
}

function SimpleCard({ item }: { item: Item }) {
  const inner = (
    <article className="group">
      <div className="aspect-[4/5] overflow-hidden bg-mg-surface">
        {item.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt={item.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        )}
      </div>
      {item.kicker && <MonoLabel className="block mt-4">{item.kicker}</MonoLabel>}
      <h3 className="font-grotesk text-lg mt-2 leading-snug text-pretty">{item.title}</h3>
      {item.meta && <p className="font-mono text-xs text-mg-fg/50 mt-2">{item.meta}</p>}
    </article>
  );
  return item.href ? <Link href={item.href}>{inner}</Link> : inner;
}
