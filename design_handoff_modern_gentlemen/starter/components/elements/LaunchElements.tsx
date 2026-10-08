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
const within = (n: unknown, min: number, max: number, fallback: number) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;

export function LaunchSocial({
  links = [],
  style = "icons",
  size = 22,
  gap = 24,
  color,
  align = "center",
}: {
  links?: { network: string; href: string; label: string }[];
  style?: "icons" | "text" | "both";
  size?: number;
  gap?: number;
  color?: string;
  align?: "left" | "center" | "right";
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
        } as CSSProperties
      }
    >
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
}: {
  variant?: "wordmark" | "monogram" | "seal";
  size?: number;
  label?: string;
  href?: string;
  color?: string;
  accentColor?: string;
  sealText?: string;
  align?: "left" | "center" | "right";
}) {
  const ringId = `ring${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const vars = {
    "--lg-size": `${within(size, 8, 600, 32)}px`,
    ...colour(color, "--lg-color"),
    ...colour(accentColor, "--lg-accent"),
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
  size = 320,
  cover = true,
  font = "theme:heading",
  weight = "700",
  letterSpacing = -0.04,
  align = "center",
}: {
  text?: string;
  panel?: "light" | "dark";
  size?: number;
  cover?: boolean;
  font?: string;
  weight?: string;
  letterSpacing?: number;
  align?: "left" | "center" | "right";
}) {
  const light = panel !== "dark";
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
            "--ko-panel": light ? "#f4f4f4" : "#0d0d0d",
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

export function LaunchShape({
  shape = "rectangle",
  fill = "#c8102e",
  opacity = 100,
  height = 200,
  blur = 0,
  radius = 0,
  stroke = 2,
}: {
  shape?: "rectangle" | "circle" | "ring" | "line";
  fill?: string;
  opacity?: number;
  height?: number;
  blur?: number;
  radius?: number;
  stroke?: number;
}) {
  const b = within(blur, 0, 80, 0);
  return (
    <div
      aria-hidden="true"
      className={styles.shape}
      data-shape={shape}
      data-blur={b > 0 ? "true" : undefined}
      style={
        {
          "--sh-fill": HEX.test(fill) ? fill : "#c8102e",
          "--sh-opacity": within(opacity, 0, 100, 100) / 100,
          "--sh-height": `${within(height, 1, 4000, 200)}px`,
          "--sh-blur": `${b}px`,
          "--sh-radius": `${within(radius, 0, 2000, 0)}px`,
          "--sh-stroke": `${within(stroke, 0, 80, 2)}px`,
        } as CSSProperties
      }
    />
  );
}
