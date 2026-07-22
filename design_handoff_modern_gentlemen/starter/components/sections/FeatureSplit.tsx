import Link from "next/link";
import { Eyebrow } from "../ui/Eyebrow";
import { Button } from "../ui/Button";
import { clsx } from "../ui/clsx";

interface Props {
  eyebrow?: string;
  headline: string;
  body?: string;
  image?: string;
  cta?: { label: string; href: string; style?: "solid" | "outline" };
  variant?: "imageRight" | "imageLeft" | "overlap" | "fullBleed";
}

export function FeatureSplit({ eyebrow, headline, body, image, cta, variant = "imageRight" }: Props) {
  // Full-bleed image band with an overlaid, left-anchored caption (homepage
  // "Style Feature"). Edge-to-edge; only the caption sits in the 1320 column.
  if (variant === "fullBleed") {
    return (
      <section data-darkband className="relative h-[420px] md:h-[560px] bg-[#0d0d0d] text-[#f4f4f4] overflow-hidden">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(90deg,rgba(10,10,11,0.85),transparent 60%)" }} />
        <div className="container-mg absolute inset-x-0 bottom-0 pb-12">
          <div className="max-w-xl">
            {eyebrow && <Eyebrow className="block">{eyebrow}</Eyebrow>}
            <h2 className="mt-2 font-grotesk font-medium text-3xl md:text-[36px] leading-[1.1] text-balance">{headline}</h2>
            {cta && (
              <Link href={cta.href} className="mt-4 inline-flex items-center font-mono uppercase text-[11px] tracking-[0.2em] text-white/90 hover:text-mg-accentSerif transition-colors">
                {cta.label}
              </Link>
            )}
          </div>
        </div>
      </section>
    );
  }

  const imgFirst = variant === "imageLeft";
  return (
    <section className="container-mg py-16 md:py-24">
      <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
        <div className={clsx("aspect-[4/3] overflow-hidden bg-mg-surface", imgFirst ? "md:order-1" : "md:order-2")}>
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={headline} className="h-full w-full object-cover" />
          )}
        </div>
        <div className={imgFirst ? "md:order-2" : "md:order-1"}>
          {eyebrow && <Eyebrow className="block mb-4">{eyebrow}</Eyebrow>}
          <h2 className="font-grotesk font-semibold text-3xl md:text-5xl leading-[1.05] text-balance">{headline}</h2>
          {body && <p className="mt-6 text-mg-fg/70 text-pretty max-w-md">{body}</p>}
          {cta && (
            <div className="mt-8">
              <Button href={cta.href} variant={cta.style || "outline"}>{cta.label}</Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
