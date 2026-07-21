import Link from "next/link";
import { MonoLabel } from "../ui/Eyebrow";

interface Item {
  kicker?: string;
  title: string;
  href?: string;
  meta?: string;
  image?: string;
}
interface Props {
  heading?: string;
  variant?: "threeCol" | "featureLeft" | "mosaic";
  items: Item[];
}

export function LatestGrid({ heading = "The Latest", variant = "threeCol", items }: Props) {
  const cols = variant === "threeCol" ? "md:grid-cols-3" : variant === "featureLeft" ? "md:grid-cols-2" : "md:grid-cols-4";
  return (
    <section className="container-mg py-16 md:py-24">
      <h2 className="font-grotesk text-2xl md:text-3xl mb-8">{heading}</h2>
      <div className={`grid grid-cols-1 ${cols} gap-8`}>
        {items?.map((it, i) => (
          <Card key={i} item={it} />
        ))}
      </div>
    </section>
  );
}

function Card({ item }: { item: Item }) {
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
