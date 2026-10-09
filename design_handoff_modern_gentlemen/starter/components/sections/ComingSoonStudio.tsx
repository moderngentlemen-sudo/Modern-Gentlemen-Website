import type { CSSProperties } from "react";

import type { AfterHoursConfig } from "@/lib/blocks/afterHours";
import { libraryFontStack } from "@/lib/domain/fontLibrary";
import { FontStylesheet } from "../ui/FontStylesheet";
import { AfterHoursLanding } from "./AfterHoursLanding";
import { ReelLanding } from "./ReelLanding";
import {
  isReelDesign,
  reelConfigWithLaunchDate,
  type ReelConfig,
} from "@/lib/blocks/comingSoonReel";
import Link from "next/link";
import { COMING_SOON_DESIGNS } from "@/lib/blocks/comingSoon";
import { studyHref } from "@/lib/blocks/sectionStudies";
import { MediaImage } from "../ui/MediaImage";
import { StudySignup } from "./StudySignup";
import styles from "./ComingSoonStudio.module.css";

type FontRole = "heading" | "editorial" | "body" | "label";
const FONT_ROLES: readonly FontRole[] = ["heading", "editorial", "body", "label"];

export interface ComingSoonProps {
  variant?: string;
  /** Per-page font roles; each unset role keeps the site theme's font. */
  fonts?: Partial<Record<FontRole, string>>;
  afterHours?: AfterHoursConfig;
  reel?: ReelConfig;
  socialLinks?: { network: string; label: string; href: string }[];
  brand?: string;
  eyebrow?: string;
  title?: string;
  intro?: string;
  image?: string;
  imageAlt?: string;
  images?: { image: string; alt?: string }[];
  details?: { title: string; text?: string }[];
  signature?: string;
  cta?: { label: string; href: string };
  showSignup?: boolean;
  buttonLabel?: string;
  tone?: "preset" | "light" | "dark" | "accent";
  mobileOrder?: "textFirst" | "imageFirst";
  imagePosition?: "center" | "top" | "bottom";
  height?: "screen" | "content";
}
/**
 * Every design reads the theme's font roles (`--font-heading`, …), so one
 * override on a wrapper re-fonts all thirty-five of them, After Hours included.
 * The wrapper is `display: contents` (no box, no layout change) and is only
 * rendered when a font is actually set, so an untouched page keeps its DOM.
 */
export function ComingSoonStudio({ fonts, ...props }: ComingSoonProps) {
  const chosen = FONT_ROLES.flatMap((role) => {
    const stack = libraryFontStack(fonts?.[role]);
    return stack ? [[role, fonts![role]!, stack] as const] : [];
  });
  if (chosen.length === 0) return <ComingSoonDesign {...props} />;
  const vars = Object.fromEntries(
    chosen.map(([role, , stack]) => [`--font-${role}`, stack])
  ) as CSSProperties;
  return (
    <div data-coming-soon-fonts="" style={{ ...vars, display: "contents" }}>
      {chosen.map(([role, font]) => (
        <FontStylesheet key={role} font={font} />
      ))}
      <ComingSoonDesign {...props} />
    </div>
  );
}

function ComingSoonDesign({
  variant = "01",
  afterHours,
  reel,
  socialLinks,
  brand = "Modern Gentlemen",
  eyebrow,
  title = "Coming soon",
  intro,
  image,
  imageAlt = "",
  images = [],
  details = [],
  signature,
  cta,
  showSignup = false,
  buttonLabel = "Notify me",
  tone = "preset",
  mobileOrder = "textFirst",
  imagePosition = "center",
  height = "screen",
}: Omit<ComingSoonProps, "fonts">) {
  if (variant === "21")
    return (
      <AfterHoursLanding
        title={title}
        intro={intro}
        eyebrow={eyebrow}
        image={image}
        imageAlt={imageAlt}
        showSignup={showSignup}
        config={afterHours}
        socialLinks={socialLinks}
      />
    );
  if (isReelDesign(variant))
    return (
      <ReelLanding
        variant={variant}
        brand={brand}
        eyebrow={eyebrow}
        title={title}
        intro={intro}
        signature={signature}
        details={details}
        showSignup={showSignup}
        buttonLabel={buttonLabel}
        socialLinks={socialLinks}
        config={reelConfigWithLaunchDate(reel, afterHours?.countdown?.target)}
      />
    );
  const design = COMING_SOON_DESIGNS.find(([id]) => id === variant) ?? COMING_SOON_DESIGNS[0];
  const treatment = tone === "preset" ? design[2] : tone;
  return (
    <section
      className={styles.soon}
      data-coming-soon={design[0]}
      data-tone={treatment}
      data-height={height}
      data-mobile-order={mobileOrder}
      data-image-position={imagePosition}
      data-has-image={Boolean(image)}
      data-darkband={treatment !== "light" || undefined}
    >
      <div className={styles.composition}>
        {brand && <p className={styles.brand}>{brand}</p>}
        <div className={styles.copy}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          <h1>{title}</h1>
          {intro && <p className={styles.intro}>{intro}</p>}
          {showSignup && <StudySignup buttonLabel={buttonLabel} />}
          {cta && studyHref(cta.href) && (
            <Link className={styles.action} href={studyHref(cta.href)!}>
              {cta.label}
              <span aria-hidden="true"> →</span>
            </Link>
          )}
        </div>
        {image && (
          <div className={styles.primary}>
            <MediaImage src={image} alt={imageAlt} slot="fullBleed" className={styles.image} />
          </div>
        )}
        {images.length > 0 && (
          <div className={styles.gallery}>
            {images.map((item, index) => (
              <div key={index}>
                <MediaImage
                  src={item.image}
                  alt={item.alt ?? ""}
                  slot="quarter"
                  className={styles.image}
                />
              </div>
            ))}
          </div>
        )}
        {details.length > 0 && (
          <ol className={styles.details}>
            {details.map((item, index) => (
              <li key={index}>
                <span className={styles.number} aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h2>{item.title}</h2>
                {item.text && <p>{item.text}</p>}
              </li>
            ))}
          </ol>
        )}
        {signature && <p className={styles.signature}>{signature}</p>}
      </div>
    </section>
  );
}
