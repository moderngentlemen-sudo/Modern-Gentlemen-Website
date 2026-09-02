import Link from "next/link";

import { MediaImage } from "../ui/MediaImage";

export const HERO_STUDIO_VARIANTS = [
  "editorialSplit",
  "fullBleedCover",
  "typeMasthead",
  "triptych",
] as const;

export type HeroStudioVariant = (typeof HERO_STUDIO_VARIANTS)[number];

interface HeroImage {
  image: string;
  alt?: string;
}

interface HeroLink {
  label: string;
  href: string;
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
  primaryCta?: HeroLink;
  secondaryCta?: HeroLink;
  imagePosition?: "left" | "right";
  align?: "left" | "center" | "right";
  height?: "compact" | "tall" | "screen";
  titleSize?: "compact" | "standard" | "display";
  overlay?: "light" | "medium" | "strong";
  tone?: "dark" | "light" | "accent";
}

const moduleNumber: Record<HeroStudioVariant, string> = {
  editorialSplit: "01",
  fullBleedCover: "69",
  typeMasthead: "70",
  triptych: "71",
};

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
 * First native family from the numbered Section Library. One schema recreates
 * modules 01, 69, 70 and 71 while keeping content, media and presentation
 * independent. The original one-off sections remain registered unchanged.
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
  const marker = moduleNumber[variant];

  if (variant === "fullBleedCover") {
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

  if (variant === "typeMasthead") {
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

  if (variant === "triptych") {
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
