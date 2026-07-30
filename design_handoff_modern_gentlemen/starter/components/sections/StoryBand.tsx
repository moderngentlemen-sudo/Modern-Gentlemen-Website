import { Eyebrow } from "../ui/Eyebrow";
import { Button } from "../ui/Button";

interface Props {
  eyebrow?: string;
  quote: string;          // the centered statement / headline
  body?: string;          // supporting paragraph
  attribution?: string;   // optional pull-quote attribution
  backgroundImage?: string;
  cta?: { label: string; href: string; style?: "solid" | "outline" };
}

/** Centered editorial statement — an inset dark card within the 1320 column
 *  (not full-bleed), e.g. the homepage "Our Promise" band. */
export function StoryBand({ eyebrow, quote, body, attribution, backgroundImage, cta }: Props) {
  return (
    <section>
      <div className="container-mg">
        <div
          data-darkband
          className="relative overflow-hidden bg-[#0d0d0d] text-[#f4f4f4] text-center px-6 py-14 md:px-[60px] md:py-20 border border-white/12"
          style={
            backgroundImage
              ? { backgroundImage: `linear-gradient(rgba(8,8,9,0.7),rgba(8,8,9,0.7)),url(${backgroundImage})`, backgroundSize: "cover", backgroundPosition: "center" }
              : undefined
          }
        >
          {eyebrow && <Eyebrow className="block text-xl md:text-2xl mb-4">{eyebrow}</Eyebrow>}
          <h2 className="mx-auto max-w-[800px] font-grotesk font-medium text-3xl md:text-[44px] leading-[1.15] tracking-[-0.03em]">{quote}</h2>
          {body && <p className="mx-auto mt-[22px] max-w-[620px] font-light text-base leading-[1.75] text-[#f4f4f4]/55">{body}</p>}
          {attribution && <p className="mt-6 font-mono text-xs uppercase tracking-[0.2em] text-white/60">{attribution}</p>}
          {cta && (
            <div className="mt-7 flex justify-center">
              <Button href={cta.href} variant={cta.style || "outline"}>{cta.label}</Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
