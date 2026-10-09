"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

import { libraryFontStack } from "@/lib/domain/fontLibrary";
import { FontStylesheet } from "../ui/FontStylesheet";
import styles from "./LaunchElements.module.css";

const HEX = /^#[0-9a-f]{6}$/i;
/**
 * How far the mask and the cover panel reach past the letters' own box: half a
 * box on every side. That cuts out letters that overhang their box (a long
 * headline on a narrow screen), and the panel overlaps the wrapper's
 * box-shadow instead of meeting it at an antialiased hairline.
 */
const REACH = { x: "-50%", y: "-50%", width: "200%", height: "200%" } as const;
const BOX = { x: "0", y: "0", width: "100%", height: "100%" } as const;
const within = (n: unknown, min: number, max: number, fallback: number) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;

export interface LaunchKnockoutProps {
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
  letters?: "cutout" | "tinted" | "outline" | "solid";
  letterColor?: string;
  letterStrength?: number;
  outlineWidth?: number;
}

/**
 * Splits the rendered paragraph into the lines the browser actually laid out,
 * so the mask can draw each one where the real text sits. Explicit line breaks
 * are the only split available before the first layout (and on the server).
 */
function measureLines(p: HTMLElement): string[] | null {
  const node = p.firstChild;
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  const text = node.textContent ?? "";
  const range = document.createRange();
  if (typeof range.getClientRects !== "function") return null;
  const lines: string[] = [];
  let current = "";
  let top: number | null = null;
  for (let i = 0; i < text.length; i += 1) {
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    const rect = range.getClientRects()[0];
    // A character more than half its own height below the line's top starts a new line.
    if (rect && rect.width > 0 && text[i].trim()) {
      if (top === null) top = rect.top;
      else if (rect.top - top > rect.height * 0.5) {
        lines.push(current.trim());
        current = "";
        top = rect.top;
      }
    }
    current += text[i];
  }
  lines.push(current.trim());
  return lines.filter(Boolean);
}

/**
 * Giant letters cut out of a solid panel so the stage's video or photograph
 * shows through them.
 *
 * ⚠️ The cut-out is an SVG mask, not a blend mode. It was a blend (screen or
 * multiply), and Safari on iPad and iPhone does not blend a page element with
 * a playing <video>: the letters stayed filled. A mask needs no blending, so
 * it works everywhere, and the panel can be any colour exactly.
 *
 * The real text stays in the page, transparent, for layout and for screen
 * readers; the SVG over it draws the panel with the letters masked out, and
 * the box-shadow on the wrapper extends the panel across the stage. Solid
 * letters need no mask and render as ordinary text on the panel.
 */
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
  letters = "cutout",
  letterColor = "#c8102e",
  letterStrength = 60,
  outlineWidth = 3,
}: LaunchKnockoutProps) {
  const id = `ko${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const ref = useRef<HTMLParagraphElement>(null);
  const [lines, setLines] = useState<string[]>(() => text.split("\n"));
  const mode = (["tinted", "outline", "solid"] as const).find((m) => m === letters) ?? "cutout";
  const custom = panelColor && HEX.test(panelColor) ? panelColor : undefined;
  const fill = custom ?? (panel === "dark" ? "#0d0d0d" : "#f4f4f4");
  const tint = HEX.test(letterColor) ? letterColor : "#c8102e";
  const fade = within(panelOpacity, 0, 100, 100);
  const fontStack = libraryFontStack(font) ?? "var(--font-heading)";

  useEffect(() => {
    const p = ref.current;
    if (!p || mode === "solid") return;
    const update = () => {
      const measured = measureLines(p);
      if (!measured) return;
      setLines((prev) =>
        prev.length === measured.length && prev.every((l, i) => l === measured[i]) ? prev : measured
      );
    };
    update();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(update) : null;
    observer?.observe(p);
    document.fonts?.ready.then(update).catch(() => {});
    return () => observer?.disconnect();
  }, [text, mode, font, size, weight, letterSpacing]);

  const anchor = align === "left" ? "start" : align === "right" ? "end" : "middle";
  const x = align === "left" ? "0" : align === "right" ? "100%" : "50%";
  const textStyle: CSSProperties = {
    fontFamily: fontStack,
    fontSize: "var(--ko-fs)",
    fontWeight: Number(/^[1-9]00$/.test(weight) ? weight : "700"),
    letterSpacing: `${within(letterSpacing, -0.2, 1, -0.04)}em`,
  };
  const lineTexts = (props: {
    fill: string;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
  }) =>
    lines.map((line, i) => (
      <text
        key={i}
        x={x}
        y={`${((i + 0.5) / lines.length) * 100}%`}
        textAnchor={anchor}
        dominantBaseline="central"
        style={textStyle}
        {...props}
      >
        {line}
      </text>
    ));

  return (
    <div
      className={styles.knockoutBox}
      data-knockout={mode === "solid" ? "none" : "mask"}
      data-letters={mode === "cutout" ? undefined : mode}
      data-cover={cover ? "true" : "false"}
      style={
        {
          "--ko-font": fontStack,
          "--ko-size": `${within(size, 20, 1200, 320)}px`,
          "--ko-weight": /^[1-9]00$/.test(weight) ? weight : "700",
          "--ko-tracking": `${within(letterSpacing, -0.2, 1, -0.04)}em`,
          "--ko-panel": fill,
          "--ko-ink": mode === "solid" ? tint : "transparent",
          ...(fade < 100 ? { opacity: fade / 100 } : {}),
          textAlign: align,
        } as CSSProperties
      }
    >
      <FontStylesheet font={font} />
      <p ref={ref} className={styles.knockout}>
        {text}
      </p>
      {mode !== "solid" && (
        <svg className={styles.knockoutMask} aria-hidden="true" focusable="false">
          <defs>
            <mask id={id} maskUnits="userSpaceOnUse" {...REACH}>
              <rect {...REACH} fill="#fff" />
              {mode === "outline"
                ? lineTexts({
                    fill: "#fff",
                    stroke: "#000",
                    strokeWidth: within(outlineWidth, 1, 40, 3),
                  })
                : lineTexts({ fill: "#000" })}
            </mask>
          </defs>
          <rect {...(cover ? REACH : BOX)} fill={fill} mask={`url(#${id})`} />
          {mode === "tinted" &&
            lineTexts({ fill: tint, opacity: within(letterStrength, 0, 100, 60) / 100 })}
        </svg>
      )}
    </div>
  );
}
