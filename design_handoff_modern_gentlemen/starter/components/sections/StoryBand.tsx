import { Eyebrow } from "../ui/Eyebrow";
import { Button } from "../ui/Button";

interface Props {
  eyebrow?: string;
  quote: string;
  attribution?: string;
  backgroundImage?: string;
  cta?: { label: string; href: string; style?: "solid" | "outline" };
}

export function StoryBand({ eyebrow, quote, attribution, backgroundImage, cta }: Props) {
  return (
    <section
      data-darkband
      className="relative bg-[#0d0d0d] text-[#f4f4f4] py-24 md:py-36"
      style={
        backgroundImage
          ? { backgroundImage: `linear-gradient(rgba(8,8,9,0.6),rgba(8,8,9,0.6)),url(${backgroundImage})`, backgroundSize: "cover", backgroundPosition: "center" }
          : undefined
      }
    >
      <div className="container-mg max-w-3xl text-center">
        {eyebrow && <Eyebrow className="block mb-6">{eyebrow}</Eyebrow>}
        <blockquote className="font-grotesk text-3xl md:text-5xl leading-[1.15] text-balance">{quote}</blockquote>
        {attribution && <p className="mt-6 font-mono text-xs uppercase tracking-[0.2em] text-white/60">{attribution}</p>}
        {cta && (
          <div className="mt-10 flex justify-center">
            <Button href={cta.href} variant={cta.style || "outline"}>{cta.label}</Button>
          </div>
        )}
      </div>
    </section>
  );
}
