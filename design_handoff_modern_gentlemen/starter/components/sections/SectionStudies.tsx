import Link from "next/link";
import type { ComponentType } from "react";
import {
  SECTION_STUDIES,
  sectionStudyType,
  studyHref,
  type SectionStudy,
  type SectionStudyType,
} from "@/lib/blocks/sectionStudies";
import { MediaImage } from "../ui/MediaImage";
import { StudySignup } from "./StudySignup";
import styles from "./SectionStudies.module.css";

interface Entry {
  title: string;
  text?: string;
  meta?: string;
  image?: string;
  alt?: string;
  href?: string;
}

export interface SectionStudyProps {
  title: string;
  eyebrow?: string;
  intro?: string;
  image?: string;
  imageAlt?: string;
  items?: Entry[];
  cta?: { label: string; href: string };
  tone?: "light" | "dark" | "accent";
  mobileOrder?: "textFirst" | "imageFirst";
  imagePosition?: "center" | "top" | "bottom";
  buttonLabel?: string;
}

/** One semantic composition, with explicitly scoped layouts; old sections never enter this renderer. */
export function SectionStudyView({
  study,
  title,
  eyebrow,
  intro,
  image,
  imageAlt = "",
  items = [],
  cta,
  tone,
  mobileOrder = "textFirst",
  imagePosition = "center",
  buttonLabel,
}: SectionStudyProps & { study: SectionStudy }) {
  const [id, , layout, defaultTone] = study;
  const treatment = tone ?? defaultTone;
  return (
    <section
      className={styles.study}
      data-mg-study={id}
      data-layout={layout}
      data-tone={treatment}
      data-mobile-order={mobileOrder}
      data-image-position={imagePosition}
      data-has-image={Boolean(image)}
      data-darkband={treatment !== "light" || undefined}
    >
      <div className={styles.composition}>
        <header className={styles.heading}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          <h2>{title}</h2>
          {intro && <p className={styles.intro}>{intro}</p>}
          {cta && studyHref(cta.href) && (
            <Link className={styles.action} href={studyHref(cta.href)!}>
              {cta.label}
              <span aria-hidden="true"> →</span>
            </Link>
          )}
        </header>
        {image && (
          <div className={styles.primary}>
            <MediaImage src={image} alt={imageAlt} slot="half" className={styles.image} />
          </div>
        )}
        {layout === "correspondence" ? (
          <StudySignup buttonLabel={buttonLabel} />
        ) : (
          items.length > 0 && (
            <ol className={styles.entries}>
              {items.map((item, index) => (
                <li className={styles.entry} key={index}>
                  <span className={styles.number} aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {item.image && (
                    <div className={styles.entryMedia}>
                      <MediaImage
                        src={item.image}
                        alt={item.alt ?? ""}
                        slot="quarter"
                        className={styles.image}
                      />
                    </div>
                  )}
                  <div className={styles.entryCopy}>
                    {item.meta && <p className={styles.meta}>{item.meta}</p>}
                    <h3>
                      {studyHref(item.href) ? (
                        <Link href={studyHref(item.href)!}>
                          {item.title}
                          <span aria-hidden="true"> →</span>
                        </Link>
                      ) : (
                        item.title
                      )}
                    </h3>
                    {item.text && <p>{item.text}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )
        )}
      </div>
    </section>
  );
}

export const sectionStudyRegistry = Object.fromEntries(
  SECTION_STUDIES.map((study) => {
    function Study(props: SectionStudyProps) {
      return <SectionStudyView {...props} study={study} />;
    }
    Study.displayName = `MGStudy${study[0]}`;
    return [sectionStudyType(study[0]), Study];
  })
) as Record<SectionStudyType, ComponentType<SectionStudyProps>>;

export function MGDesignStudio({
  variant = "01",
  tone = "preset",
  ...props
}: Omit<SectionStudyProps, "tone"> & {
  variant?: string;
  tone?: SectionStudyProps["tone"] | "preset";
}) {
  const study = SECTION_STUDIES.find(([id]) => id === variant) ?? SECTION_STUDIES[0];
  return <SectionStudyView {...props} study={study} tone={tone === "preset" ? undefined : tone} />;
}
