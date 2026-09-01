/**
 * Visual-engine vocabulary shared by persistence, validation, the editor and
 * the renderer. Every value is bounded: the renderer turns this data into CSS,
 * so accepting arbitrary strings here would create both broken layouts and a
 * stored stylesheet-injection boundary.
 */

export const VISUAL_BREAKPOINTS = ["desktop", "tablet", "mobile"] as const;
export type VisualBreakpoint = (typeof VISUAL_BREAKPOINTS)[number];

export const VISUAL_DISPLAYS = ["block", "flex", "grid"] as const;
export const VISUAL_DIRECTIONS = ["row", "column"] as const;
export const VISUAL_ALIGNS = ["start", "center", "end", "stretch"] as const;
export const VISUAL_JUSTIFIES = ["start", "center", "end", "between", "around"] as const;
export const VISUAL_WIDTHS = ["auto", "full", "fit"] as const;
export const VISUAL_POSITIONS = ["relative", "absolute", "sticky"] as const;
export const VISUAL_MAX_WIDTHS = ["none", "reading", "content", "wide"] as const;
export const VISUAL_MIN_HEIGHTS = ["auto", "half-screen", "screen"] as const;
export const VISUAL_SPACES = [0, 8, 16, 24, 32, 48, 64, 80, 120] as const;
export const VISUAL_BACKGROUNDS = ["transparent", "page", "surface", "dark", "accent"] as const;
export const VISUAL_COLORS = ["inherit", "foreground", "muted", "accent", "light"] as const;
export const VISUAL_BORDERS = ["none", "hairline", "strong", "accent"] as const;
export const VISUAL_RADII = ["sharp", "subtle", "rounded", "pill"] as const;
export const VISUAL_SHADOWS = ["none", "subtle", "elevated", "dramatic"] as const;
export const VISUAL_OPACITIES = [25, 50, 75, 100] as const;
export const VISUAL_OVERFLOWS = ["visible", "hidden", "auto"] as const;
export const VISUAL_HOVERS = ["none", "lift", "scale", "glow", "fade"] as const;
export const VISUAL_MOTIONS = ["instant", "snappy", "smooth", "gentle"] as const;
export const VISUAL_STYLE_CLASS_ID = /^[a-z][a-z0-9-]{0,39}$/;

export interface VisualStyle {
  display?: (typeof VISUAL_DISPLAYS)[number];
  direction?: (typeof VISUAL_DIRECTIONS)[number];
  columns?: 1 | 2 | 3 | 4 | 5 | 6;
  align?: (typeof VISUAL_ALIGNS)[number];
  justify?: (typeof VISUAL_JUSTIFIES)[number];
  width?: (typeof VISUAL_WIDTHS)[number];
  /** Precise dimensions, bounded and emitted only when explicitly set. */
  widthPercent?: number;
  widthPx?: number;
  heightPx?: number;
  maxWidthPx?: number;
  minHeightPx?: number;
  maxWidth?: (typeof VISUAL_MAX_WIDTHS)[number];
  minHeight?: (typeof VISUAL_MIN_HEIGHTS)[number];
  gap?: (typeof VISUAL_SPACES)[number];
  paddingX?: (typeof VISUAL_SPACES)[number];
  paddingY?: (typeof VISUAL_SPACES)[number];
  marginTop?: (typeof VISUAL_SPACES)[number];
  marginBottom?: (typeof VISUAL_SPACES)[number];
  background?: (typeof VISUAL_BACKGROUNDS)[number];
  color?: (typeof VISUAL_COLORS)[number];
  border?: (typeof VISUAL_BORDERS)[number];
  radius?: (typeof VISUAL_RADII)[number];
  shadow?: (typeof VISUAL_SHADOWS)[number];
  opacity?: (typeof VISUAL_OPACITIES)[number];
  overflow?: (typeof VISUAL_OVERFLOWS)[number];
  position?: (typeof VISUAL_POSITIONS)[number];
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
  zIndex?: number;
}

export interface VisualEffects {
  hover?: (typeof VISUAL_HOVERS)[number];
  motion?: (typeof VISUAL_MOTIONS)[number];
}

export interface VisualElementDesign {
  /** Optional editor-facing name, shown by the hierarchy in a later phase. */
  name?: string;
  /** A reusable class defined by the published global theme. */
  styleClass?: string;
  styles?: Partial<Record<VisualBreakpoint, VisualStyle>>;
  effects?: VisualEffects;
}

