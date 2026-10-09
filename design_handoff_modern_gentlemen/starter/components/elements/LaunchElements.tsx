import { useId, type CSSProperties } from "react";

import { studyHref } from "@/lib/blocks/sectionStudies";
import { libraryFontStack } from "@/lib/domain/fontLibrary";
import { SocialIcon } from "../sections/AfterHoursLanding";
import { MgMonogram } from "../sections/MgMonogram";
import { FontStylesheet } from "../ui/FontStylesheet";
import styles from "./LaunchElements.module.css";

export { LaunchCountdown } from "./LaunchCountdown";
export { LaunchSignup } from "./LaunchSignup";

const HEX = /^#[0-9a-f]{6}$/i;
const JUSTIFY = { left: "flex-start", center: "center", right: "flex-end" } as const;
const colour = (value: string | undefined, name: string) =>
  value && HEX.test(value) ? { [name]: value } : {};
/** An element's own font: `--el-font` on its root, read by its CSS with the theme role as fallback. */
const fontVar = (font: string | undefined): Record<string, string> => {
  const stack = libraryFontStack(font);
  return stack ? { "--el-font": stack } : {};
};
/** Relative luminance of `#rrggbb`, 0 (black) to 1 (white). */
function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
const within = (n: unknown, min: number, max: number, fallback: number) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;

export function LaunchSocial({
  links = [],
  style = "icons",
  size = 22,
  gap = 24,
  color,
  align = "center",
  font,
}: {
  links?: { network: string; href: string; label: string }[];
  style?: "icons" | "text" | "both";
  size?: number;
  gap?: number;
  color?: string;
  align?: "left" | "center" | "right";
  font?: string;
}) {
  const safe = links.filter((link) => studyHref(link.href));
  if (safe.length === 0) return null;
  return (
    <nav
      aria-label="Social media"
      className={styles.social}
      style={
        {
          gap: `${within(gap, 0, 160, 24)}px`,
          justifyContent: JUSTIFY[align] ?? "center",
          "--so-size": `${within(size, 10, 120, 22)}px`,
          ...colour(color, "--so-color"),
          ...fontVar(font),
        } as CSSProperties
      }
    >
      <FontStylesheet font={font} />
      {safe.map((link, index) => (
        <a
          key={`${link.network}-${index}`}
          href={studyHref(link.href)}
          aria-label={style === "text" ? undefined : link.label || link.network}
        >
          {style !== "text" && <SocialIcon network={link.network} />}
          {style !== "icons" && <span>{link.label || link.network}</span>}
        </a>
      ))}
    </nav>
  );
}

export function LaunchLogo({
  variant = "wordmark",
  size = 32,
  label = "Modern Gentlemen",
  href,
  color,
  accentColor = "#c8102e",
  sealText = "MODERN GENTLEMEN · COMING SOON · ",
  align = "left",
  font,
}: {
  variant?: "wordmark" | "monogram" | "seal";
  size?: number;
  label?: string;
  href?: string;
  color?: string;
  accentColor?: string;
  sealText?: string;
  align?: "left" | "center" | "right";
  font?: string;
}) {
  const ringId = `ring${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const vars = {
    "--lg-size": `${within(size, 8, 600, 32)}px`,
    ...colour(color, "--lg-color"),
    ...colour(accentColor, "--lg-accent"),
    ...(variant === "seal" ? fontVar(font) : {}),
    justifyContent: JUSTIFY[align] ?? "flex-start",
  } as CSSProperties;
  const mark =
    variant === "seal" ? (
      <span className={styles.seal}>
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <defs>
            <path id={ringId} d="M100,100 m-82,0 a82,82 0 1,1 164,0 a82,82 0 1,1 -164,0" />
          </defs>
          <text>
            <textPath href={`#${ringId}`} textLength="510">
              {sealText}
            </textPath>
          </text>
        </svg>
        <span className={styles.sealMark}>
          <i className={styles.bar} aria-hidden="true" />
          <MgMonogram title={label || "Modern Gentlemen"} />
        </span>
      </span>
    ) : (
      <>
        {variant === "wordmark" && <i className={styles.bar} aria-hidden="true" />}
        <MgMonogram title={label || "Modern Gentlemen"} />
      </>
    );
  const link = studyHref(href);
  return (
    <div className={styles.logo} style={vars}>
      {variant === "seal" && <FontStylesheet font={font} />}
      {link ? (
        <a href={link} aria-label={label || "Modern Gentlemen"}>
          {mark}
        </a>
      ) : (
        <span>{mark}</span>
      )}
    </div>
  );
}

