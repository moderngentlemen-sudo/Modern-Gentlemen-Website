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
      <section className="container-mg pt-20 pb-11">
        <SectionHead heading={heading} eyebrow={eyebrow} viewAllHref={viewAllHref} viewAllLabel={viewAllLabel} />
        <div className="grid grid-cols-1 min-[681px]:grid-cols-2 min-[1025px]:grid-cols-6 gap-[18px] min-[1025px]:gap-[14px]">
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
    <div className="flex items-baseline justify-between gap-4 mb-[22px]">
      <div>
        {eyebrow && <Eyebrow className="block !text-[20px] !leading-[normal] !text-mg-muted">{eyebrow}</Eyebrow>}
        <h2 className="mt-1 font-grotesk font-semibold text-3xl leading-[1.05] min-[681px]:text-[42px] min-[681px]:leading-none tracking-[-0.035em]">{heading}</h2>
      </div>
      {viewAllHref && (
        <Link href={viewAllHref} className="shrink-0 font-mono uppercase text-[11px] tracking-[0.18em] text-mg-accent whitespace-nowrap">{viewAllLabel}</Link>
      )}
    </div>
  );
}

/** Grid-item shells.
 *
 *  The min-height lives on the *item* (not the inner card) and the item is a
 *  flex box, so a tall card grows its row instead of being pinned to `h-full`
 *  of an already-resolved height.
 *
 *  The prototype's tiles are `content-box`, so its `min-height: 210px` (150px
 *  once 6-up) is 210px of CONTENT — padding and border sit outside it. These
 *  border-box equivalents add each tile's own chrome back on: the padded cards
 *  carry 2×28px padding (and the dark one a 1px rule), the image tiles carry
 *  neither. */
const TILE_PADDED = "flex min-h-[266px] min-[1025px]:min-h-[206px]";        // 210/150 + 56
const TILE_PADDED_RULED = "flex min-h-[268px] min-[1025px]:min-h-[208px]";  // 210/150 + 56 + 2
const TILE_PLAIN = "flex min-h-[210px] min-[1025px]:min-h-[150px]";         // 210/150 flat

function Tile({ item }: { item: Item }) {
  if (item.kind === "feature") {
    const inner = (
      <article data-darkband className="flex w-full flex-col justify-between bg-[#0d0d0d] text-[#f4f4f4] border border-white/10 px-[30px] py-7 transition-transform duration-200 hover:-translate-y-[3px]">
        {item.kicker && <span className="font-mono uppercase text-[10px] leading-[normal] tracking-[0.2em] text-mg-accent">{item.kicker}</span>}
        <h3 className="font-grotesk font-medium text-[30px] leading-[1.06] tracking-[-0.03em]">{item.title}</h3>
        {item.body && <p className="font-light text-sm leading-[1.5] text-[#f4f4f4]/55">{item.body}</p>}
        {item.meta && <span className="font-mono uppercase text-[10px] leading-[normal] tracking-[0.16em] text-[#f4f4f4]/40">{item.meta}</span>}
      </article>
    );
    return item.href ? <Link href={item.href} className={TILE_PADDED_RULED}>{inner}</Link> : inner;
  }

  if (item.kind === "membership") {
    const inner = (
      <div className="flex w-full flex-col justify-between bg-mg-accent text-white px-[30px] py-7 transition-transform duration-200 hover:-translate-y-[3px]">
        {item.kicker && <span className="font-mono uppercase text-[10px] leading-[normal] tracking-[0.2em] text-white/80">{item.kicker}</span>}
        <h3 className="font-grotesk font-medium text-[26px] leading-[1.08] tracking-[-0.025em]">{item.title}</h3>
        {item.body && <span className="font-mono uppercase text-[10px] leading-[normal] tracking-[0.16em] text-white/75">{item.body}</span>}
      </div>
    );
    return item.href ? <Link href={item.href} className={TILE_PADDED}>{inner}</Link> : inner;
  }

  const inner = (
    <article className="group relative w-full overflow-hidden bg-mg-surface transition-transform duration-200 hover:-translate-y-[3px]">
      {item.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.image} alt={item.title} className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(180deg,rgba(13,13,13,0) 45%,rgba(13,13,13,0.35) 100%)" }} />
      <div className="absolute inset-x-0 bottom-0 px-[18px] py-[14px] border-t border-white/15" style={{ background: "rgba(16,16,18,0.45)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}>
        {item.kicker && <span className="block font-mono uppercase text-[10px] leading-[normal] tracking-[0.2em] text-[#ff4d5e]">{item.kicker}</span>}
        <h3 className="mt-1.5 font-grotesk font-medium text-white text-[19px] leading-[1.15] tracking-[-0.02em]">{item.title}</h3>
      </div>
    </article>
  );
  return item.href ? <Link href={item.href} className={TILE_PLAIN}>{inner}</Link> : inner;
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
