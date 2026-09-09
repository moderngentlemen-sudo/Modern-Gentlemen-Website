import type { CSSProperties, ReactNode } from "react";
import { libraryFontStack, libraryFontStylesheet } from "@/lib/domain/fontLibrary";
import { studioGradient } from "@/lib/blocks/studioValues";
import type { StudioMegaMenuConfig, StudioVideoOptions } from "@/lib/blocks/studioFeatures";
import { StudioMegaMenu } from "./StudioMegaMenu";
import { StudioVideo } from "./StudioVideo";
import { MediaImage } from "../ui/MediaImage";
import { isStudioWidgetKind } from "@/lib/blocks/studioWidgets";
import { StudioWidget } from "./StudioWidgets";
import styles from "./StudioCanvas.module.css";
import { studioPixels } from "@/lib/blocks/studioSizing";

import {
  studioThemeColor,
  studioThemeGradient,
  studioAdaptiveGradient,
  studioThemeInk,
  studioAdaptiveSurface,
  studioFixedFill,
} from "@/lib/blocks/studioTheme";

type Props = Record<string, unknown>;
function num(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function string(value: unknown) {
  return typeof value === "string" ? value : undefined;
}
export function StudioCanvas({ children, ...p }: Props & { children?: ReactNode }) {
  const width = num(p.width, 760);
  const theme = (
    studioGradient(p.gradient) ? studioAdaptiveGradient(p.gradient) : studioAdaptiveSurface(p.color)
  )
    ? "adaptive"
    : "fixed";
  return (
    <div
      className={styles.surface}
      data-studio-surface={string(p.sectionId)}
      data-studio-theme={theme}
      style={{ background: studioThemeGradient(p.gradient) || studioThemeColor(p.color) }}
    >
      <div className={styles.canvas}>
        <section
          id={string(p.sectionId)}
          data-studio-theme={theme}
          className={styles.section}
          style={{
            height: studioPixels(num(p.height, 480)),
          }}
        >
          {!!p.megaMenu && (
            <StudioMegaMenu
              config={p.megaMenu as StudioMegaMenuConfig}
              width={width}
              mobile={!!p.mobile}
            />
          )}
          {children}
        </section>
      </div>
    </div>
  );
}
export function StudioElement(p: Props) {
  const width = num(p.canvasWidth, 760),
    horizontal = (v: unknown, fallback = 0) => `${(num(v, fallback) / width) * 100}cqw`,
    unit = (v: unknown, fallback = 0) => studioPixels(num(v, fallback));
  const font = string(p.fontFamily),
    stylesheet = libraryFontStylesheet(font);
  const style: CSSProperties = {
    left: horizontal(p.x),
    top: unit(p.y),
    width: horizontal(p.w, 100),
    height: unit(p.h, 40),
    fontFamily: libraryFontStack(font),
    fontSize: unit(p.size, 22),
    color: studioThemeInk(p.color),
    fontWeight: num(p.weight, 400),
    fontStyle: p.italic ? "italic" : "normal",
    textDecoration: p.underline ? "underline" : "none",
    lineHeight: num(p.leading, 1.1),
    letterSpacing: unit(p.tracking),
    textTransform: p.uppercase ? "uppercase" : "none",
    textAlign: p.align === "center" || p.align === "right" ? p.align : "left",
    justifyContent:
      p.align === "center" ? "center" : p.align === "right" ? "flex-end" : "flex-start",
  };
  let element: ReactNode;
  if (typeof p.kind === "string" && isStudioWidgetKind(p.kind)) {
    element = (
      <div
        className={styles.element}
        data-studio-fixed-palette={studioFixedFill(p.fill) || undefined}
        style={style}
      >
        <StudioWidget {...p} kind={p.kind} />
      </div>
    );
  } else if (p.kind === "button") {
    Object.assign(style, {
      padding: unit(10),
      background: studioThemeColor(p.fill),
      border: `${unit(p.borderWidth)} solid ${studioThemeInk(p.borderColor) || "transparent"}`,
      borderRadius: unit(p.radius),
    });
    element = (
      <a
        className={`${styles.element} ${styles.button}`}
        data-studio-fixed-palette={studioFixedFill(p.fill) || undefined}
        style={style}
        href={string(p.href)}
        target={p.newTab ? "_blank" : undefined}
        rel={p.newTab ? "noopener noreferrer" : undefined}
      >
        {string(p.text)}
      </a>
    );
  } else if (p.kind === "divider") {
    element = (
      <div
        className={styles.element}
        style={style}
        role="separator"
        aria-orientation={p.vertical ? "vertical" : "horizontal"}
      >
        <span
          style={{
            display: "block",
            width: p.vertical ? unit(p.thickness, 2) : "100%",
            height: p.vertical ? "100%" : unit(p.thickness, 2),
            background: studioThemeInk(p.color),
          }}
        />
      </div>
    );
  } else if (p.kind === "image" || p.kind === "video") {
    const imageStyle = {
      borderRadius: unit(p.radius),
      opacity: num(p.opacity, 100) / 100,
      filter: `brightness(${num(p.brightness, 100)}%) contrast(${num(p.contrast, 100)}%)`,
      transform: `scale(${num(p.cropZoom, 100) / 100})`,
      transformOrigin: `${num(p.focalX, 50)}% ${num(p.focalY, 50)}%`,
      "--studio-fit": p.fit === "contain" ? "contain" : "cover",
      "--studio-focal": `${num(p.focalX, 50)}% ${num(p.focalY, 50)}%`,
    } as CSSProperties;
    element = (
      <div
        className={styles.element}
        style={{ ...style, overflow: "hidden", borderRadius: unit(p.radius) }}
      >
        {p.kind === "video" ? (
          <StudioVideo
            src={string(p.src) || ""}
            poster={string(p.poster)}
            label={string(p.alt) || "Video"}
            options={p.video as StudioVideoOptions | undefined}
            mediaStyle={imageStyle}
          />
        ) : (
          <div className={styles.image} style={imageStyle}>
            {string(p.src) && (
              <MediaImage src={string(p.src)!} alt={string(p.alt) || ""} slot="fullBleed" />
            )}
          </div>
        )}
      </div>
    );
  } else
    element = (
      <div
        className={styles.element}
        data-studio-fixed-palette={studioFixedFill(p.fill) || undefined}
        style={style}
      >
        <div className={styles.text}>{string(p.text)}</div>
      </div>
    );
  return (
    <>
      {stylesheet && <link rel="stylesheet" href={stylesheet} />}
      {element}
    </>
  );
}
