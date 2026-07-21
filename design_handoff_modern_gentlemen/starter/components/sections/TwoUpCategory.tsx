import Link from "next/link";
import { MonoLabel } from "../ui/Eyebrow";

interface Item {
  kicker?: string;
  title: string;
  href?: string;
  image?: string;
}

export function TwoUpCategory({ items }: { items: Item[] }) {
  return (
    <section className="container-mg py-16 md:py-24">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {items?.slice(0, 2).map((it, i) => {
          const inner = (
            <article className="group relative aspect-[3/4] overflow-hidden bg-mg-surface">
              {it.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.image} alt={it.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-0 p-8 text-white">
                {it.kicker && <MonoLabel className="block mb-2 !text-white/80">{it.kicker}</MonoLabel>}
                <h3 className="font-grotesk text-2xl md:text-3xl">{it.title}</h3>
              </div>
            </article>
          );
          return it.href ? <Link key={i} href={it.href}>{inner}</Link> : <div key={i}>{inner}</div>;
        })}
      </div>
    </section>
  );
}
