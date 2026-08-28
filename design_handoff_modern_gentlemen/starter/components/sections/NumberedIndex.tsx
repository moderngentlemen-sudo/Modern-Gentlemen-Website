import Link from "next/link";
import { MonoLabel } from "../ui/Eyebrow";

interface Item {
  num?: string;
  title: string;
  meta?: string;
  href?: string;
}

/** The Index — numbered editorial list (library #03, #21 Start Here, #19 Briefing). */
export function NumberedIndex({ heading, items }: { heading?: string; items: Item[] }) {
  return (
    <section className="container-mg py-16 md:py-24">
      {heading && <h2 className="font-grotesk text-2xl md:text-3xl mb-8">{heading}</h2>}
      <ol>
        {items?.map((it, i) => {
          const row = (
            <div className="grid grid-cols-[auto_1fr_auto] items-baseline gap-6 py-5 border-b border-mg-bd/12 group">
              <span className="font-mono text-sm text-mg-accentInk">
                {it.num ?? String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-grotesk text-lg md:text-xl group-hover:text-mg-accentInk">
                {it.title}
              </span>
              {it.meta && <MonoLabel className="!text-mg-fg/60">{it.meta}</MonoLabel>}
            </div>
          );
          return <li key={i}>{it.href ? <Link href={it.href}>{row}</Link> : row}</li>;
        })}
      </ol>
    </section>
  );
}
