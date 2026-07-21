import { Eyebrow } from "../ui/Eyebrow";
import { Button } from "../ui/Button";

interface Props {
  eyebrow?: string;
  headline: string;
  sub?: string;
  media?: { kind?: "image" | "video"; image?: string; videoUrl?: string };
  cta?: { label: string; href: string; style?: "solid" | "outline" };
  mobileHeight?: "auto" | "tall" | "fullscreen";
}

/**
 * Hero — Cover Star. GQ-style split: dark left panel meets cover media on the
 * right at a 1px divider, with an overlapping lower-left headline block.
 * (Prototype detail: video autoplay must be set imperatively — see below.)
 */
export function HeroCoverStar({ eyebrow, headline, sub, media, cta, mobileHeight = "tall" }: Props) {
  const h = mobileHeight === "fullscreen" ? "min-h-[100svh]" : mobileHeight === "tall" ? "min-h-[640px]" : "";
  return (
    <section data-darkband className="relative bg-[#0d0d0d] text-[#f4f4f4]">
      <div className={`grid md:grid-cols-[46%_54%] ${h} md:min-h-[640px]`}>
        {/* Left dark panel */}
        <div className="relative flex items-end p-8 md:p-14 border-r border-white/10">
          <div className="max-w-lg">
            {eyebrow && <Eyebrow className="block mb-4">{eyebrow}</Eyebrow>}
            <h1 className="font-grotesk font-semibold text-4xl md:text-6xl leading-[1.02] text-balance">{headline}</h1>
            {sub && <p className="mt-5 text-white/70 text-pretty max-w-md">{sub}</p>}
            {cta && (
              <div className="mt-8">
                <Button href={cta.href} variant={cta.style || "solid"}>{cta.label}</Button>
              </div>
            )}
          </div>
        </div>
        {/* Right media */}
        <div className="relative min-h-[320px] md:min-h-full">
          {media?.kind === "video" && media.videoUrl ? (
            // For self-hosted files, set el.muted=true then play() via ref
            // (React `muted` prop is unreliable). YouTube needs an iframe embed.
            <video
              className="absolute inset-0 h-full w-full object-cover"
              src={media.videoUrl}
              autoPlay
              loop
              muted
              playsInline
            />
          ) : media?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media.image} alt={headline} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-white/5" />
          )}
        </div>
      </div>
    </section>
  );
}
