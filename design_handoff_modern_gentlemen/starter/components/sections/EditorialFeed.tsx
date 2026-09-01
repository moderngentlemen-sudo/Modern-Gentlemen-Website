import Link from "next/link";

import { MediaImage } from "../ui/MediaImage";

export const EDITORIAL_FEED_VARIANTS = [
  "horizontal-1",
  "horizontal-2",
  "horizontal-3",
  "horizontal-4",
  "horizontal-5",
  "standard-1",
  "standard-2",
  "standard-3",
  "standard-4",
  "tile-1",
  "tile-2",
] as const;

export type EditorialFeedVariant = (typeof EDITORIAL_FEED_VARIANTS)[number];

interface EditorialFeedItem {
  tag?: string;
  title: string;
  dek?: string;
  author?: string;
  read?: string;
  image?: string;
  href: string;
}

interface Props {
  eyebrow?: string;
  heading?: string;
  introduction?: string;
  variant?: EditorialFeedVariant;
  items: EditorialFeedItem[];
  showImages?: boolean;
  showTags?: boolean;
  showExcerpts?: boolean;
  showAuthors?: boolean;
  showReadingTime?: boolean;
  imageRatio?: "landscape" | "portrait" | "square";
  cardStyle?: "plain" | "bordered" | "elevated";
  titleSize?: "compact" | "standard" | "large";
  loadMoreLabel?: string;
  loadMoreHref?: string;
}

const ratioClass = {
  landscape: "aspect-[4/3]",
  portrait: "aspect-[4/5]",
  square: "aspect-square",
} as const;

const titleClass = {
  compact: "text-[19px] leading-[1.16]",
  standard: "text-[24px] leading-[1.1]",
  large: "text-[32px] leading-[1.04]",
} as const;

const cardClass = {
  plain: "",
  bordered: "border border-mg-bd/15 bg-mg-surface p-5",
  elevated: "bg-mg-surface p-5 shadow-[0_16px_50px_rgba(0,0,0,0.08)]",
} as const;

/**
 * A query-ready editorial feed with the eleven composition families exposed by
 * Schematic's Posts module. Content stays native to the builder: `items` may be
 * literal cards or a `$bind` against published articles, and every visual
 * choice remains independent of that source.
 */
export function EditorialFeed({
  eyebrow,
  heading = "Latest stories",
  introduction,
  variant = "standard-1",
  items,
  showImages = true,
  showTags = true,
  showExcerpts = true,
  showAuthors = false,
  showReadingTime = true,
  imageRatio = "landscape",
  cardStyle = "plain",
  titleSize = "standard",
  loadMoreLabel,
  loadMoreHref,
}: Props) {
  const options = {
    showImages,
    showTags,
    showExcerpts,
    showAuthors,
    showReadingTime,
    imageRatio,
    cardStyle,
    titleSize,
  };

  return (
    <section className="container-mg py-16 md:py-24" data-editorial-feed={variant}>
      {(eyebrow || heading || introduction) && (
        <header className="mb-8 max-w-[760px] md:mb-11">
          {eyebrow && (
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mg-accentInk">
              {eyebrow}
            </p>
          )}
          {heading && (
            <h2 className="mt-2 font-grotesk text-[36px] font-semibold leading-none tracking-[-0.035em] md:text-[48px]">
              {heading}
            </h2>
          )}
          {introduction && (
            <p className="mt-4 max-w-[640px] font-grotesk text-[16px] font-light leading-[1.65] text-mg-fg/70">
              {introduction}
            </p>
          )}
        </header>
      )}

      <FeedLayout variant={variant} items={items ?? []} options={options} />

      {loadMoreLabel && loadMoreHref && (
        <div className="mt-12 flex justify-center">
          <Link
            href={loadMoreHref}
            className="border border-mg-bd/25 px-8 py-3.5 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors hover:border-mg-accent hover:text-mg-accentInk"
          >
            {loadMoreLabel}
          </Link>
        </div>
      )}
    </section>
  );
}

type CardOptions = Pick<
  Required<Props>,
  | "showImages"
  | "showTags"
  | "showExcerpts"
  | "showAuthors"
  | "showReadingTime"
  | "imageRatio"
  | "cardStyle"
  | "titleSize"
>;