export function LaunchKnockout({
  text = "SOON",
  panel = "light",
  panelColor,
  panelOpacity = 100,
  size = 320,
  cover = true,
  font = "theme:heading",
  weight = "700",
  letterSpacing = -0.04,
  align = "center",
}: {
  text?: string;
  panel?: "light" | "dark";
  panelColor?: string;
  panelOpacity?: number;
  size?: number;
  cover?: boolean;
  font?: string;
  weight?: string;
  letterSpacing?: number;
  align?: "left" | "center" | "right";
}) {
  const custom = panelColor && HEX.test(panelColor) ? panelColor : undefined;
  // The letters are cut out by a blend, not a mask: a pale panel lightens
  // (screen, black letters vanish) and a deep one darkens (multiply, white
  // letters vanish). A custom colour picks whichever its lightness suits.
  const light = custom ? luminance(custom) > 0.4 : panel !== "dark";
  const fade = within(panelOpacity, 0, 100, 100);
  return (
    <>
      <FontStylesheet font={font} />
      <p
        className={styles.knockout}
        data-knockout={light ? "screen" : "multiply"}
        data-cover={cover ? "true" : "false"}
        style={
          {
            "--ko-font": libraryFontStack(font) ?? "var(--font-heading)",
            "--ko-size": `${within(size, 20, 1200, 320)}px`,
            "--ko-weight": /^[1-9]00$/.test(weight) ? weight : "700",
            "--ko-tracking": `${within(letterSpacing, -0.2, 1, -0.04)}em`,
            "--ko-panel": custom ?? (light ? "#f4f4f4" : "#0d0d0d"),
            ...(fade < 100 ? { opacity: fade / 100 } : {}),
            "--ko-ink": light ? "#000000" : "#ffffff",
            textAlign: align,
          } as CSSProperties
        }
      >
        {text}
      </p>
    </>
  );
}

const SHADOWS = {
  soft: "0 12px 40px rgba(0, 0, 0, 0.28)",
  strong: "0 24px 80px rgba(0, 0, 0, 0.55)",
} as const;
const BLENDS = ["multiply", "screen", "overlay", "soft-light", "color"] as const;
type Blend = (typeof BLENDS)[number];

/** `#rrggbb` at an alpha, as `rgba()`: a hex colour cannot carry its own opacity. */
function alpha(hex: string, percent: number) {
  if (percent >= 100) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${percent / 100})`;
}

export function LaunchShape({
  shape = "rectangle",
  fill = "#c8102e",
  fillOpacity = 100,
  opacity = 100,
  blur = 0,
  saturation = 100,
  height = 200,
  radius = 0,
  fill2,
  gradientAngle = 180,
  fill2Opacity = 100,
  borderColor,
  stroke = 2,
  shadow = "none",
  blend = "normal",
  sheen = false,
}: {
  shape?: "rectangle" | "circle" | "ring" | "line";
  fill?: string;
  fillOpacity?: number;
  opacity?: number;
  blur?: number;
  saturation?: number;
  height?: number;
  radius?: number;
  fill2?: string;
  gradientAngle?: number;
  fill2Opacity?: number;
  borderColor?: string;
  stroke?: number;
  shadow?: "none" | "soft" | "strong";
  blend?: "normal" | Blend;
  sheen?: boolean;
}) {
  const b = within(blur, 0, 80, 0);
  const sat = within(saturation, 0, 300, 100);
  const colour = HEX.test(fill) ? fill : "#c8102e";
  const from = alpha(colour, within(fillOpacity, 0, 100, 100));
  const background =
    fill2 && HEX.test(fill2)
      ? `linear-gradient(${within(gradientAngle, 0, 360, 180)}deg, ${from}, ${alpha(fill2, within(fill2Opacity, 0, 100, 100))})`
      : from;
  const outline = shape !== "ring" && shape !== "line" && borderColor && HEX.test(borderColor);
  const mode = (BLENDS as readonly string[]).includes(blend) ? (blend as Blend) : undefined;
  return (
    <div
      aria-hidden="true"
      className={styles.shape}
      data-shape={shape}
      data-blur={b > 0 || sat !== 100 ? "true" : undefined}
      data-blend={mode}
      data-sheen={sheen && shape !== "ring" ? "true" : undefined}
      style={
        {
          "--sh-fill": colour,
          "--sh-bg": background,
          "--sh-opacity": within(opacity, 0, 100, 100) / 100,
          "--sh-height": `${within(height, 1, 4000, 200)}px`,
          "--sh-blur": `${b}px`,
          "--sh-saturate": `${sat}%`,
          "--sh-radius": `${within(radius, 0, 2000, 0)}px`,
          "--sh-stroke": `${within(stroke, 0, 80, 2)}px`,
          ...(outline
            ? { "--sh-border": `${within(stroke, 0, 80, 2)}px solid ${borderColor}` }
            : {}),
          ...(shadow === "soft" || shadow === "strong" ? { "--sh-shadow": SHADOWS[shadow] } : {}),
        } as CSSProperties
      }
    />
  );
}