type Vocabulary = readonly (string | number)[];

const STYLE_VOCABULARY: Partial<Record<keyof VisualStyle, Vocabulary>> = {
  display: VISUAL_DISPLAYS,
  direction: VISUAL_DIRECTIONS,
  columns: [1, 2, 3, 4, 5, 6],
  align: VISUAL_ALIGNS,
  justify: VISUAL_JUSTIFIES,
  width: VISUAL_WIDTHS,
  position: VISUAL_POSITIONS,
  maxWidth: VISUAL_MAX_WIDTHS,
  minHeight: VISUAL_MIN_HEIGHTS,
  gap: VISUAL_SPACES,
  paddingX: VISUAL_SPACES,
  paddingY: VISUAL_SPACES,
  marginTop: VISUAL_SPACES,
  marginBottom: VISUAL_SPACES,
  background: VISUAL_BACKGROUNDS,
  color: VISUAL_COLORS,
  border: VISUAL_BORDERS,
  radius: VISUAL_RADII,
  shadow: VISUAL_SHADOWS,
  opacity: VISUAL_OPACITIES,
  overflow: VISUAL_OVERFLOWS,
};

const NUMERIC_STYLE_BOUNDS: Partial<Record<keyof VisualStyle, readonly [number, number]>> = {
  widthPercent: [5, 100],
  widthPx: [24, 4000],
  heightPx: [0, 4000],
  maxWidthPx: [24, 4000],
  minHeightPx: [0, 4000],
  top: [-4000, 4000],
  right: [-4000, 4000],
  bottom: [-4000, 4000],
  left: [-4000, 4000],
  zIndex: [-10, 100],
};

export interface VisualDesignIssue {
  path: string;
  message: string;
}

export function validateVisualDesign(value: unknown): VisualDesignIssue[] {
  if (value === undefined) return [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [{ path: "visual", message: "Visual settings must be an object." }];
  }

  const design = value as Record<string, unknown>;
  const issues: VisualDesignIssue[] = [];

  for (const property of Object.keys(design)) {
    if (!["name", "styleClass", "styles", "effects"].includes(property)) {
      issues.push({
        path: `visual.${property}`,
        message: "Unknown visual setting.",
      });
    }
  }

  if (design.name !== undefined && (typeof design.name !== "string" || design.name.length > 80)) {
    issues.push({ path: "visual.name", message: "Element names must be at most 80 characters." });
  }

  if (
    design.styleClass !== undefined &&
    (typeof design.styleClass !== "string" || !VISUAL_STYLE_CLASS_ID.test(design.styleClass))
  ) {
    issues.push({
      path: "visual.styleClass",
      message: "Choose a reusable style class or leave it empty.",
    });
  }

  if (design.styles !== undefined) {
    if (!design.styles || typeof design.styles !== "object" || Array.isArray(design.styles)) {
      issues.push({ path: "visual.styles", message: "Responsive styles must be an object." });
    } else {
      for (const [breakpoint, rawStyle] of Object.entries(design.styles)) {
        if (!(VISUAL_BREAKPOINTS as readonly string[]).includes(breakpoint)) {
          issues.push({
            path: `visual.styles.${breakpoint}`,
            message: "Choose desktop, tablet or mobile.",
          });
          continue;
        }
        if (!rawStyle || typeof rawStyle !== "object" || Array.isArray(rawStyle)) {
          issues.push({
            path: `visual.styles.${breakpoint}`,
            message: "Breakpoint styles must be an object.",
          });
          continue;
        }
        for (const [property, propertyValue] of Object.entries(rawStyle)) {
          const key = property as keyof VisualStyle;
          const bounds = NUMERIC_STYLE_BOUNDS[key];
          const allowed = STYLE_VOCABULARY[key];
          const invalidNumber =
            bounds !== undefined &&
            (typeof propertyValue !== "number" ||
              !Number.isFinite(propertyValue) ||
              propertyValue < bounds[0] ||
              propertyValue > bounds[1]);
          if (
            (bounds && invalidNumber) ||
            (!bounds && (!allowed || !allowed.includes(propertyValue as never)))
          ) {
            issues.push({
              path: `visual.styles.${breakpoint}.${property}`,
              message: `Choose a supported ${property} value.`,
            });
          }
        }
      }
    }
  }

  if (design.effects !== undefined) {
    if (!design.effects || typeof design.effects !== "object" || Array.isArray(design.effects)) {
      issues.push({ path: "visual.effects", message: "Visual effects must be an object." });
    } else {
      const effects = design.effects as Record<string, unknown>;
      for (const property of Object.keys(effects)) {
        if (!["hover", "motion"].includes(property)) {
          issues.push({
            path: `visual.effects.${property}`,
            message: "Unknown visual effect.",
          });
        }
      }
      if (
        effects.hover !== undefined &&
        !(VISUAL_HOVERS as readonly unknown[]).includes(effects.hover)
      ) {
        issues.push({ path: "visual.effects.hover", message: "Choose a supported hover effect." });
      }
      if (
        effects.motion !== undefined &&
        !(VISUAL_MOTIONS as readonly unknown[]).includes(effects.motion)
      ) {
        issues.push({ path: "visual.effects.motion", message: "Choose a supported motion style." });
      }
    }
  }

  return issues;
}

