import { Eyebrow } from "../ui/Eyebrow";
import { Button } from "../ui/Button";
import { clsx } from "../ui/clsx";

interface Props {
  eyebrow?: string;
  headline: string;
  body?: string;
  image?: string;
  cta?: { label: string; href: string; style?: "solid" | "outline" };
  variant?: "imageRight" | "imageLeft" | "overlap";
}

export function FeatureSplit({ eyebrow, headline, body, image, cta, variant = "imageRight" }: Props) {
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
