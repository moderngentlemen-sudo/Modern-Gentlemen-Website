import type { CSSProperties, ReactNode } from "react";

import { stageVariables, type ResponsiveStage } from "@/lib/blocks/stage";
import { MediaImage } from "../ui/MediaImage";
import { StageVideo } from "./StageVideo";
import styles from "./StageLayout.module.css";

export type StageHeight = "screen" | "half" | "16x9" | "16x10" | "4x3" | "21x9";
export type StageShade = "even" | "vignette" | "bottom" | "left" | "none";

export interface StageProps {
  video?: string;
  image?: string;
  color?: string;
  scrim?: number;
  scrimColor?: string;
  grain?: "none" | "subtle" | "strong";
  zoom?: "none" | "in" | "out";
  glowColor?: string;
  glowStrength?: number;
  glowPosition?: "top" | "bottom" | "left" | "right" | "center";
  bars?: number;
  intro?: "none" | "fade" | "rise" | "blur" | "wipe";
  introPace?: "quick" | "measured" | "slow";
  shade?: StageShade;
  monochrome?: number;
  focusX?: number;
  focusY?: number;
  tone?: "light" | "dark" | "theme";
  height?: StageHeight;
  mobileLayout?: "stack" | "free";
  mobileAlign?: "start" | "center" | "end";
  mobileGap?: number;
  standalone?: boolean;
  children?: ReactNode;
}

const JUSTIFY = { start: "flex-start", center: "center", end: "flex-end" } as const;
const clampPct = (n: number | undefined, fallback: number) =>
  Math.min(100, Math.max(0, typeof n === "number" && Number.isFinite(n) ? n : fallback));

/**
 * A full-bleed composition surface: background video or still with a shade,
 * and elements placed anywhere on it (see `StageCell`). The editor renders the
 * same component, so what an editor drags is what the site shows.
 */
const HEX = /^#[0-9a-f]{6}$/i;
const INTROS: readonly string[] = ["fade", "rise", "blur", "wipe"];
const INTRO_STEP = { quick: "90ms", measured: "160ms", slow: "280ms" } as const;
const GLOW_AT = {
  top: "50% -10%",
  bottom: "50% 110%",
  left: "-10% 50%",
  right: "110% 50%",
  center: "50% 50%",
} as const;

/** `#rrggbb` as `r g b`, for `rgb(var(--x) / alpha)`. */
const hexChannels = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${n >> 16} ${(n >> 8) & 255} ${n & 255}`;
};

export function StageLayout({
  video = "",
  image = "",
  color = "#0d0d0d",
  scrim = 35,
  scrimColor,
  grain = "none",
  zoom = "none",
  glowColor = "#c8102e",
  glowStrength = 0,
  glowPosition = "bottom",
  bars = 0,
  intro = "none",
  introPace = "measured",
  shade = "even",
  monochrome = 0,
  focusX = 50,
  focusY = 50,
  tone = "light",
  height = "screen",
  mobileLayout = "stack",
  mobileAlign = "center",
  mobileGap = 24,
  standalone = false,
  children,
}: StageProps) {
  const glow = clampPct(glowStrength, 0);
  const letterbox = Math.min(15, Math.max(0, Number.isFinite(bars) ? bars : 0));
  const introOn = INTROS.includes(intro);
  const style = {
    "--stage-color": /^#[0-9a-f]{6}$/i.test(color) ? color : "#0d0d0d",
    "--stage-scrim": clampPct(scrim, 35) / 100,
    ...(scrimColor && /^#[0-9a-f]{6}$/i.test(scrimColor)
      ? { "--stage-scrim-rgb": hexChannels(scrimColor) }
      : {}),
    "--stage-mono": `${clampPct(monochrome, 0)}%`,
    "--stage-focus-x": `${clampPct(focusX, 50)}%`,
    "--stage-focus-y": `${clampPct(focusY, 50)}%`,
    "--stage-stack-justify": JUSTIFY[mobileAlign] ?? "center",
    "--stage-stack-gap": `${Math.min(120, Math.max(0, mobileGap))}px`,
    ...(glow > 0
      ? {
          "--stage-glow-rgb": hexChannels(HEX.test(glowColor) ? glowColor : "#c8102e"),
          "--stage-glow": glow / 100,
          "--stage-glow-at": GLOW_AT[glowPosition] ?? GLOW_AT.bottom,
        }
      : {}),
    ...(letterbox > 0 ? { "--stage-bars": `${letterbox}%` } : {}),
    ...(introOn ? { "--stage-intro-step": INTRO_STEP[introPace] ?? INTRO_STEP.measured } : {}),
  } as CSSProperties;
  return (
    <section
      className={styles.stage}
      style={style}
      data-stage-layout=""
      data-darkband={tone === "light" ? "" : undefined}
      data-stage-tone={tone}
      data-coming-soon-standalone={standalone ? "true" : undefined}
      data-zoom={zoom === "in" || zoom === "out" ? zoom : undefined}
      data-bars={letterbox > 0 ? "" : undefined}
    >
      {video ? (
        <StageVideo src={video} poster={image} className={styles.media} />
      ) : image ? (
        <div className={styles.posterBox} aria-hidden="true">
          <MediaImage src={image} alt="" slot="fullBleed" priority />
        </div>
      ) : null}
      {(video || image) && <div className={styles.shade} data-shade={shade} aria-hidden="true" />}
      {glow > 0 && <div className={styles.glow} aria-hidden="true" />}
      <div
        className={styles.layer}
        data-height={height}
        data-mobile={mobileLayout}
        data-intro={introOn ? intro : undefined}
      >
        {children}
      </div>
      {(grain === "subtle" || grain === "strong") && (
        <div className={styles.grain} data-grain={grain} aria-hidden="true" />
      )}
    </section>
  );
}

/** One placed element. The public renderer and the editor canvas both use these classes. */
export function StageCell({
  stage,
  index,
  children,
}: {
  stage?: ResponsiveStage;
  index: number;
  children: ReactNode;
}) {
  return (
    <div
      className={styles.cell}
      data-stage-cell=""
      style={{ ...stageVariables(stage, { index }), "--cell-i": index } as CSSProperties}
    >
      <div className={styles.inner}>{children}</div>
    </div>
  );
}

export const stageCellClass = styles.cell;
export const stageInnerClass = styles.inner;