export function hasVisualDesign(value: VisualElementDesign | undefined): boolean {
  if (!value) return false;
  return Boolean(
    value.name ||
    value.styleClass ||
    Object.values(value.styles ?? {}).some((style) => style && Object.keys(style).length > 0) ||
    Object.keys(value.effects ?? {}).length > 0
  );
}

const BACKGROUND: Record<NonNullable<VisualStyle["background"]>, string> = {
  transparent: "transparent",
  page: "var(--mg-bg)",
  surface: "var(--mg-surface)",
  dark: "#0d0d0d",
  accent: "var(--mg-accent)",
};

const COLOR: Record<NonNullable<VisualStyle["color"]>, string> = {
  inherit: "inherit",
  foreground: "var(--mg-fg)",
  muted: "var(--mg-muted)",
  accent: "var(--mg-accent-ink)",
  light: "#f4f4f4",
};

/** Bounded style data to CSS declarations. No user-authored string is emitted. */
export function visualDeclarations(style: VisualStyle | undefined): string {
  if (!style) return "";
  const out: string[] = [];
  if (style.display) out.push(`display:${style.display}`);
  if (style.direction) out.push(`flex-direction:${style.direction}`);
  if (style.columns) out.push(`grid-template-columns:repeat(${style.columns},minmax(0,1fr))`);
  if (style.align)
    out.push(
      `align-items:${style.align === "start" ? "flex-start" : style.align === "end" ? "flex-end" : style.align}`
    );
  if (style.justify) {
    const value =
      style.justify === "start"
        ? "flex-start"
        : style.justify === "end"
          ? "flex-end"
          : style.justify === "between"
            ? "space-between"
            : style.justify === "around"
              ? "space-around"
              : style.justify;
    out.push(`justify-content:${value}`);
  }
  if (style.width)
    out.push(
      `width:${style.width === "full" ? "100%" : style.width === "fit" ? "fit-content" : "auto"}`
    );
  if (style.widthPercent !== undefined) out.push(`width:${style.widthPercent}%`);
  if (style.widthPx !== undefined) out.push(`width:${style.widthPx}px`);
  if (style.heightPx !== undefined) out.push(`height:${style.heightPx}px`);
  if (style.maxWidth) {
    const value =
      style.maxWidth === "reading"
        ? "760px"
        : style.maxWidth === "content"
          ? "var(--layout-content-width)"
          : style.maxWidth === "wide"
            ? "1600px"
            : "none";
    out.push(`max-width:${value}`, "margin-inline:auto");
  }
  if (style.maxWidthPx !== undefined) out.push(`max-width:${style.maxWidthPx}px`);
  if (style.minHeight)
    out.push(
      `min-height:${style.minHeight === "screen" ? "100svh" : style.minHeight === "half-screen" ? "50svh" : "auto"}`
    );
  if (style.minHeightPx !== undefined) out.push(`min-height:${style.minHeightPx}px`);
  if (style.gap !== undefined) out.push(`gap:${style.gap}px`);
  if (style.paddingX !== undefined)
    out.push(`padding-left:${style.paddingX}px`, `padding-right:${style.paddingX}px`);
  if (style.paddingY !== undefined)
    out.push(`padding-top:${style.paddingY}px`, `padding-bottom:${style.paddingY}px`);
  if (style.marginTop !== undefined) out.push(`margin-top:${style.marginTop}px`);
  if (style.marginBottom !== undefined) out.push(`margin-bottom:${style.marginBottom}px`);
  if (style.background) out.push(`background:${BACKGROUND[style.background]}`);
  if (style.color) out.push(`color:${COLOR[style.color]}`);
  if (style.border) {
    const value =
      style.border === "none"
        ? "none"
        : style.border === "hairline"
          ? "1px solid color-mix(in srgb,var(--mg-bd) 18%,transparent)"
          : style.border === "accent"
            ? "1px solid var(--mg-accent)"
            : "1px solid var(--mg-bd)";
    out.push(`border:${value}`);
  }
  if (style.radius) {
    const value =
      style.radius === "subtle"
        ? "4px"
        : style.radius === "rounded"
          ? "12px"
          : style.radius === "pill"
            ? "999px"
            : "0";
    out.push(`border-radius:${value}`);
  }
  if (style.shadow) {
    const value =
      style.shadow === "subtle"
        ? "0 8px 24px rgba(0,0,0,.08)"
        : style.shadow === "elevated"
          ? "0 18px 48px rgba(0,0,0,.16)"
          : style.shadow === "dramatic"
            ? "0 28px 80px rgba(0,0,0,.28)"
            : "none";
    out.push(`box-shadow:${value}`);
  }
  if (style.opacity !== undefined) out.push(`opacity:${style.opacity / 100}`);
  if (style.overflow) out.push(`overflow:${style.overflow}`);
  if (style.position) out.push(`position:${style.position}`);
  if (style.top !== undefined) out.push(`top:${style.top}px`);
  if (style.right !== undefined) out.push(`right:${style.right}px`);
  if (style.bottom !== undefined) out.push(`bottom:${style.bottom}px`);
  if (style.left !== undefined) out.push(`left:${style.left}px`);
  if (style.zIndex !== undefined) out.push(`z-index:${style.zIndex}`);
  return out.join(";");
}