function FeedLayout({
  variant,
  items,
  options,
}: {
  variant: EditorialFeedVariant;
  items: EditorialFeedItem[];
  options: CardOptions;
}) {
  if (variant.startsWith("horizontal")) {
    if (variant === "horizontal-4") {
      const [lead, ...rest] = items;
      return (
        <div className="grid gap-8 min-[900px]:grid-cols-[1.35fr_1fr]">
          {lead && (
            <ArticleCard item={lead} options={{ ...options, titleSize: "large" }} mode="feature" />
          )}
          <div className="divide-y divide-mg-bd/15">
            {rest.map((item, index) => (
              <ArticleCard key={item.href + index} item={item} options={options} mode="compact" />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div
        className={
          variant === "horizontal-5"
            ? "divide-y divide-mg-bd/15 border-y border-mg-bd/15"
            : "space-y-7"
        }
      >
        {items.map((item, index) => (
          <ArticleCard
            key={item.href + index}
            item={item}
            options={options}
            mode={
              variant === "horizontal-3" || variant === "horizontal-5" ? "compact" : "horizontal"
            }
            reverse={variant === "horizontal-2" || (variant === "horizontal-1" && index % 2 === 1)}
            index={variant === "horizontal-5" ? index + 1 : undefined}
          />
        ))}
      </div>
    );
  }

  if (variant.startsWith("tile")) {
    return (
      <div
        className={
          variant === "tile-2"
            ? "grid gap-4 min-[681px]:grid-cols-2 min-[1025px]:grid-cols-4"
            : "grid gap-5 min-[681px]:grid-cols-2 min-[1025px]:grid-cols-3"
        }
      >
        {items.map((item, index) => (
          <ArticleCard
            key={item.href + index}
            item={item}
            options={options}
            mode="tile"
            featured={variant === "tile-2" && index === 0}
          />
        ))}
      </div>
    );
  }

  if (variant === "standard-3") {
    const [lead, ...rest] = items;
    return (
      <div className="space-y-8">
        {lead && (
          <ArticleCard item={lead} options={{ ...options, titleSize: "large" }} mode="feature" />
        )}
        <div className="grid gap-7 min-[681px]:grid-cols-2 min-[1025px]:grid-cols-3">
          {rest.map((item, index) => (
            <ArticleCard key={item.href + index} item={item} options={options} mode="standard" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "standard-4") {
    return (
      <div className="grid gap-x-12 border-t border-mg-bd/15 min-[760px]:grid-cols-2">
        {items.map((item, index) => (
          <ArticleCard key={item.href + index} item={item} options={options} mode="compact" />
        ))}
      </div>
    );
  }

  const columns =
    variant === "standard-2"
      ? "min-[681px]:grid-cols-2"
      : "min-[681px]:grid-cols-2 min-[1025px]:grid-cols-3";
  return (
    <div className={`grid gap-8 ${columns}`}>
      {items.map((item, index) => (
        <ArticleCard key={item.href + index} item={item} options={options} mode="standard" />
      ))}
    </div>
  );
}

function ArticleCard({
  item,
  options,
  mode,
  reverse = false,
  featured = false,
  index,
}: {
  item: EditorialFeedItem;
  options: CardOptions;
  mode: "standard" | "horizontal" | "compact" | "feature" | "tile";
  reverse?: boolean;
  featured?: boolean;
  index?: number;
}) {
  if (mode === "tile") {
    return (
      <Link
        href={item.href}
        className={`group relative min-h-[330px] overflow-hidden bg-[#0d0d0d] text-white ${featured ? "min-[681px]:col-span-2 min-[681px]:min-h-[500px]" : ""}`}
      >
        {options.showImages && item.image && (
          <MediaImage
            src={item.image}
            alt={item.title}
            slot={featured ? "fullBleed" : "quarter"}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent"
        />
        <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
          <CardCopy item={item} options={options} inverse />
        </div>
      </Link>
    );
  }

  if (mode === "compact") {
    return (
      <Link href={item.href} className="group flex gap-5 py-6">
        {index !== undefined && (
          <span className="w-9 shrink-0 font-mono text-[12px] text-mg-accentInk">
            {String(index).padStart(2, "0")}
          </span>
        )}
        {options.showImages && item.image && (
          <div className="relative h-24 w-28 shrink-0 overflow-hidden bg-mg-surface">
            <MediaImage
              src={item.image}
              alt={item.title}
              slot="thumb"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <CardCopy
            item={item}
            options={{ ...options, showExcerpts: false, titleSize: "compact" }}
          />
        </div>
      </Link>
    );
  }

  if (mode === "horizontal" || mode === "feature") {
    return (
      <Link
        href={item.href}
        className={`group grid items-center gap-7 ${cardClass[options.cardStyle]} ${mode === "feature" ? "min-[760px]:grid-cols-[1.4fr_1fr]" : "min-[681px]:grid-cols-2"}`}
      >
        {options.showImages && item.image && (
          <div
            className={`relative overflow-hidden bg-mg-surface ${mode === "feature" ? "aspect-[16/10]" : ratioClass[options.imageRatio]} ${reverse ? "min-[681px]:order-2" : ""}`}
          >
            <MediaImage
              src={item.image}
              alt={item.title}
              slot="half"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        )}
        <div className={reverse ? "min-[681px]:order-1" : ""}>
          <CardCopy item={item} options={options} />
        </div>
      </Link>
    );
  }

  return (
    <Link href={item.href} className={`group block ${cardClass[options.cardStyle]}`}>
      {options.showImages && item.image && (
        <div
          className={`relative mb-5 overflow-hidden bg-mg-surface ${ratioClass[options.imageRatio]}`}
        >
          <MediaImage
            src={item.image}
            alt={item.title}
            slot="quarter"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      )}
      <CardCopy item={item} options={options} />
    </Link>
  );
}

function CardCopy({
  item,
  options,
  inverse = false,
}: {
  item: EditorialFeedItem;
  options: CardOptions;
  inverse?: boolean;
}) {
  const meta = [
    options.showAuthors ? item.author : undefined,
    options.showReadingTime ? item.read : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div>
      {options.showTags && item.tag && (
        <p
          className={`font-mono text-[9.5px] uppercase tracking-[0.2em] ${inverse ? "text-white/75" : "text-mg-accentSerif"}`}
        >
          {item.tag}
        </p>
      )}
      <h3
        className={`font-grotesk font-medium tracking-[-0.025em] text-balance ${titleClass[options.titleSize]} ${item.tag ? "mt-2.5" : ""}`}
      >
        {item.title}
      </h3>
      {options.showExcerpts && item.dek && (
        <p
          className={`mt-3 font-grotesk text-[14px] font-light leading-[1.6] ${inverse ? "text-white/75" : "text-mg-fg/65"}`}
        >
          {item.dek}
        </p>
      )}
      {meta && (
        <p
          className={`mt-4 font-mono text-[9px] uppercase tracking-[0.16em] ${inverse ? "text-white/60" : "text-mg-fg/60"}`}
        >
          {meta}
        </p>
      )}
    </div>
  );
}
