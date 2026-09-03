import Link from "next/link";

import {
  sectionStudioPreset,
  type SectionStudioLayout,
  type SectionStudioVariant,
} from "@/lib/blocks/sectionStudioPresets";
import { MediaImage } from "../ui/MediaImage";

interface StudioItem {
  title: string;
  text?: string;
  meta?: string;
  value?: string;
  image?: string;
  alt?: string;
  href?: string;
}

interface StudioLink {
  label: string;
  href: string;
}

interface Props {
  variant?: SectionStudioVariant;
  eyebrow?: string;
  title: string;
  intro?: string;
  image?: string;
  imageAlt?: string;
  items?: StudioItem[];
  cta?: StudioLink;
  columns?: "2" | "3" | "4";
  tone?: "light" | "dark" | "accent";
  showNumbers?: boolean;
  imageRatio?: "square" | "portrait" | "landscape" | "wide";
}

const toneClass = {
  light: "bg-mg-bg text-mg-fg",
  dark: "bg-[#0d0d0d] text-[#f4f4f4]",
  accent: "bg-mg-accent text-white",
} as const;

const columnClass = {
  "2": "min-[681px]:grid-cols-2",
  "3": "min-[681px]:grid-cols-2 min-[1024px]:grid-cols-3",
  "4": "min-[681px]:grid-cols-2 min-[1024px]:grid-cols-4",
} as const;

const ratioClass = {
  square: "aspect-square",
  portrait: "aspect-[3/4]",
  landscape: "aspect-[4/3]",
  wide: "aspect-[16/9]",
} as const;

const bandLayouts: SectionStudioLayout[] = ["banner", "announcement", "social", "pills", "ticker"];
const voiceLayouts: SectionStudioLayout[] = ["quote", "quotes", "letter", "interview", "advice"];
const dataLayouts: SectionStudioLayout[] = ["stats", "comparison", "pricing", "scorecard", "poll"];
const listLayouts: SectionStudioLayout[] = [
  "list",
  "timeline",
  "calendar",
  "steps",
  "directory",
  "audio",
  "glossary",
  "archive",
  "sidebar",
  "search",
  "pagination",
  "topics",
];
const splitLayouts: SectionStudioLayout[] = [
  "feature",
  "profile",
  "issue",
  "subscribe",
  "beforeAfter",
  "anatomy",
];

/**
 * Native presets for imported Section Library entries 02–68 plus additive
 * platform modules 126–145. The source designs reduce to a bounded set of
 * editorial archetypes; presets retain their exact number/name while this
 * renderer keeps content and presentation independent.
 */
