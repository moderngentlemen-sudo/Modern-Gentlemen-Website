import { clsx } from "../ui/clsx";

interface Props {
  quote: string;
  attribution: string;
  size?: "lg" | "md";
}

/** Centered serif pull-quote with red quotation marks. `lg` = About editorial
 *  quote; `md` = Membership testimonial. */
export function PullQuote({ quote, attribution, size = "lg" }: Props) {
  return (
    <section className="py-[96px] text-center" style={{ paddingInline: "max(22px, calc((100% - 900px) / 2))" }}>
      <blockquote
        className={clsx(
          "font-serif italic text-mg-fg text-balance",
          size === "lg" ? "text-[27px] min-[681px]:text-[40px] leading-[1.24]" : "text-[28px] min-[681px]:text-[34px] leading-[1.28]"
        )}
      >
        <span className="text-mg-accent">&ldquo;</span>
        {quote}
        <span className="text-mg-accent">&rdquo;</span>
      </blockquote>
      <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-mg-fg/50">{attribution}</div>
    </section>
  );
}
