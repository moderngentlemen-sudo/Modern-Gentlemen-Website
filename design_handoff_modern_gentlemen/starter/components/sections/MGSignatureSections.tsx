import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import {
  MG_SIGNATURE_SECTIONS,
  signatureType,
  type SignatureEntry,
  type SignatureId,
  type SignatureProps,
  type SignatureType,
} from "@/lib/blocks/mgSignatureSections";
import { studyHref } from "@/lib/blocks/sectionStudies";
import type { ImageSizeKey } from "@/lib/domain/images";
import { MediaImage } from "../ui/MediaImage";
import styles from "./MGSignatureSections.module.css";

function Photo({
  src,
  alt = "",
  className = "",
  slot = "strip",
}: {
  src?: string;
  alt?: string;
  className?: string;
  slot?: ImageSizeKey;
}) {
  if (!src) return null;
  return (
    <div className={`${styles.photo} ${className}`}>
      <MediaImage src={src} alt={alt} slot={slot} className={styles.image} />
    </div>
  );
}

function TitleLink({ entry }: { entry: SignatureEntry }) {
  const href = studyHref(entry.href);
  return href ? (
    <Link href={href}>
      {entry.title}
      <span aria-hidden="true" className={styles.arrow}>
        ↗
      </span>
    </Link>
  ) : (
    <>{entry.title}</>
  );
}