function scopeForKey(key: string): string {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `ve-${(hash >>> 0).toString(36)}`;
}

function rulesForSelector(selector: string, design: VisualElementDesign): string {
  const desktop = visualDeclarations(design.styles?.desktop);
  const tablet = visualDeclarations(design.styles?.tablet);
  const mobile = visualDeclarations(design.styles?.mobile);
  const motion = design.effects?.motion ?? "smooth";
  const duration =
    motion === "instant"
      ? "0s"
      : motion === "snappy"
        ? ".16s"
        : motion === "gentle"
          ? ".55s"
          : ".3s";
  const easing =
    motion === "snappy"
      ? "cubic-bezier(.2,.8,.2,1)"
      : motion === "gentle"
        ? "cubic-bezier(.22,1,.36,1)"
        : "cubic-bezier(.4,0,.2,1)";
  // A local style layered over a class must not silently replace that class's
  // motion timing merely because it changes padding or width. Unclassed
  // elements retain the engine's original smooth-transition baseline.
  const transition =
    !design.styleClass || design.effects?.motion !== undefined
      ? `transition:transform ${duration} ${easing},opacity ${duration} ${easing},box-shadow ${duration} ${easing}`
      : "";
  const desktopRule = [desktop, transition].filter(Boolean).join(";");
  const rules = [`${selector}{${desktopRule}}`];
  if (tablet) rules.push(`@media(max-width:1024px){${selector}{${tablet}}}`);
  if (mobile) rules.push(`@media(max-width:680px){${selector}{${mobile}}}`);

  const hover = design.effects?.hover;
  if (hover && hover !== "none") {
    const declaration =
      hover === "lift"
        ? "transform:translateY(-4px)"
        : hover === "scale"
          ? "transform:scale(1.025)"
          : hover === "glow"
            ? "box-shadow:0 18px 55px rgba(200,16,46,.24)"
            : "opacity:.72";
    rules.push(`${selector}:hover{${declaration}}`);
  }
  return rules.join("");
}

export function visualCss(
  key: string,
  design: VisualElementDesign
): { scope: string; css: string } {
  const scope = scopeForKey(key);
  // Two attributes deliberately outrank a global style class's one attribute.
  // This makes per-element values true local overrides regardless of stylesheet
  // insertion order.
  const selector = `[data-mg-visual="${scope}"][data-mg-visual="${scope}"]`;
  return { scope, css: rulesForSelector(selector, design) };
}

/** CSS for one validated global class id. Invalid stored ids emit nothing. */
export function visualStyleClassCss(id: string, design: VisualElementDesign): string {
  if (!VISUAL_STYLE_CLASS_ID.test(id)) return "";
  return rulesForSelector(`[data-mg-style~="${id}"]`, design);
}
