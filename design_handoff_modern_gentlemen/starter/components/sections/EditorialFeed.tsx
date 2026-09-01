"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

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
  imageRatio?: "wide" | "landscape" | "square" | "portrait" | "tall" | "cinema";
  imageWidth?: "oneThird" | "half" | "twoThird";
  imagePosition?: "preset" | "left" | "right" | "alternate";
  cardStyle?: "plain" | "bordered" | "elevated";
  titleSize?: "compact" | "standard" | "large";
  columnsDesktop?: "auto" | "1" | "2" | "3" | "4";
  columnsTablet?: "auto" | "1" | "2" | "3";
  columnsMobile?: "auto" | "1" | "2";
  rowGap?: "preset" | "0" | "8" | "16" | "24" | "32" | "48" | "64";
  columnGap?: "preset" | "0" | "8" | "16" | "24" | "32" | "48" | "64";
  showSeparators?: boolean;
  readMoreLabel?: string;
  emptyMessage?: string;
  pagination?: "none" | "pages" | "loadMore" | "infinite";
  pageSize?: number;
  paginationLabel?: string;
  previousLabel?: string;
  nextLabel?: string;
  paginationButtonLabel?: string;
  infiniteFallbackLabel?: string;
  loadMoreLabel?: string;
  loadMoreHref?: string;
}

const ratioClass = {
  wide: "aspect-video",
  landscape: "aspect-[4/3]",
  square: "aspect-square",
  portrait: "aspect-[4/5]",
  tall: "aspect-[2/3]",
  cinema: "aspect-[21/9]",
} as const;

