import Link from "next/link";

import {
  heroStudioPreset,
  type HeroStudioLayout,
  type HeroStudioVariant,
} from "@/lib/blocks/heroStudioPresets";
import { MediaImage } from "../ui/MediaImage";

export { HERO_STUDIO_VARIANTS } from "@/lib/blocks/heroStudioPresets";
export type { HeroStudioVariant } from "@/lib/blocks/heroStudioPresets";

interface HeroImage {
  image: string;
  alt?: string;
}

interface HeroLink {
  label: string;
  href: string;
}

interface HeroHighlight {
  label: string;
  value?: string;
  href?: string;
}

interface Props {
  variant?: HeroStudioVariant;
  eyebrow?: string;
  headline: string;
  accent?: string;
  body?: string;
  image?: string;
  imageAlt?: string;
  images?: HeroImage[];
  highlights?: HeroHighlight[];
  primaryCta?: HeroLink;
  secondaryCta?: HeroLink;
  imagePosition?: "left" | "right";
  align?: "left" | "center" | "right";
  height?: "compact" | "tall" | "screen";
  titleSize?: "compact" | "standard" | "display";
  overlay?: "light" | "medium" | "strong";
  tone?: "dark" | "light" | "accent";
}

const titleClass = {
  compact: "text-[38px] min-[681px]:text-[52px]",
  standard: "text-[46px] min-[681px]:text-[68px]",
  display: "text-[54px] min-[681px]:text-[88px] min-[1100px]:text-[108px]",
} as const;

const heightClass = {
  compact: "min-h-[460px]",
  tall: "min-h-[620px]",
  screen: "min-h-[calc(100svh-var(--header-height))]",
} as const;

const toneClass = {
  dark: "bg-[#0d0d0d] text-[#f4f4f4]",
  light: "bg-mg-bg text-mg-fg",
  accent: "bg-mg-accent text-white",
} as const;

const alignClass = {
  left: "text-left items-start",
  center: "text-center items-center",
  right: "text-right items-end",
} as const;

/**
 * Native family for the standard heroes in the numbered Section Library.
 * Shared structural archetypes preserve all 48 named source compositions while
 * content, media and presentation stay independent. Existing one-off sections
 * remain registered unchanged.
 */
