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
    <section className="container-mg py-[72px]">
      <div className="grid grid-cols-1 min-[821px]:grid-cols-2 gap-[22px]">
        {items?.slice(0, 2).map((it, i) => {
          const img = it.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={it.image}
              alt={it.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : null;
          return (
            <article key={i} className="overflow-hidden bg-mg-surface border border-mg-bd/[0.09]">
              {it.href ? (
                <Link href={it.href} className="group block h-[300px] overflow-hidden bg-[#0d0d0d]">
                  {img}
                </Link>
              ) : (
                <div className="h-[300px] overflow-hidden bg-[#0d0d0d]">{img}</div>
              )}
              <div className="flex flex-col gap-2.5 px-[34px] py-[30px]">
                {it.kicker && (
                  <Eyebrow className="block !text-[17px] !leading-[normal] !text-mg-accent">
                    {it.kicker}
                  </Eyebrow>
                )}
                <h3 className="font-grotesk font-medium text-[28px] leading-[1.1] tracking-[-0.025em]">
                  {it.href ? (
                    <Link href={it.href} className="hover:text-mg-accent">
                      {it.title}
                    </Link>
                  ) : (
                    it.title
                  )}
                </h3>
                {it.body && (
                  <p className="font-light text-sm leading-[1.6] text-mg-muted">{it.body}</p>
                )}
                {it.href && (
                  <Link
                    href={it.href}
                    className="mt-1 inline-block font-mono uppercase text-[10.5px] leading-[normal] tracking-[0.2em] text-mg-accent"
                  >
                    Read more →
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