const horizontalColumns = {
  oneThird: {
    normal: "min-[681px]:grid-cols-[1fr_2fr]",
    reverse: "min-[681px]:grid-cols-[2fr_1fr]",
  },
  half: { normal: "min-[681px]:grid-cols-2", reverse: "min-[681px]:grid-cols-2" },
  twoThird: {
    normal: "min-[681px]:grid-cols-[2fr_1fr]",
    reverse: "min-[681px]:grid-cols-[1fr_2fr]",
  },
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
  imageWidth = "half",
  imagePosition = "preset",
  cardStyle = "plain",
  titleSize = "standard",
  columnsDesktop = "auto",
  columnsTablet = "auto",
  columnsMobile = "auto",
  rowGap = "preset",
  columnGap = "preset",
  showSeparators = false,
  readMoreLabel = "",
  emptyMessage = "No stories match this feed yet.",
  pagination = "none",
  pageSize = 6,
  paginationLabel = "Stories pagination",
  previousLabel = "Previous",
  nextLabel = "Next",
  paginationButtonLabel = "Load more",
  infiniteFallbackLabel = "Show more now",
  loadMoreLabel,
  loadMoreHref,
}: Props) {
  const safePageSize = Math.max(
    1,
    Math.min(12, Number.isFinite(pageSize) ? Math.round(pageSize) : 6)
  );
  const [page, setPage] = useState(1);
  const [visibleCount, setVisibleCount] = useState(safePageSize);
  const infiniteTarget = useRef<HTMLDivElement>(null);
  const totalPages = Math.max(1, Math.ceil(items.length / safePageSize));
  const currentPage = Math.min(page, totalPages);
  const hasMore = visibleCount < items.length;

  useEffect(() => {
    if (pagination !== "infinite" || !hasMore || !infiniteTarget.current) return;
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleCount((count) => Math.min(count + safePageSize, items.length));
      }
    });
    observer.observe(infiniteTarget.current);
    return () => observer.disconnect();
  }, [hasMore, items.length, pagination, safePageSize]);

  const visibleItems =
    pagination === "pages"
      ? items.slice((currentPage - 1) * safePageSize, currentPage * safePageSize)
      : pagination === "loadMore" || pagination === "infinite"
        ? items.slice(0, visibleCount)
        : items;

  const options = {
    showImages,
    showTags,
    showExcerpts,
    showAuthors,
    showReadingTime,
    imageRatio,
    imageWidth,
    cardStyle,
    titleSize,
    readMoreLabel,
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

      {items.length === 0 ? (
        <p className="border-y border-mg-bd/15 py-10 font-grotesk text-[15px] text-mg-fg/60">
          {emptyMessage}
        </p>
      ) : (
        <FeedLayout
          variant={variant}
          items={visibleItems}
          options={options}
          columns={{ desktop: columnsDesktop, tablet: columnsTablet, mobile: columnsMobile }}
          gaps={{ row: rowGap, column: columnGap }}
          imagePosition={imagePosition}
          showSeparators={showSeparators}
        />
      )}

      {pagination === "pages" && items.length > safePageSize && (
        <PageNavigation
          page={currentPage}
          total={totalPages}
          label={paginationLabel}
          previousLabel={previousLabel}
          nextLabel={nextLabel}
          onPage={setPage}
        />
      )}

      {(pagination === "loadMore" || pagination === "infinite") && hasMore && (
        <div className="mt-10 flex justify-center" ref={infiniteTarget}>
          <button
            type="button"
            className="mg-button border border-mg-bd/25 px-8 py-3.5 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors hover:border-mg-accent hover:text-mg-accentInk"
            onClick={() => setVisibleCount((count) => Math.min(count + safePageSize, items.length))}
          >
            {pagination === "infinite" ? infiniteFallbackLabel : paginationButtonLabel}
          </button>
        </div>
      )}

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
  | "imageWidth"
  | "cardStyle"
  | "titleSize"
  | "readMoreLabel"
>;

interface FeedColumns {
  desktop: NonNullable<Props["columnsDesktop"]>;
  tablet: NonNullable<Props["columnsTablet"]>;
  mobile: NonNullable<Props["columnsMobile"]>;
}

interface FeedGaps {
  row: NonNullable<Props["rowGap"]>;
  column: NonNullable<Props["columnGap"]>;
}

type FeedGridStyle = CSSProperties & Record<`--feed-${string}`, string | number>;

function FeedLayout({
  variant,
  items,
  options,
  columns,
  gaps,
  imagePosition,
  showSeparators,
}: {
  variant: EditorialFeedVariant;
  items: EditorialFeedItem[];
  options: CardOptions;
  columns: FeedColumns;
  gaps: FeedGaps;
  imagePosition: NonNullable<Props["imagePosition"]>;
  showSeparators: boolean;
}) {
  const grid = gridPresentation(variant, columns, gaps);
  const tileFeatureClass = tileFeaturePresentation(columns);
  if (variant.startsWith("horizontal")) {
    if (variant === "horizontal-4") {
      const [lead, ...rest] = items;
      return (
        <div className="grid gap-8 min-[900px]:grid-cols-[1.35fr_1fr]">
          {lead && (
            <ArticleCard item={lead} options={{ ...options, titleSize: "large" }} mode="feature" />
          )}
          <div className={showSeparators ? "divide-y divide-mg-bd/15" : "space-y-2"}>
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
          variant === "horizontal-5" || showSeparators
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
            reverse={imageOnRight(variant, imagePosition, index)}
            index={variant === "horizontal-5" ? index + 1 : undefined}
          />
        ))}
      </div>
    );
  }

  if (variant.startsWith("tile")) {
    return (
      <div className={grid.className} style={grid.style}>
        {items.map((item, index) => (
          <ArticleCard
            key={item.href + index}
            item={item}
            options={options}
            mode="tile"
            featured={variant === "tile-2" && index === 0}
            featureClassName={variant === "tile-2" && index === 0 ? tileFeatureClass : undefined}
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
        <div className={grid.className} style={grid.style}>
          {rest.map((item, index) => (
            <ArticleCard key={item.href + index} item={item} options={options} mode="standard" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "standard-4") {
    return (
      <div className={`${grid.className} border-t border-mg-bd/15`} style={grid.style}>
        {items.map((item, index) => (
          <ArticleCard key={item.href + index} item={item} options={options} mode="compact" />
        ))}
      </div>
    );
  }

  return (
    <div className={grid.className} style={grid.style}>
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
  featureClassName,
  index,
}: {
  item: EditorialFeedItem;
  options: CardOptions;
  mode: "standard" | "horizontal" | "compact" | "feature" | "tile";
  reverse?: boolean;
  featured?: boolean;
  featureClassName?: string;
  index?: number;
}) {
  if (mode === "tile") {
    return (
      <Link
        href={item.href}
        className={`group relative min-h-[330px] overflow-hidden bg-[#0d0d0d] text-white ${featureClassName ?? ""}`}
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
        className={`group grid items-center gap-7 ${cardClass[options.cardStyle]} ${horizontalColumns[options.imageWidth][reverse ? "reverse" : "normal"]}`}
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
      {options.readMoreLabel && (
        <span
          className={`mt-4 inline-block font-mono text-[9px] uppercase tracking-[0.18em] ${inverse ? "text-white" : "text-mg-accentInk"}`}
        >
          {options.readMoreLabel} →
        </span>
      )}
    </div>
  );
}

function imageOnRight(
  variant: EditorialFeedVariant,
  position: NonNullable<Props["imagePosition"]>,
  index: number
): boolean {
  if (position === "right") return true;
  if (position === "left") return false;
  if (position === "alternate") return index % 2 === 1;
  return variant === "horizontal-2" || (variant === "horizontal-1" && index % 2 === 1);
}

function gridPresentation(
  variant: EditorialFeedVariant,
  columns: FeedColumns,
  gaps: FeedGaps
): { className: string; style: FeedGridStyle } {
  const presetDesktop =
    variant === "standard-2" || variant === "standard-4" ? 2 : variant === "tile-2" ? 4 : 3;
  const presetGap = variant.startsWith("tile") ? 20 : 32;
  return {
    className:
      "grid grid-cols-[repeat(var(--feed-cols-mobile),minmax(0,1fr))] gap-x-[var(--feed-column-gap)] gap-y-[var(--feed-row-gap)] min-[681px]:grid-cols-[repeat(var(--feed-cols-tablet),minmax(0,1fr))] min-[1025px]:grid-cols-[repeat(var(--feed-cols-desktop),minmax(0,1fr))]",
    style: {
      "--feed-cols-mobile": columns.mobile === "auto" ? 1 : Number(columns.mobile),
      "--feed-cols-tablet": columns.tablet === "auto" ? 2 : Number(columns.tablet),
      "--feed-cols-desktop": columns.desktop === "auto" ? presetDesktop : Number(columns.desktop),
      "--feed-row-gap": `${gaps.row === "preset" ? presetGap : Number(gaps.row)}px`,
      "--feed-column-gap": `${gaps.column === "preset" ? presetGap : Number(gaps.column)}px`,
    },
  };
}

function tileFeaturePresentation(columns: FeedColumns): string {
  const tabletSpans = columns.tablet === "auto" || Number(columns.tablet) > 1;
  const desktopSpans = columns.desktop === "auto" || Number(columns.desktop) > 1;
  return [
    tabletSpans ? "min-[681px]:col-span-2 min-[681px]:min-h-[500px]" : "min-[681px]:col-span-1",
    desktopSpans ? "min-[1025px]:col-span-2" : "min-[1025px]:col-span-1",
  ].join(" ");
}

function PageNavigation({
  page,
  total,
  label,
  previousLabel,
  nextLabel,
  onPage,
}: {
  page: number;
  total: number;
  label: string;
  previousLabel: string;
  nextLabel: string;
  onPage: (page: number) => void;
}) {
  return (
    <nav className="mt-12 flex flex-wrap items-center justify-center gap-2" aria-label={label}>
      <PagerButton disabled={page === 1} onClick={() => onPage(page - 1)}>
        {previousLabel}
      </PagerButton>
      {Array.from({ length: total }, (_, index) => index + 1).map((number) => (
        <PagerButton key={number} current={number === page} onClick={() => onPage(number)}>
          {number}
        </PagerButton>
      ))}
      <PagerButton disabled={page === total} onClick={() => onPage(page + 1)}>
        {nextLabel}
      </PagerButton>
    </nav>
  );
}

function PagerButton({
  children,
  current,
  disabled,
  onClick,
}: {
  children: ReactNode;
  current?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-current={current ? "page" : undefined}
      className={`min-w-10 border px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] ${current ? "border-mg-accent bg-mg-accent text-white" : "border-mg-bd/20 text-mg-fg/70"} disabled:cursor-not-allowed disabled:opacity-35`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
