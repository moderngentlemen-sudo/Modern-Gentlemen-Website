import type { CSSProperties, ElementType } from "react";
import Link from "next/link";

import { clsx } from "@/components/ui/clsx";
import { RichTextContent } from "@/components/ui/RichTextContent";

const HEADING_SIZE = {
  small: "text-[22px] leading-[1.2]",
  medium: "text-[30px] min-[681px]:text-[38px] leading-[1.12]",
  large: "text-[40px] min-[681px]:text-[58px] leading-[1.02]",
  display: "text-[52px] min-[681px]:text-[82px] leading-[0.94] tracking-[-0.04em]",
} as const;

const FONT = {
  heading: "font-grotesk",
  editorial: "font-serif italic",
  label: "font-mono uppercase tracking-[0.16em]",
  navigation: "font-nav uppercase tracking-[0.12em]",
} as const;

const WEIGHT = {
  light: "font-light",
  regular: "font-normal",
  medium: "font-medium",
  bold: "font-bold",
} as const;

const ALIGN = {
  start: "text-left",
  center: "text-center",
  end: "text-right",
} as const;

const MAX_WIDTH = {
  none: "",
  reading: "max-w-[760px]",
  content: "max-w-[var(--layout-content-width)]",
} as const;

export function NativeHeading({
  text,
  level = "h2",
  size = "large",
  font = "heading",
  weight = "medium",
  align = "start",
  maxWidth = "none",
}: {
  text: string;
  level?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  size?: keyof typeof HEADING_SIZE;
  font?: keyof typeof FONT;
  weight?: keyof typeof WEIGHT;
  align?: keyof typeof ALIGN;
  maxWidth?: keyof typeof MAX_WIDTH;
}) {
  const Tag = level as ElementType;
  return (
    <Tag
      className={clsx(
        "text-balance",
        HEADING_SIZE[size],
        FONT[font],
        WEIGHT[weight],
        ALIGN[align],
        MAX_WIDTH[maxWidth],
        maxWidth !== "none" && align === "center" && "mx-auto",
        maxWidth !== "none" && align === "end" && "ml-auto"
      )}
    >
      {text}
    </Tag>
  );
}

const TEXT_STYLE = {
  lead: "text-[20px] min-[681px]:text-[24px] leading-[1.45]",
  body: "text-[16px] leading-[1.7]",
  small: "text-[13px] leading-[1.6]",
  label: "font-mono text-[11px] uppercase tracking-[0.16em] leading-[1.5]",
} as const;

export function NativeText({
  content,
  style = "body",
  align = "start",
  maxWidth = "reading",
}: {
  content: string;
  style?: keyof typeof TEXT_STYLE;
  align?: keyof typeof ALIGN;
  maxWidth?: keyof typeof MAX_WIDTH;
}) {
  return (
    <RichTextContent
      value={content}
      className={clsx(
        TEXT_STYLE[style],
        ALIGN[align],
        MAX_WIDTH[maxWidth],
        maxWidth !== "none" && align === "center" && "mx-auto",
        maxWidth !== "none" && align === "end" && "ml-auto"
      )}
    />
  );
}

const ASPECT = {
  auto: "",
  square: "aspect-square",
  portrait: "aspect-[3/4]",
  landscape: "aspect-[4/3]",
  wide: "aspect-video",
} as const;

export function NativeImage({
  src,
  alt = "",
  caption,
  aspect = "auto",
  fit = "cover",
  position = "center",
}: {
  src: string;
  alt?: string;
  caption?: string;
  aspect?: keyof typeof ASPECT;
  fit?: "cover" | "contain";
  position?: "top" | "center" | "bottom";
}) {
  return (
    <figure>
      {/* eslint-disable-next-line @next/next/no-img-element -- builder media may use any approved external provider */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={clsx(
          "block w-full",
          ASPECT[aspect],
          aspect !== "auto" && (fit === "cover" ? "object-cover" : "object-contain"),
          position === "top"
            ? "object-top"
            : position === "bottom"
              ? "object-bottom"
              : "object-center"
        )}
      />
      {caption && <figcaption className="mt-2 text-[12px] text-mg-fg/60">{caption}</figcaption>}
    </figure>
  );
}

const BUTTON_VARIANT = {
  solid: "border-mg-accent bg-mg-accent text-white hover:bg-mg-accent/90",
  outline: "border-mg-bd text-mg-fg hover:border-mg-accent hover:text-mg-accentInk",
  text: "border-transparent text-mg-fg mg-underline",
} as const;

const BUTTON_SIZE = {
  small: "px-4 py-2 text-[11px]",
  medium: "px-6 py-3 text-[12px]",
  large: "px-8 py-4 text-[13px]",
} as const;

export function NativeButton({
  label,
  href,
  variant = "solid",
  size = "medium",
  align = "start",
  newTab = false,
}: {
  label: string;
  href: string;
  variant?: keyof typeof BUTTON_VARIANT;
  size?: keyof typeof BUTTON_SIZE;
  align?: keyof typeof ALIGN;
  newTab?: boolean;
}) {
  return (
    <div className={ALIGN[align]}>
      <Link
        href={href}
        target={newTab ? "_blank" : undefined}
        rel={newTab ? "noopener noreferrer" : undefined}
        className={clsx(
          "inline-flex items-center justify-center border font-mono font-medium uppercase tracking-[0.14em] transition-colors",
          BUTTON_VARIANT[variant],
          BUTTON_SIZE[size]
        )}
      >
        {label}
      </Link>
    </div>
  );
}

const DIVIDER_WIDTH = {
  full: "w-full",
  reading: "max-w-[760px]",
  half: "w-1/2",
} as const;

const DIVIDER_WEIGHT = {
  hairline: "border-t",
  regular: "border-t-2",
  strong: "border-t-4",
} as const;

export function NativeDivider({
  lineStyle = "solid",
  weight = "hairline",
  width = "full",
}: {
  lineStyle?: "solid" | "dashed" | "dotted";
  weight?: keyof typeof DIVIDER_WEIGHT;
  width?: keyof typeof DIVIDER_WIDTH;
}) {
  return (
    <hr
      className={clsx(
        "m-0 border-x-0 border-b-0 border-mg-bd/25",
        DIVIDER_WEIGHT[weight],
        DIVIDER_WIDTH[width],
        lineStyle === "dashed"
          ? "border-dashed"
          : lineStyle === "dotted"
            ? "border-dotted"
            : "border-solid"
      )}
    />
  );
}

export function NativeSpacer({
  desktop = 64,
  tablet = 48,
  mobile = 32,
}: {
  desktop?: number;
  tablet?: number;
  mobile?: number;
}) {
  const style = {
    "--mg-spacer-desktop": `${desktop}px`,
    "--mg-spacer-tablet": `${tablet}px`,
    "--mg-spacer-mobile": `${mobile}px`,
  } as CSSProperties;

  return (
    <div
      aria-hidden="true"
      style={style}
      className="h-[var(--mg-spacer-mobile)] min-[681px]:h-[var(--mg-spacer-tablet)] min-[1025px]:h-[var(--mg-spacer-desktop)]"
    />
  );
}