export function SectionStudio({
  variant = "categoryRail",
  eyebrow,
  title,
  intro,
  image,
  imageAlt = "",
  items = [],
  cta,
  columns = "3",
  tone = "light",
  showNumbers = true,
  imageRatio = "landscape",
}: Props) {
  const [, module, presetLabel, layout] = sectionStudioPreset(variant);
  const entries = items.length ? items : fallbackItems;
  const inverse = tone !== "light";

  if (bandLayouts.includes(layout)) {
    return (
      <section
        data-darkband={inverse || undefined}
        data-library-module={module}
        data-section-studio={variant}
        data-section-layout={layout}
        className={`overflow-hidden border-y border-current/20 ${toneClass[tone]}`}
      >
        <div className="container-mg py-5">
          {layout === "pills" ? (
            <nav aria-label={title} className="flex flex-wrap items-center gap-2">
              <span className="mr-3 font-mono text-[9px] uppercase tracking-[0.2em]">{title}</span>
              {entries.map((item, index) => (
                <StudioLinkOrText
                  key={`${item.title}-${index}`}
                  item={item}
                  className="rounded-full border border-current/25 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.14em]"
                />
              ))}
            </nav>
          ) : (
            <div className="flex min-w-max items-center gap-8 font-mono text-[10px] uppercase tracking-[0.18em]">
              <strong className="font-medium text-mg-accentSerif">{title}</strong>
              {[...entries, ...(layout === "ticker" ? entries : [])].map((item, index) => (
                <StudioLinkOrText
                  key={`${item.title}-${index}`}
                  item={item}
                  className="hover:text-mg-accentSerif"
                />
              ))}
              {cta && (
                <Link href={cta.href} className="border-b border-current">
                  {cta.label}
                </Link>
              )}
            </div>
          )}
        </div>
      </section>
    );
  }

  if (layout === "modal") {
    return (
      <section
        data-library-module={module}
        data-section-studio={variant}
        data-section-layout={layout}
        className="bg-black/70 px-5 py-16 text-mg-fg"
      >
        <div className="mx-auto grid max-w-[880px] overflow-hidden bg-mg-bg shadow-2xl min-[681px]:grid-cols-2">
          <StudioMedia
            image={image ?? entries[0]?.image}
            alt={imageAlt || entries[0]?.alt}
            ratio="portrait"
          />
          <div className="flex flex-col justify-center p-9 min-[681px]:p-12">
            <SectionHeading eyebrow={eyebrow ?? presetLabel} title={title} intro={intro} />
            <SignupFields cta={cta} />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      data-darkband={inverse || undefined}
      data-library-module={module}
      data-section-studio={variant}
      data-section-layout={layout}
      className={`py-14 min-[681px]:py-20 ${toneClass[tone]}`}
    >
      <div className="container-mg">
        <SectionHeading
          eyebrow={eyebrow ?? `${module} · ${presetLabel}`}
          title={title}
          intro={intro}
          cta={cta}
        />

        {voiceLayouts.includes(layout) && (
          <VoiceLayout layout={layout} entries={entries} image={image} imageAlt={imageAlt} />
        )}
        {dataLayouts.includes(layout) && <DataLayout layout={layout} entries={entries} />}
        {listLayouts.includes(layout) && (
          <ListLayout layout={layout} entries={entries} showNumbers={showNumbers} />
        )}
        {splitLayouts.includes(layout) && (
          <SplitLayout
            layout={layout}
            entries={entries}
            image={image}
            imageAlt={imageAlt}
            cta={cta}
          />
        )}
        {!voiceLayouts.includes(layout) &&
          !dataLayouts.includes(layout) &&
          !listLayouts.includes(layout) &&
          !splitLayouts.includes(layout) && (
            <CardLayout
              layout={layout}
              entries={entries}
              columns={columns}
              imageRatio={imageRatio}
              showNumbers={showNumbers}
            />
          )}
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  intro,
  cta,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  cta?: StudioLink;
}) {
  return (
    <header className="mb-10 flex flex-wrap items-end justify-between gap-6 border-b border-current/20 pb-6">
      <div className="max-w-[760px]">
        {eyebrow && (
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-mg-accentSerif">
            {eyebrow}
          </p>
        )}
        <h2 className="mt-2 font-grotesk text-[38px] font-semibold leading-none tracking-[-0.035em] min-[681px]:text-[54px]">
          {title}
        </h2>
        {intro && <p className="mt-4 max-w-[620px] text-[16px] leading-7 opacity-65">{intro}</p>}
      </div>
      {cta && (
        <Link
          href={cta.href}
          className="border-b border-current pb-1 font-mono text-[9px] uppercase tracking-[0.18em] hover:text-mg-accentSerif"
        >
          {cta.label}
        </Link>
      )}
    </header>
  );
}

function VoiceLayout({
  layout,
  entries,
  image,
  imageAlt,
}: {
  layout: SectionStudioLayout;
  entries: StudioItem[];
  image?: string;
  imageAlt: string;
}) {
  const lead = entries[0];
  return (
    <div
      className={`grid gap-8 ${image || layout === "interview" ? "min-[821px]:grid-cols-2" : ""}`}
    >
      {image && <StudioMedia image={image} alt={imageAlt} ratio="portrait" />}
      <div className="flex flex-col justify-center">
        {lead.meta && (
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-mg-accentSerif">
            {lead.meta}
          </p>
        )}
        <blockquote className="mt-4 font-serif text-[clamp(30px,5vw,62px)] italic leading-[1.05]">
          “{lead.text ?? lead.title}”
        </blockquote>
        {lead.text && (
          <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.16em]">— {lead.title}</p>
        )}
        {entries.slice(1, 4).map((item, index) => (
          <div key={`${item.title}-${index}`} className="mt-7 border-t border-current/20 pt-5">
            <p className="font-grotesk text-[20px] font-semibold">{item.title}</p>
            {item.text && <p className="mt-2 leading-7 opacity-65">{item.text}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function DataLayout({ layout, entries }: { layout: SectionStudioLayout; entries: StudioItem[] }) {
  return (
    <div className="grid border-l border-t border-current/20 min-[681px]:grid-cols-2 min-[1024px]:grid-cols-4">
      {entries.slice(0, 4).map((item, index) => (
        <article key={`${item.title}-${index}`} className="border-b border-r border-current/20 p-7">
          <p className="font-serif text-[42px] italic text-mg-accentSerif">
            {item.value ?? String(index + 1).padStart(2, "0")}
          </p>
          <h3 className="mt-4 font-grotesk text-[20px] font-semibold">{item.title}</h3>
          {item.text && <p className="mt-3 text-[14px] leading-6 opacity-65">{item.text}</p>}
          {layout === "poll" && (
            <button
              type="button"
              className="mt-5 w-full border border-current/30 px-4 py-3 font-mono text-[9px] uppercase tracking-[0.16em] hover:border-mg-accent"
            >
              Vote
            </button>
          )}
        </article>
      ))}
    </div>
  );
}

function ListLayout({
  layout,
  entries,
  showNumbers,
}: {
  layout: SectionStudioLayout;
  entries: StudioItem[];
  showNumbers: boolean;
}) {
  if (layout === "search") return <SearchLayout entries={entries} />;
  if (layout === "topics") return <TopicCloud entries={entries} />;
  return (
    <div className={layout === "sidebar" ? "grid gap-10 min-[821px]:grid-cols-[1fr_320px]" : ""}>
      <div className="divide-y divide-current/20 border-y border-current/20">
        {entries.map((item, index) => {
          const row = (
            <div className="grid grid-cols-[44px_1fr_auto] gap-4 py-5">
              <span className="font-mono text-[9px] text-mg-accentSerif">
                {showNumbers ? (item.value ?? String(index + 1).padStart(2, "0")) : ""}
              </span>
              <div>
                <h3 className="font-grotesk text-[20px] font-semibold">{item.title}</h3>
                {item.text && (
                  <p className="mt-2 max-w-[720px] text-[14px] leading-6 opacity-65">{item.text}</p>
                )}
                {layout === "glossary" && (
                  <p className="mt-3 font-serif text-[17px] italic">
                    {item.meta ?? "Definition and editorial context."}
                  </p>
                )}
              </div>
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] opacity-60">
                {layout === "audio" ? "▶ Play" : item.meta}
              </span>
            </div>
          );
          return (
            <article key={`${item.title}-${index}`}>
              {item.href ? <Link href={item.href}>{row}</Link> : row}
            </article>
          );
        })}
      </div>
      {layout === "sidebar" && (
        <aside className="border border-current/20 p-7">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-mg-accentSerif">
            Editor&apos;s sidebar
          </p>
          <p className="mt-4 font-serif text-[28px] italic">
            A considered route through the issue.
          </p>
        </aside>
      )}
      {layout === "pagination" && (
        <nav aria-label="Pagination" className="mt-8 flex gap-2">
          <button type="button" className="border border-current/30 px-4 py-3">
            1
          </button>
          <button type="button" className="border border-current/30 px-4 py-3">
            2
          </button>
          <button type="button" className="border border-current/30 px-4 py-3">
            Load more
          </button>
        </nav>
      )}
    </div>
  );
}

function SplitLayout({
  layout,
  entries,
  image,
  imageAlt,
  cta,
}: {
  layout: SectionStudioLayout;
  entries: StudioItem[];
  image?: string;
  imageAlt: string;
  cta?: StudioLink;
}) {
  const first = entries[0];
  return (
    <div className="grid overflow-hidden border border-current/20 min-[821px]:grid-cols-2">
      <StudioMedia
        image={image ?? first.image}
        alt={imageAlt || first.alt}
        ratio={layout === "beforeAfter" ? "landscape" : "portrait"}
      />
      <div className="flex flex-col justify-center p-8 min-[681px]:p-12">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-mg-accentSerif">
          {first.meta ?? "Featured"}
        </p>
        <h3 className="mt-4 font-serif text-[36px] italic leading-tight min-[681px]:text-[50px]">
          {first.title}
        </h3>
        {first.text && <p className="mt-5 leading-7 opacity-65">{first.text}</p>}
        {layout === "anatomy" && (
          <div className="mt-8 grid grid-cols-2 gap-3">
            {entries.slice(1, 5).map((item, index) => (
              <div key={`${item.title}-${index}`} className="border-t border-current/20 pt-3">
                <span className="font-mono text-[9px] text-mg-accentSerif">
                  {item.value ?? index + 1}
                </span>
                <p className="mt-1 text-[13px]">{item.title}</p>
              </div>
            ))}
          </div>
        )}
        {layout === "subscribe" && <SignupFields cta={cta} />}
      </div>
    </div>
  );
}

function CardLayout({
  layout,
  entries,
  columns,
  imageRatio,
  showNumbers,
}: {
  layout: SectionStudioLayout;
  entries: StudioItem[];
  columns: NonNullable<Props["columns"]>;
  imageRatio: NonNullable<Props["imageRatio"]>;
  showNumbers: boolean;
}) {
  const effectiveColumns = layout === "leadGrid" ? "4" : columns;
  return (
    <div className={`grid gap-5 ${columnClass[effectiveColumns]}`} data-card-layout={layout}>
      {entries.slice(0, layout === "footer" ? 8 : 6).map((item, index) => (
        <article
          key={`${item.title}-${index}`}
          className={`${layout === "leadGrid" && index === 0 ? "min-[681px]:col-span-2 min-[681px]:row-span-2" : ""} ${layout === "mosaic" && index === 0 ? "min-[681px]:col-span-2" : ""}`}
        >
          {item.image && (
            <StudioMedia
              image={item.image}
              alt={item.alt}
              ratio={layout === "video" ? "wide" : imageRatio}
            />
          )}
          <div className="border-t border-current/20 pt-4">
            <div className="flex justify-between gap-4 font-mono text-[9px] uppercase tracking-[0.16em] text-mg-accentSerif">
              <span>
                {showNumbers ? (item.value ?? String(index + 1).padStart(2, "0")) : item.meta}
              </span>
              {layout === "video" && <span>▶ Watch</span>}
            </div>
            <h3 className="mt-2 font-grotesk text-[20px] font-semibold leading-tight">
              <StudioLinkOrText item={item} />
            </h3>
            {item.text && <p className="mt-3 text-[14px] leading-6 opacity-65">{item.text}</p>}
          </div>
        </article>
      ))}
    </div>
  );
}

function SearchLayout({ entries }: { entries: StudioItem[] }) {
  return (
    <div>
      <label
        className="block font-mono text-[9px] uppercase tracking-[0.18em]"
        htmlFor="section-studio-search"
      >
        Search the archive
      </label>
      <input
        id="section-studio-search"
        type="search"
        placeholder="Style, culture, motoring…"
        className="mt-3 w-full border-b border-current bg-transparent py-4 font-grotesk text-[26px] outline-none focus:border-mg-accent"
      />
      <div className="mt-8">
        <ListLayout layout="list" entries={entries.slice(0, 3)} showNumbers={false} />
      </div>
    </div>
  );
}

function TopicCloud({ entries }: { entries: StudioItem[] }) {
  return (
    <nav aria-label="Topics" className="flex flex-wrap gap-x-6 gap-y-3">
      {entries.map((item, index) => (
        <StudioLinkOrText
          key={`${item.title}-${index}`}
          item={item}
          className="font-serif text-[clamp(22px,4vw,48px)] italic hover:text-mg-accentSerif"
        />
      ))}
    </nav>
  );
}

function SignupFields({ cta }: { cta?: StudioLink }) {
  return (
    <div className="mt-8 flex border-b border-current">
      <input
        type="email"
        aria-label="Email address"
        placeholder="Email address"
        className="min-w-0 flex-1 bg-transparent py-3 outline-none"
      />
      <button type="button" className="font-mono text-[9px] uppercase tracking-[0.16em]">
        {cta?.label ?? "Subscribe"}
      </button>
    </div>
  );
}

function StudioMedia({
  image,
  alt = "",
  ratio,
}: {
  image?: string;
  alt?: string;
  ratio: keyof typeof ratioClass;
}) {
  return (
    <div className={`relative overflow-hidden bg-black/10 ${ratioClass[ratio]}`}>
      {image && <MediaImage src={image} alt={alt} slot="half" className="object-cover" />}
    </div>
  );
}

function StudioLinkOrText({ item, className }: { item: StudioItem; className?: string }) {
  return item.href ? (
    <Link href={item.href} className={className}>
      {item.title}
    </Link>
  ) : (
    <span className={className}>{item.title}</span>
  );
}

const fallbackItems: StudioItem[] = [
  {
    title: "The art of considered living",
    text: "Objects, ideas and people worth your attention.",
    meta: "Culture",
    image: "/images/hero-cover.jpg",
    alt: "Editorial feature",
    href: "/",
  },
  {
    title: "A modern uniform",
    text: "A practical study in proportion, material and restraint.",
    meta: "Style",
    image: "/images/style-mono.jpg",
    alt: "Monochrome tailoring",
    href: "/",
  },
  {
    title: "Made to endure",
    text: "Mechanical details and the pleasure of keeping good things.",
    meta: "Watches",
    image: "/images/watch-gear.jpg",
    alt: "Mechanical watch",
    href: "/",
  },
  {
    title: "The room with a point of view",
    text: "Interiors that reward a slower look.",
    meta: "Design",
    image: "/images/interiors.jpg",
    alt: "A considered interior",
    href: "/",
  },
];