function Card({
  entry,
  index,
  numbered = false,
  imageSlot = "strip",
}: {
  entry: SignatureEntry;
  index: number;
  numbered?: boolean;
  imageSlot?: ImageSizeKey;
}) {
  return (
    <article className={styles.card}>
      <Photo src={entry.image} alt={entry.alt} slot={imageSlot} />
      <div className={styles.cardCopy}>
        {numbered && (
          <span className={styles.number} aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
        {entry.meta && <p className={styles.meta}>{entry.meta}</p>}
        <h3>
          <TitleLink entry={entry} />
        </h3>
        {entry.text && <p className={styles.body}>{entry.text}</p>}
        {entry.detail && <p className={styles.detail}>{entry.detail}</p>}
      </div>
    </article>
  );
}

/** All layouts share the same editable contract, but retain distinct semantic compositions. */
export function MGSignatureSection({
  id,
  title,
  eyebrow,
  intro,
  image,
  imageAlt = "",
  caption,
  items = [],
  cta,
  tone = "theme",
  spacing = "comfortable",
  imagePosition = "center",
  disclosure,
}: SignatureProps & { id: SignatureId }) {
  const href = studyHref(cta?.href);
  const action =
    href && cta?.label ? (
      <Link className={styles.action} href={href}>
        {cta.label}
        <span aria-hidden="true">↗</span>
      </Link>
    ) : null;
  const header = (
    <header className={styles.heading}>
      {id === "brandPerspective" && (
        <p className={styles.disclosure}>{disclosure?.trim() || "Partner story"}</p>
      )}
      {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
      <h2>{title}</h2>
      {intro && <p className={styles.intro}>{intro}</p>}
      {action}
    </header>
  );
  const splitFeature = [
    "coverStory",
    "dispatchDesk",
    "capsuleWardrobe",
    "garageNotes",
    "fortyEightHours",
    "chefsCounter",
    "cellarNotes",
    "inGoodCompany",
    "livingWell",
    "residence",
    "brandPerspective",
    "readingList",
  ].includes(id);
  const feature = image ? (
    <figure className={styles.feature}>
      <Photo src={image} alt={imageAlt} slot={splitFeature ? "half" : "fullBleed"} />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  ) : null;
  const cards = (entries = items, numbered = false) =>
    entries.map((entry, index) => (
      <Card
        key={index}
        entry={entry}
        index={index}
        numbered={numbered}
        imageSlot={
          id === "dispatchDesk" || id === "livingWell" || id === "coverStory"
            ? "thumb"
            : id === "hotelRegister" || id === "mgPresents"
              ? "half"
              : id === "makersMethods"
                ? "quarter"
                : "strip"
        }
      />
    ));
  const grid = (entries = items, numbered = false) => (
    <div className={styles.cards}>{cards(entries, numbered)}</div>
  );
  const ordered = (className = "") => (
    <ol className={`${styles.ordered} ${className}`}>
      {items.map((entry, index) => (
        <li key={index}>
          <span className={styles.number} aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <Card entry={entry} index={index} imageSlot={id === "openRoad" ? "strip" : "thumb"} />
        </li>
      ))}
    </ol>
  );
  const questions = (numbered: boolean) => (
    <div className={styles.questions}>
      {items.map((entry, index) => (
        <details key={index}>
          <summary>
            {numbered && (
              <span className={styles.number} aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
            )}
            <span>
              {entry.meta && <small className={styles.meta}>{entry.meta}</small>}
              <span className={styles.questionTitle}>{entry.title}</span>
            </span>
            <span className={styles.plus} aria-hidden="true">
              +
            </span>
          </summary>
          <div className={styles.answer}>
            <Photo src={entry.image} alt={entry.alt} />
            {entry.text && <p>{entry.text}</p>}
            {entry.detail && <p>{entry.detail}</p>}
            {studyHref(entry.href) && (
              <Link className={styles.action} href={studyHref(entry.href)!}>
                Read {entry.title}
                <span aria-hidden="true">↗</span>
              </Link>
            )}
          </div>
        </details>
      ))}
    </div>
  );
  let content: ReactNode;
  switch (id) {
    case "coverStory":
      content = (
        <div className={styles.cover}>
          {header}
          {feature}
          <aside className={styles.sideNotes}>{cards()}</aside>
        </div>
      );
      break;
    case "dispatchDesk":
      content = (
        <>
          {header}
          <div className={styles.dispatch}>
            <div>
              {feature}
              {items[0] && <Card entry={items[0]} index={0} />}
            </div>
            <div className={styles.briefs}>{cards(items.slice(1), true)}</div>
          </div>
        </>
      );
      break;
    case "styleForecast":
      content = (
        <>
          {header}
          {feature}
          {grid()}
        </>
      );
      break;
    case "capsuleWardrobe":
      content = (
        <>
          {header}
          <div className={styles.capsule}>
            {feature}
            {ordered()}
          </div>
        </>
      );
      break;
    case "watchVault":
      content = (
        <>
          {header}
          {feature}
          {grid()}
        </>
      );
      break;
    case "collectorComparison":
      content = (
        <>
          {header}
          {feature}
          {items.length > 0 && (
            <div
              className={styles.tableScroll}
              role="region"
              aria-label="Collector comparison"
              tabIndex={0}
            >
              <table>
                <caption>{title}</caption>
                <thead>
                  <tr>
                    <th scope="col">The piece</th>
                    <th scope="col">Key quality</th>
                    <th scope="col">The perspective</th>
                    <th scope="col">Considerations</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((entry, index) => (
                    <tr key={index}>
                      <th scope="row">
                        <Photo src={entry.image} alt={entry.alt} slot="thumb" />
                        <TitleLink entry={entry} />
                      </th>
                      <td>{entry.meta || "—"}</td>
                      <td>{entry.text || "—"}</td>
                      <td>{entry.detail || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      );
      break;
    case "openRoad":
      content = (
        <>
          {header}
          {feature}
          {ordered(styles.route)}
        </>
      );
      break;
    case "garageNotes":
      content = (
        <>
          {header}
          <div className={styles.garage}>
            {feature}
            <div className={styles.specs}>
              {items.map((entry, index) => (
                <article key={index}>
                  <span className={styles.meta}>
                    {entry.meta || String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3>
                      <TitleLink entry={entry} />
                    </h3>
                    {entry.text && <p>{entry.text}</p>}
                    {entry.detail && <p className={styles.detail}>{entry.detail}</p>}
                    <Photo src={entry.image} alt={entry.alt} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </>
      );
      break;
    case "greatEscapes":
      content = (
        <>
          {header}
          {feature}
          {grid()}
        </>
      );
      break;
    case "fortyEightHours":
      content = (
        <div className={styles.itinerary}>
          <div>
            {header}
            {feature}
          </div>
          {ordered(styles.schedule)}
        </div>
      );
      break;
    case "hotelRegister":
      content = (
        <>
          {header}
          {feature}
          <div className={styles.register}>{cards(items, true)}</div>
        </>
      );
      break;
    case "chefsCounter":
      content = (
        <>
          <div className={styles.chef}>
            {feature}
            {header}
          </div>
          {grid()}
        </>
      );
      break;
    case "cellarNotes":
      content = (
        <div className={styles.cellar}>
          <div>
            {header}
            {ordered()}
          </div>
          {feature}
        </div>
      );
      break;
    case "afterHours":
      content = (
        <>
          <div className={styles.nightHeading}>
            {header}
            <span className={styles.monogram} aria-hidden="true">
              MG.
            </span>
          </div>
          {feature}
          {grid()}
        </>
      );
      break;
    case "culturalRadar":
      content = (
        <>
          {header}
          {feature}
          <ol className={styles.radar}>
            {items.map((entry, index) => (
              <li key={index}>
                <p className={styles.meta}>{entry.detail || entry.meta}</p>
                <div>
                  <h3>
                    <TitleLink entry={entry} />
                  </h3>
                  {entry.text && <p>{entry.text}</p>}
                </div>
                <span className={styles.radarCategory}>{entry.meta}</span>
                <Photo src={entry.image} alt={entry.alt} />
              </li>
            ))}
          </ol>
        </>
      );
      break;
    case "screeningNotes":
      content = (
        <>
          {feature}
          <div className={styles.screening}>
            {header}
            <div className={styles.filmNotes}>{cards()}</div>
          </div>
        </>
      );
      break;
    case "inGoodCompany":
      content = (
        <div className={styles.interview}>
          {feature}
          <div>
            {header}
            {questions(false)}
          </div>
        </div>
      );
      break;
    case "makersMethods":
      content = (
        <>
          {header}
          {feature}
          <div className={styles.process}>{cards(items, true)}</div>
        </>
      );
      break;
    case "livingWell":
      content = (
        <>
          {header}
          <div className={styles.living}>
            {feature}
            {grid()}
          </div>
        </>
      );
      break;
    case "dailyRitual":
      content = (
        <>
          {header}
          {feature}
          <div className={styles.ritual}>{cards(items, true)}</div>
        </>
      );
      break;
    case "residence":
      content = (
        <>
          <div className={styles.residence}>
            {header}
            {feature}
          </div>
          <div className={styles.program}>{cards(items, true)}</div>
        </>
      );
      break;
    case "mgPresents":
      content = (
        <>
          {header}
          {feature}
          <div className={styles.events}>{cards()}</div>
        </>
      );
      break;
    case "brandPerspective":
      content = (
        <>
          <div className={styles.partner}>
            {feature}
            {header}
          </div>
          <div className={styles.partnerNotes}>{cards()}</div>
        </>
      );
      break;
    case "readingList":
      content = (
        <div className={styles.reading}>
          <div>
            {header}
            {feature}
          </div>
          {questions(true)}
        </div>
      );
      break;
  }
  return (
    <section
      className={styles.section}
      data-mg-signature={id}
      data-tone={tone}
      data-spacing={spacing}
      data-focal={imagePosition}
      data-has-image={Boolean(image)}
      data-darkband={tone === "dark" || undefined}
    >
      <div className={styles.inner}>{content}</div>
    </section>
  );
}

export const signatureSectionRegistry = Object.fromEntries(
  MG_SIGNATURE_SECTIONS.map(({ id }) => {
    function SignatureSection(props: SignatureProps) {
      return <MGSignatureSection {...props} id={id} />;
    }
    SignatureSection.displayName = `MGSignature_${id}`;
    return [signatureType(id), SignatureSection];
  })
) as Record<SignatureType, ComponentType<SignatureProps>>;
