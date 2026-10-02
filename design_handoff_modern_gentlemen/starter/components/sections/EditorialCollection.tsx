"use client";

import { useId, useState, type ComponentType, type CSSProperties } from "react";
import Link from "next/link";
import {
  EDITORIAL_COLLECTION,
  collectionType,
  editorialConcept,
  type EditorialConceptId,
  type EditorialCollectionType,
} from "@/lib/domain/editorialCollection";
import { studyHref } from "@/lib/blocks/sectionStudies";
import { MediaImage } from "../ui/MediaImage";
import { RichTextContent } from "../ui/RichTextContent";
import { SIGNUP_MESSAGE, useNewsletterSignup } from "../ui/useNewsletterSignup";
import styles from "./EditorialCollection.module.css";

export interface CollectionEntry {
  title: string;
  text?: string;
  meta?: string;
  image?: string;
  alt?: string;
  caption?: string;
  href?: string;
}
export interface CollectionProps {
  title?: string;
  eyebrow?: string;
  intro?: string;
  image?: string;
  imageAlt?: string;
  caption?: string;
  items?: CollectionEntry[];
  quote?: string;
  attribution?: string;
  notes?: string;
  facts?: { label: string; value: string; alternative?: string }[];
  related?: CollectionEntry[];
  cta?: { label: string; href: string };
  tone?: "theme" | "dark";
  imagePosition?: string;
  mediaUrl?: string;
  captionsUrl?: string;
  disclosure?: string;
  showIndex?: boolean;
}

