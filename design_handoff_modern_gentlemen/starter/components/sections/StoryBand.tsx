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
      {/* ≤680 the band pulls in to a flat 16px margin (with 52/24 padding of its
          own) rather than sitting inside the section gutter. */}
      <div className="mx-4 min-[681px]:mx-[max(48px,calc((100%-1320px)/2))]">
        <div
          data-darkband
          className="relative overflow-hidden bg-[#0d0d0d] text-[#f4f4f4] text-center px-6 py-[52px] min-[681px]:px-[60px] min-[681px]:py-20 border border-mg-band"
          style={
            backgroundImage
              ? { backgroundImage: `linear-gradient(rgba(8,8,9,0.7),rgba(8,8,9,0.7)),url(${backgroundImage})`, backgroundSize: "cover", backgroundPosition: "center" }
              : undefined
          }
        >
          {eyebrow && <Eyebrow className="block !text-[24px] !leading-[normal] mb-4">{eyebrow}</Eyebrow>}
          {/* ≤680 the band's heading drops to 26px but keeps the global mobile
              section-heading leading of 1.05, not its own 1.15. */}
          <h2 className="mx-auto max-w-[800px] font-grotesk font-medium text-[26px] leading-[1.05] min-[681px]:text-[44px] min-[681px]:leading-[1.15] tracking-[-0.03em]">{quote}</h2>
          {body && <p className="mx-auto mt-[22px] max-w-[620px] font-light text-[15px] min-[681px]:text-[16px] leading-[1.75] text-[#f4f4f4]/55">{body}</p>}
          {attribution && <p className="mt-6 font-mono text-xs uppercase tracking-[0.2em] text-white/60">{attribution}</p>}
          {cta && (
            <div className="mt-7 flex justify-center leading-[normal]">
              <Button
                href={cta.href}
                variant={cta.style || "outline"}
                // Prototype metrics for this band's CTA: 11px / 0.2em, 13×30
                // padding, and a 30%-white hairline (not the full-strength rule
                // the shared outline button uses elsewhere).
                className="!px-[30px] !py-[13px] !text-[11px] !leading-[normal] !tracking-[0.2em] !border-white/30 !text-[#f4f4f4]"
              >
                {cta.label}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