export function HeroStudio({
  variant = "editorialSplit",
  eyebrow,
  headline,
  accent,
  body,
  image,
  imageAlt = "",
  images = [],
  highlights = [],
  primaryCta,
  secondaryCta,
  imagePosition = "right",
  align = "left",
  height = "tall",
  titleSize = "standard",
  overlay = "medium",
  tone = "dark",
}: Props) {
  const common = { eyebrow, headline, accent, body, primaryCta, secondaryCta, align, titleSize };
  const preset = heroStudioPreset(variant);
  const marker = preset.module;
  const layout = preset.layout;

  if (layout === "cover") {
    return (
      <section
        data-darkband={image || tone !== "light" || undefined}
        data-library-module={marker}
        data-hero-studio={variant}
        className={`relative isolate overflow-hidden ${heightClass[height]} ${toneClass[tone]}`}
      >
        {image && (
          <MediaImage
            src={image}
            alt={imageAlt}
            slot="fullBleed"
            priority
            className="object-cover"
          />
        )}
        <div aria-hidden className={`absolute inset-0 ${coverOverlay(overlay)}`} />
        <div className="container-mg absolute inset-x-0 bottom-0 z-10 pb-12 min-[681px]:pb-16">
          <HeroCopy {...common} inverse={Boolean(image) || tone !== "light"} />
        </div>
      </section>
    );
  }

  if (layout === "masthead") {
    return (
      <section
        data-darkband={tone !== "light" || undefined}
        data-library-module={marker}
        data-hero-studio={variant}
        className={`${toneClass[tone]} border-y border-current/10`}
      >
        <div
          className={`container-mg flex flex-col justify-center py-20 min-[681px]:py-28 ${alignClass[align]}`}
        >
          <HeroCopy {...common} inverse={tone !== "light"} />
        </div>
        {image && (
          <div className="relative aspect-[21/7] min-h-48 overflow-hidden">
            <MediaImage src={image} alt={imageAlt} slot="fullBleed" className="object-cover" />
          </div>
        )}
      </section>
    );
  }

  if (layout === "triptych") {
    const triptych = (images.length ? images : image ? [{ image, alt: imageAlt }] : []).slice(0, 3);
    return (
      <section
        data-darkband={tone !== "light" || undefined}
        data-library-module={marker}
        data-hero-studio={variant}
        className={`overflow-hidden py-14 min-[681px]:py-20 ${toneClass[tone]}`}
      >
        <div className="container-mg">
          <HeroCopy {...common} inverse={tone !== "light"} />
          <div className="mt-10 grid grid-cols-2 gap-3 min-[681px]:grid-cols-3 min-[681px]:gap-5">
            {triptych.map((item, index) => (
              <div
                key={`${item.image}-${index}`}
                className={`relative overflow-hidden bg-black/10 ${
                  index === 0
                    ? "col-span-2 aspect-[16/10] min-[681px]:col-span-1 min-[681px]:aspect-[3/4]"
                    : "aspect-[3/4]"
                }`}
              >
                <MediaImage
                  src={item.image}
                  alt={item.alt ?? ""}
                  slot="half"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (layout !== "split") {
    return (
      <HeroComposition
        variant={variant}
        layout={layout}
        marker={marker}
        presetLabel={preset.label}
        common={common}
        image={image}
        imageAlt={imageAlt}
        images={images}
        highlights={highlights}
        height={height}
        overlay={overlay}
        tone={tone}
      />
    );
  }

  const mediaFirst = imagePosition === "left";
  return (
    <section
      data-darkband={tone !== "light" || undefined}
      data-library-module={marker}
      data-hero-studio={variant}
      className={toneClass[tone]}
    >
      <div className={`grid ${heightClass[height]} min-[821px]:grid-cols-2`}>
        <div
          className={`flex flex-col justify-center px-[var(--layout-mobile-gutter)] py-14 min-[681px]:px-[var(--layout-desktop-gutter)] min-[821px]:px-[max(var(--layout-desktop-gutter),calc((100vw-var(--layout-content-width))/2))] ${
            mediaFirst ? "min-[821px]:order-2" : ""
          } ${alignClass[align]}`}
        >
          <HeroCopy {...common} inverse={tone !== "light"} />
        </div>
        <div
          className={`relative min-h-[360px] overflow-hidden bg-black/10 ${
            mediaFirst ? "min-[821px]:order-1" : ""
          }`}
        >
          {image && (
            <MediaImage src={image} alt={imageAlt} slot="half" priority className="object-cover" />
          )}
        </div>
      </div>
    </section>
  );
}

const galleryLayouts: HeroStudioLayout[] = [
  "collage",
  "centerfold",
  "portrait",
  "duplex",
  "versus",
  "wall",
  "filmstrip",
];

const listLayouts: HeroStudioLayout[] = ["rail", "index", "board", "feed", "cards", "live"];

function HeroComposition({
  variant,
  layout,
  marker,
  presetLabel,
  common,
  image,
  imageAlt,
  images,
  highlights,
  height,
  overlay,
  tone,
}: {
  variant: HeroStudioVariant;
  layout: HeroStudioLayout;
  marker: string;
  presetLabel: string;
  common: Pick<
    Props,
    | "eyebrow"
    | "headline"
    | "accent"
    | "body"
    | "primaryCta"
    | "secondaryCta"
    | "align"
    | "titleSize"
  >;
  image?: string;
  imageAlt: string;
  images: HeroImage[];
  highlights: HeroHighlight[];
  height: NonNullable<Props["height"]>;
  overlay: NonNullable<Props["overlay"]>;
  tone: NonNullable<Props["tone"]>;
}) {
  const media = (images.length ? images : image ? [{ image, alt: imageAlt }] : []).slice(0, 6);
  const entries = (
    highlights.length
      ? highlights
      : [
          { value: "01", label: "The lead story" },
          { value: "02", label: "Editor's selection" },
          { value: "03", label: "The essential detail" },
        ]
  ).slice(0, 8);
  const inverse = tone !== "light";

  return (
    <section
      data-darkband={inverse || undefined}
      data-library-module={marker}
      data-hero-studio={variant}
      data-hero-layout={layout}
      className={`relative isolate overflow-hidden ${toneClass[tone]}`}
    >
      {layout === "field" && <div aria-hidden className="absolute inset-0 bg-mg-accent" />}
      {layout === "diagonal" && image && (
        <div className="absolute inset-y-0 right-0 w-[64%] skew-x-[-8deg] overflow-hidden origin-bottom">
          <div className="relative h-full w-full skew-x-[8deg] scale-110">
            <MediaImage
              src={image}
              alt={imageAlt}
              slot="fullBleed"
              priority
              className="object-cover"
            />
            <div aria-hidden className={`absolute inset-0 ${coverOverlay(overlay)}`} />
          </div>
        </div>
      )}

      <div className={`container-mg relative z-10 py-14 min-[681px]:py-20 ${heightClass[height]}`}>
        {layout === "ticker" && <Ticker entries={entries} />}

        <div
          className={`grid h-full items-center gap-10 ${
            listLayouts.includes(layout)
              ? "min-[821px]:grid-cols-[minmax(0,1fr)_minmax(280px,0.58fr)]"
              : layout === "ledger"
                ? "min-[821px]:grid-cols-[0.7fr_1.3fr]"
                : ""
          }`}
        >
          <div className={layout === "seal" ? "mx-auto max-w-[760px] text-center" : ""}>
            {layout === "seal" && (
              <div className="mx-auto mb-8 grid size-24 place-items-center rounded-full border border-current/35 font-serif text-[34px] italic">
                MG
              </div>
            )}
            {layout === "countdown" && (
              <p
                className="mb-6 font-mono text-[clamp(34px,8vw,96px)] tracking-[-0.08em]"
                aria-label="Countdown display"
              >
                00:00:00
              </p>
            )}
            {layout === "cinema" && (
              <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.24em] text-mg-accentSerif">
                Now screening
              </p>
            )}
            {layout === "quote" && (
              <span aria-hidden className="font-serif text-[84px] leading-none text-mg-accentSerif">
                “
              </span>
            )}
            {layout === "broadsheet" && (
              <div className="mb-7 flex items-center justify-between border-y border-current/25 py-3 font-mono text-[9px] uppercase tracking-[0.2em]">
                <span>{presetLabel}</span>
                <span>Vol. {marker}</span>
              </div>
            )}
            <HeroCopy {...common} inverse={inverse} />
          </div>

          {listLayouts.includes(layout) && <HighlightList entries={entries} layout={layout} />}

          {layout === "ledger" && (
            <div className="border-y border-current/25">
              <HighlightList entries={entries} layout={layout} />
            </div>
          )}
        </div>

        {layout === "cinema" && media[0] && (
          <div className="relative mt-10 aspect-[21/9] min-h-56 overflow-hidden border border-white/15">
            <MediaImage
              src={media[0].image}
              alt={media[0].alt ?? ""}
              slot="fullBleed"
              className="object-cover"
            />
            <div aria-hidden className={`absolute inset-0 ${coverOverlay(overlay)}`} />
            <span className="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/70 text-white">
              ▶
            </span>
          </div>
        )}

        {galleryLayouts.includes(layout) && media.length > 0 && (
          <MediaGallery media={media} layout={layout} />
        )}

        {layout === "framed" && media[0] && (
          <div className="relative mx-auto mt-10 aspect-[16/8] max-w-[1100px] border-[12px] border-current/10 p-2">
            <div className="relative h-full overflow-hidden">
              <MediaImage
                src={media[0].image}
                alt={media[0].alt ?? ""}
                slot="fullBleed"
                className="object-cover"
              />
            </div>
          </div>
        )}

        {layout === "countdown" && media[0] && (
          <div className="relative mt-10 aspect-[16/7] overflow-hidden">
            <MediaImage
              src={media[0].image}
              alt={media[0].alt ?? ""}
              slot="fullBleed"
              className="object-cover"
            />
          </div>
        )}

        {layout === "minimal" && <div aria-hidden className="mt-14 h-px w-full bg-current/20" />}
        {layout === "ticker" && <Ticker entries={entries} reverse />}
      </div>
    </section>
  );
}

function HighlightList({
  entries,
  layout,
}: {
  entries: HeroHighlight[];
  layout: HeroStudioLayout;
}) {
  return (
    <ol className="divide-y divide-current/20 border-y border-current/20">
      {entries.map((entry, index) => {
        const content = (
          <span className="grid grid-cols-[44px_1fr_auto] items-baseline gap-3 py-4">
            <span className="font-mono text-[9px] text-mg-accentSerif">
              {entry.value ?? String(index + 1).padStart(2, "0")}
            </span>
            <span
              className={
                layout === "board"
                  ? "font-grotesk text-[22px] font-semibold"
                  : "font-serif text-[20px] italic"
              }
            >
              {entry.label}
            </span>
            {layout === "live" && (
              <span
                className="size-2 animate-pulse rounded-full bg-mg-accent motion-reduce:animate-none"
                aria-label="Live"
              />
            )}
          </span>
        );
        return (
          <li key={`${entry.label}-${index}`}>
            {entry.href ? <Link href={entry.href}>{content}</Link> : content}
          </li>
        );
      })}
    </ol>
  );
}

function Ticker({ entries, reverse = false }: { entries: HeroHighlight[]; reverse?: boolean }) {
  return (
    <div
      className="my-6 overflow-hidden border-y border-current/20 py-3 font-mono text-[10px] uppercase tracking-[0.22em]"
      data-direction={reverse ? "reverse" : "forward"}
    >
      <div className="flex min-w-max gap-10">
        {[...entries, ...entries].map((entry, index) => (
          <span key={`${entry.label}-${index}`}>◆ {entry.label}</span>
        ))}
      </div>
    </div>
  );
}

function MediaGallery({ media, layout }: { media: HeroImage[]; layout: HeroStudioLayout }) {
  const gridClass =
    layout === "filmstrip"
      ? "grid-cols-2 min-[681px]:grid-cols-4"
      : layout === "wall"
        ? "grid-cols-3"
        : layout === "duplex" || layout === "versus"
          ? "grid-cols-2"
          : "grid-cols-2 min-[821px]:grid-cols-3";
  return (
    <div className={`mt-10 grid gap-3 min-[681px]:gap-5 ${gridClass}`}>
      {media.map((item, index) => (
        <div
          key={`${item.image}-${index}`}
          className={`relative overflow-hidden bg-black/10 ${
            layout === "filmstrip"
              ? "aspect-[16/10]"
              : layout === "centerfold" && index === 0
                ? "col-span-2 aspect-[16/8] min-[821px]:col-span-2"
                : layout === "collage" && index === 0
                  ? "row-span-2 aspect-[3/4]"
                  : "aspect-[3/4]"
          }`}
        >
          <MediaImage src={item.image} alt={item.alt ?? ""} slot="half" className="object-cover" />
          {layout === "versus" && index < 2 && (
            <span className="absolute bottom-4 left-4 bg-black/75 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.18em] text-white">
              {index === 0 ? "A" : "B"}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function HeroCopy({
  eyebrow,
  headline,
  accent,
  body,
  primaryCta,
  secondaryCta,
  align,
  titleSize,
  inverse,
}: Pick<
  Props,
  "eyebrow" | "headline" | "accent" | "body" | "primaryCta" | "secondaryCta" | "align" | "titleSize"
> & { inverse: boolean }) {
  return (
    <div className={`flex max-w-[900px] flex-col ${alignClass[align ?? "left"]}`}>
      {eyebrow && <p className="font-serif text-[20px] italic text-mg-accentSerif">{eyebrow}</p>}
      <h1
        className={`font-grotesk font-semibold leading-[0.96] tracking-[-0.045em] text-balance ${titleClass[titleSize ?? "standard"]} ${eyebrow ? "mt-4" : ""}`}
      >
        {headline}
        {accent && <span className="text-mg-accentSerif"> {accent}</span>}
      </h1>
      {body && (
        <p
          className={`mt-6 max-w-[600px] text-[17px] font-light leading-[1.65] ${inverse ? "text-white/65" : "text-mg-fg/65"}`}
        >
          {body}
        </p>
      )}
      {(primaryCta || secondaryCta) && (
        <div className="mt-8 flex flex-wrap gap-3">
          {primaryCta && <HeroAction action={primaryCta} primary />}
          {secondaryCta && <HeroAction action={secondaryCta} />}
        </div>
      )}
    </div>
  );
}

function HeroAction({ action, primary = false }: { action: HeroLink; primary?: boolean }) {
  return (
    <Link
      href={action.href}
      className={`px-6 py-3 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors ${
        primary
          ? "bg-mg-accent text-white hover:bg-mg-accent/85"
          : "border border-current/25 hover:border-mg-accent hover:text-mg-accentSerif"
      }`}
    >
      {action.label}
    </Link>
  );
}

function coverOverlay(value: NonNullable<Props["overlay"]>): string {
  if (value === "light") return "bg-gradient-to-t from-black/45 via-black/5 to-transparent";
  if (value === "strong") return "bg-gradient-to-t from-black/90 via-black/25 to-black/10";
  return "bg-gradient-to-t from-black/75 via-black/15 to-transparent";
}
