import Link from "next/link";
import { COMING_SOON_DESIGNS } from "@/lib/blocks/comingSoon";
import { studyHref } from "@/lib/blocks/sectionStudies";
import { MediaImage } from "../ui/MediaImage";
import { StudySignup } from "./StudySignup";
import styles from "./ComingSoonStudio.module.css";

export interface ComingSoonProps {
  variant?: string;
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
export function ComingSoonStudio({
  variant = "01",
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
}: ComingSoonProps) {
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