function Photo({
  src,
  alt = "",
  caption,
  hero = false,
}: {
  src?: string;
  alt?: string;
  caption?: string;
  hero?: boolean;
}) {
  if (!src) return null;
  return (
    <figure className={styles.photo}>
      <div className={styles.imageBox}>
        <MediaImage
          src={src}
          alt={alt}
          slot={hero ? "fullBleed" : "strip"}
          className={styles.image}
        />
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
function Copy({ value }: { value?: string }) {
  return value ? <RichTextContent value={value} className={styles.copy} /> : null;
}
function Action({ link }: { link?: { label: string; href: string } }) {
  const href = studyHref(link?.href);
  return href && link?.label ? (
    <Link className={styles.action} href={href}>
      {link.label}
      <span aria-hidden> ↗</span>
    </Link>
  ) : null;
}
function Card({
  entry,
  index,
  chapterId,
  body = false,
}: {
  entry: CollectionEntry;
  index: number;
  chapterId?: string;
  body?: boolean;
}) {
  const href = studyHref(entry.href),
    Heading = body ? "h2" : "h3";
  return (
    <article className={styles.card} id={chapterId}>
      <Photo src={entry.image} alt={entry.alt} caption={entry.caption} />
      <div className={styles.cardCopy}>
        <span className={styles.number} aria-hidden>
          {String(index + 1).padStart(2, "0")}
        </span>
        {entry.meta && <p className={styles.meta}>{entry.meta}</p>}
        <Heading>
          {href ? (
            <Link href={href}>
              {entry.title}
              <span aria-hidden> ↗</span>
            </Link>
          ) : (
            entry.title
          )}
        </Heading>
        <Copy value={entry.text} />
      </div>
    </article>
  );
}
function Quote({ quote, attribution }: CollectionProps) {
  return quote ? (
    <figure className={styles.quote}>
      <blockquote>{quote}</blockquote>
      {attribution && <figcaption>{attribution}</figcaption>}
    </figure>
  ) : null;
}
function Facts({ facts = [] }: CollectionProps) {
  return facts.length ? (
    <dl className={styles.facts}>
      {facts.map((f, i) => (
        <div key={i}>
          <dt>{f.label}</dt>
          <dd>{f.value}</dd>
        </div>
      ))}
    </dl>
  ) : null;
}
function LetterSignup() {
  const { email, setEmail, state, submit } = useNewsletterSignup("newsletter");
  const id = useId();
  return (
    <div className={styles.signup}>
      {state === "done" ? (
        <p role="status">{SIGNUP_MESSAGE.done}</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label htmlFor={id}>Email address</label>
          <div>
            <input
              id={id}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button disabled={state === "submitting"} type="submit">
              {state === "submitting" ? "Sending…" : "Receive the letter"}
            </button>
          </div>
          {(state === "error" || state === "invalid") && (
            <p role="alert">{SIGNUP_MESSAGE[state]}</p>
          )}
        </form>
      )}
    </div>
  );
}

/** Native text, images and controls. Reference mockups never enter the public document. */
export function EditorialCollection({ id, ...p }: CollectionProps & { id: EditorialConceptId }) {
  const c = editorialConcept(id)!;
  const uid = useId().replaceAll(":", "");
  const [filter, setFilter] = useState("All");
  const [specimen, setSpecimen] = useState(0);
  const items = p.items || [];
  const options = ["All", ...new Set(items.map((i) => i.meta).filter((v): v is string => !!v))];
  const filtered = filter === "All" ? items : items.filter((i) => i.meta === filter);
  const filtering = ["07", "09", "17", "32", "55"].includes(id) && options.length > 2;
  const header = (
    <header className={styles.heading}>
      {id === "19" && (
        <p className={styles.disclosure}>{p.disclosure?.trim() || "Partner story"}</p>
      )}
      {p.eyebrow && <p className={styles.eyebrow}>{p.eyebrow}</p>}
      <h2>{p.title || c.name}</h2>
      <Copy value={p.intro} />
      <Action link={p.cta} />
      {id === "20" && <LetterSignup />}
    </header>
  );
  const hero = (
    <div className={styles.hero} data-has-image={!!p.image}>
      <Photo src={p.image} alt={p.imageAlt} caption={p.caption} hero />
      {header}
    </div>
  );
  const cards = (
    <div className={styles.cards}>
      {filtered.map((entry, i) => (
        <Card key={i} entry={entry} index={items.indexOf(entry)} />
      ))}
    </div>
  );
  const media = studyHref(p.mediaUrl);
  const playable = media && /\.(mp4|webm|ogg|mp3|m4a|wav)(?:[?#]|$)/i.test(media);
  const details = (
    <div className={styles.details}>
      <Quote {...p} />
      <Facts facts={p.facts} />
      <Copy value={p.notes} />
    </div>
  );

  if (c.kind === "article") return <ArticleCollectionBody id={id} {...p} />;
  return (
    <section
      className={styles.root}
      data-mg-collection={id}
      data-layout={c.layout}
      data-hero={c.hero}
      data-tone={p.tone || c.tone}
      style={{ "--collection-focus": p.imagePosition || "center" } as CSSProperties}
    >
      {filtering && (
        <div className={styles.filters} role="group" aria-label={`${p.title || c.name} categories`}>
          {options.map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {value}
            </button>
          ))}
        </div>
      )}
      {id === "01" ? (
        <>
          <div className={styles.edition}>
            {header}
            <Photo src={p.image} alt={p.imageAlt} caption={p.caption} hero />
            <div className={styles.contents}>{items[0] && <Card entry={items[0]} index={0} />}</div>
          </div>
          <div className={styles.cards}>
            {items.slice(1).map((entry, i) => (
              <Card key={i} entry={entry} index={i + 1} />
            ))}
          </div>
          {details}
        </>
      ) : ["15", "36", "43", "49", "54", "56", "58"].includes(id) ? (
        <div className={styles.sideBySide}>
          {hero}
          <div>
            {cards}
            {details}
          </div>
        </div>
      ) : id === "34" ? (
        <>
          {header}
          <div className={styles.materials}>
            <div className={styles.specimens}>
              {items.map((item, i) => (
                <button
                  type="button"
                  key={i}
                  aria-pressed={specimen === i}
                  onClick={() => setSpecimen(i)}
                >
                  <Photo src={item.image} alt={item.alt} />
                  <span>{item.title}</span>
                </button>
              ))}
            </div>
            {items[specimen] && (
              <div className={styles.specimenDetail} aria-live="polite">
                <Card entry={items[specimen]} index={specimen} />
              </div>
            )}
          </div>
        </>
      ) : id === "11" ? (
        <>
          {hero}
          <div className={styles.questions}>
            {items.map((item, i) => (
              <details key={i}>
                <summary>{item.title}</summary>
                <Copy value={item.text} />
                <Action
                  link={item.href ? { label: "Read the full answer", href: item.href } : undefined}
                />
              </details>
            ))}
          </div>
          {details}
        </>
      ) : id === "39" ? (
        <>
          {header}
          {cards}
          {p.facts?.length ? (
            <div className={styles.tableScroll}>
              <table>
                <caption>At a glance</caption>
                <thead>
                  <tr>
                    <th scope="col">Detail</th>
                    <th scope="col">{items[0]?.title || "First object"}</th>
                    <th scope="col">{items[1]?.title || "Second object"}</th>
                  </tr>
                </thead>
                <tbody>
                  {p.facts.map((f, i) => (
                    <tr key={i}>
                      <th scope="row">{f.label}</th>
                      <td>{f.value}</td>
                      <td>{f.alternative || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <Quote {...p} />
          <Copy value={p.notes} />
        </>
      ) : ["24", "27", "45", "46", "59"].includes(id) ? (
        <>
          <div className={styles.notebook}>
            {hero}
            <div className={styles.notebookEntries}>
              {cards}
              {details}
            </div>
          </div>
        </>
      ) : id === "30" ? (
        <>
          {hero}
          <div className={styles.frontPage}>
            {items.map((entry, i) => (
              <Card key={i} entry={entry} index={i} />
            ))}
          </div>
          {details}
        </>
      ) : (
        <>
          {hero}
          {playable && (
            <div className={styles.player}>
              {["31", "47"].includes(id) ? (
                <audio controls preload="none" src={media} aria-label={p.title || c.name} />
              ) : (
                <video
                  controls
                  preload="none"
                  src={media}
                  poster={p.image}
                  aria-label={p.title || c.name}
                >
                  <track
                    kind="captions"
                    src={studyHref(p.captionsUrl) || undefined}
                    srcLang="en"
                    label="Captions"
                  />
                </video>
              )}
            </div>
          )}
          {cards}
          {details}
        </>
      )}
      <Related entries={p.related} />
      <span id={`${uid}-end`} className={styles.endMark} aria-hidden />
    </section>
  );
}

function Related({ entries = [] }: { entries?: CollectionEntry[] }) {
  const linked = entries.filter((e) => studyHref(e.href));
  return linked.length ? (
    <nav className={styles.related} aria-label="Related stories">
      <p className={styles.eyebrow}>Continue reading</p>
      <div>
        {linked.map((entry, i) => (
          <Card entry={entry} key={i} index={i} />
        ))}
      </div>
    </nav>
  ) : null;
}

export function ArticleCollectionBody({
  id,
  intro,
  items = [],
  quote,
  attribution,
  facts,
  notes,
  related,
  cta,
  showIndex,
  disclosure,
  imagePosition,
}: CollectionProps & { id: EditorialConceptId }) {
  const c = editorialConcept(id)!;
  const uid = useId().replaceAll(":", "");
  const chapter = (i: number) => `mg-${uid}-${i}`;
  return (
    <div
      className={`${styles.root} ${styles.articleBody}`}
      data-mg-collection={id}
      data-body-layout={c.layout}
      style={{ "--collection-focus": imagePosition || "center" } as CSSProperties}
    >
      {id === "84" && <p className={styles.disclosure}>{disclosure?.trim() || "Partner story"}</p>}
      {showIndex && items.length > 0 && (
        <nav className={styles.chapterNav} aria-label="Article chapters">
          {items.map((entry, i) => (
            <a key={i} href={`#${chapter(i)}`}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              {entry.title}
            </a>
          ))}
        </nav>
      )}
      <div className={styles.opening}>
        <Copy value={intro} />
        <Facts facts={facts} />
      </div>
      <div className={styles.chapters}>
        {items.map((entry, i) => (
          <Card key={i} entry={entry} index={i} chapterId={chapter(i)} body />
        ))}
      </div>
      <Quote quote={quote} attribution={attribution} />
      <div className={styles.closing}>
        <Copy value={notes} />
        <Action link={cta} />
      </div>
      <Related entries={related} />
    </div>
  );
}

export const editorialCollectionRegistry = Object.fromEntries(
  EDITORIAL_COLLECTION.map((c) => [
    collectionType(c.id),
    function CollectionBlock(props: CollectionProps) {
      return <EditorialCollection id={c.id} {...props} />;
    },
  ])
) as Record<EditorialCollectionType, ComponentType<CollectionProps>>;
