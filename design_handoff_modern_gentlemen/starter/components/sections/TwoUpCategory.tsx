import Link from "next/link";
import { Eyebrow } from "../ui/Eyebrow";

interface Item {
  kicker?: string;
  title: string;
  body?: string;
  href?: string;
  image?: string;
}

/** Two-up category features: image on top, editorial body below. Collapses to
 *  a single column ≤820px. */
export function TwoUpCategory({ items }: { items: Item[] }) {
  return (
    <section className="container-mg py-16 md:py-24">
      <div className="grid grid-cols-1 min-[821px]:grid-cols-2 gap-x-[22px] gap-y-12">
        {items?.slice(0, 2).map((it, i) => {
          const img = it.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={it.image} alt={it.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : null;
          return (
            <article key={i}>
              {it.href ? (
                <Link href={it.href} className="group block h-[300px] overflow-hidden bg-mg-surface">{img}</Link>
              ) : (
                <div className="h-[300px] overflow-hidden bg-mg-surface">{img}</div>
              )}
              <div className="mt-5">
                {it.kicker && <Eyebrow className="block">{it.kicker}</Eyebrow>}
                <h3 className="mt-2 font-grotesk text-2xl md:text-[26px] leading-snug text-balance">
                  {it.href ? <Link href={it.href} className="hover:text-mg-accent">{it.title}</Link> : it.title}
                </h3>
                {it.body && <p className="mt-3 max-w-md text-mg-fg/70 text-pretty">{it.body}</p>}
                {it.href && (
                  <Link href={it.href} className="mt-4 inline-block font-mono uppercase text-[11px] tracking-[0.2em] text-mg-accent">Read more →</Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
