import Link from "next/link";
import Image from "next/image";
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
      <section data-darkband className="relative h-[560px] bg-[#0d0d0d] text-white overflow-hidden">
        {image && <Image src={image} alt="" fill sizes="100vw" className="object-cover" />}
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(90deg,rgba(10,10,11,0.85),transparent 60%)" }} />
        {/* Caption: anchored to the content gutter, 48px up, and padded 32px
            top/bottom inside itself ('No panel' zeroes the panel's left pad). */}
        <div className="absolute bottom-12 left-5 right-5 pl-0 pr-6 py-6 leading-[normal] pointer-events-none min-[681px]:left-[max(48px,calc((100%-1320px)/2))] min-[681px]:right-auto min-[681px]:max-w-[440px] min-[681px]:pr-[38px] min-[681px]:py-8">
          {eyebrow && <Eyebrow className="block mb-2 !text-[18px] !leading-[normal]">{eyebrow}</Eyebrow>}
          <Link href={cta?.href ?? "#"} className="inline-block text-inherit pointer-events-auto">
            <h2 className="font-grotesk font-medium text-3xl leading-[1.05] min-[681px]:text-[36px] tracking-[-0.03em]">{headline}</h2>
          </Link>
          {cta && (
            <Link href={cta.href} className="mt-4 inline-block pointer-events-auto font-mono text-[10.5px] tracking-[0.22em] text-white/75 transition-colors hover:text-mg-accentSerif">
              {cta.label}
            </Link>
          )}
        </div>
      </section>
    );
  }

  const imgFirst = variant === "imageLeft";
  return (
    <section className="container-mg py-16 md:py-24">
      <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
        <div className={clsx("relative aspect-[4/3] overflow-hidden bg-mg-surface", imgFirst ? "md:order-1" : "md:order-2")}>
          {image && (
            <Image
              src={image}
              alt={headline}
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
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
