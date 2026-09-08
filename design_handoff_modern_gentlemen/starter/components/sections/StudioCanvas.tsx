import type { CSSProperties, ReactNode } from "react";
import { libraryFontStack, libraryFontStylesheet } from "@/lib/domain/fontLibrary";
import { studioColor, studioGradient } from "@/lib/blocks/studioPublishing";
import { MediaImage } from "../ui/MediaImage";
import styles from "./StudioCanvas.module.css";

type Props = Record<string, unknown>;
function num(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function string(value: unknown) {
  return typeof value === "string" ? value : undefined;
}
export function StudioCanvas({ children, ...p }: Props & { children?: ReactNode }) {
  const width = num(p.width, 760);
  return (
    <div className={styles.canvas}>
      <section
        id={string(p.sectionId)}
        className={styles.section}
        style={{
          height: `${(num(p.height, 480) / width) * 100}cqw`,
          background: studioGradient(p.gradient) || studioColor(p.color),
        }}
      >
        {children}
      </section>
    </div>
  );
}
export function StudioElement(p: Props) {
  const width = num(p.canvasWidth, 760),
    unit = (v: unknown, fallback = 0) => `${(num(v, fallback) / width) * 100}cqw`;
  const font = string(p.fontFamily),
    stylesheet = libraryFontStylesheet(font);
  const style: CSSProperties = {
    left: unit(p.x),
    top: unit(p.y),
    width: unit(p.w, 100),
    height: unit(p.h, 40),
    fontFamily: libraryFontStack(font),
    fontSize: unit(p.size, 22),
    color: studioColor(p.color),
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
  if (p.kind === "button") {
    Object.assign(style, {
      padding: unit(10),
      background: studioColor(p.fill),
      border: `${unit(p.borderWidth)} solid ${studioColor(p.borderColor) || "transparent"}`,
      borderRadius: unit(p.radius),
    });
    element = (
      <a className={`${styles.element} ${styles.button}`} style={style} href={string(p.href)}>
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
            background: studioColor(p.color),
          }}
        />
      </div>
    );
  } else if (p.kind === "image") {
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
      <div className={styles.element} style={{ ...style, overflow: "hidden" }}>
        <div className={styles.image} style={imageStyle}>
          {string(p.src) && (
            <MediaImage src={string(p.src)!} alt={string(p.alt) || ""} slot="fullBleed" />
          )}
        </div>
      </div>
    );
  } else
    element = (
      <div className={styles.element} style={style}>
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
