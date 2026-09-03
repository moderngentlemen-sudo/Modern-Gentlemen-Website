"use client";

import { useState } from "react";

import {
  VISUAL_ALIGNS,
  VISUAL_BACKGROUNDS,
  VISUAL_BORDERS,
  VISUAL_COLORS,
  VISUAL_DIRECTIONS,
  VISUAL_DISPLAYS,
  VISUAL_ENTRANCES,
  VISUAL_HOVERS,
  VISUAL_JUSTIFIES,
  VISUAL_MAX_WIDTHS,
  VISUAL_MIN_HEIGHTS,
  VISUAL_MOTIONS,
  VISUAL_OPACITIES,
  VISUAL_OVERFLOWS,
  VISUAL_POSITIONS,
  VISUAL_RADII,
  VISUAL_REVEAL_BEHAVIORS,
  VISUAL_REVEAL_DELAYS,
  VISUAL_SHADOWS,
  VISUAL_SPACES,
  VISUAL_STATES,
  VISUAL_WIDTHS,
  type VisualBreakpoint,
  type VisualEffects,
  type VisualState,
  type VisualStateStyle,
  type VisualStyle,
} from "@/lib/blocks/visual";
import type { ThemeStyleClass, ThemeTokenAlias } from "@/lib/domain/theme";
import { Button } from "@/components/admin/ui/Button";
import { TextInput } from "@/components/admin/ui/Input";
import { NumberInput } from "@/components/admin/ui/NumberInput";
import { Select } from "@/components/admin/ui/Select";

const DEVICES: VisualBreakpoint[] = ["desktop", "tablet", "mobile"];

function options(values: readonly (string | number)[], suffix = "") {
  return values.map((value) => ({
    value: String(value),
    label: `${String(value)
      .replaceAll("-", " ")
      .replace(/^./, (letter) => letter.toUpperCase())}${suffix}`,
  }));
}

const PRESET_FIELDS: {
  property: keyof VisualStyle;
  label: string;
  values: readonly (string | number)[];
  suffix?: string;
}[] = [
  { property: "display", label: "Display", values: VISUAL_DISPLAYS },
  { property: "direction", label: "Direction", values: VISUAL_DIRECTIONS },
  { property: "columns", label: "Grid columns", values: [1, 2, 3, 4, 5, 6] },
  { property: "align", label: "Align items", values: VISUAL_ALIGNS },
  { property: "justify", label: "Justify content", values: VISUAL_JUSTIFIES },
  { property: "width", label: "Width preset", values: VISUAL_WIDTHS },
  { property: "maxWidth", label: "Maximum width", values: VISUAL_MAX_WIDTHS },
  { property: "minHeight", label: "Minimum height", values: VISUAL_MIN_HEIGHTS },
  { property: "gap", label: "Gap", values: VISUAL_SPACES, suffix: "px" },
  { property: "paddingX", label: "Horizontal padding", values: VISUAL_SPACES, suffix: "px" },
  { property: "paddingY", label: "Vertical padding", values: VISUAL_SPACES, suffix: "px" },
  { property: "marginTop", label: "Top margin", values: VISUAL_SPACES, suffix: "px" },
  { property: "marginBottom", label: "Bottom margin", values: VISUAL_SPACES, suffix: "px" },
  { property: "background", label: "Background", values: VISUAL_BACKGROUNDS },
  { property: "color", label: "Text color", values: VISUAL_COLORS },
  { property: "border", label: "Border", values: VISUAL_BORDERS },
  { property: "radius", label: "Corners", values: VISUAL_RADII },
  { property: "shadow", label: "Shadow", values: VISUAL_SHADOWS },
  { property: "opacity", label: "Opacity", values: VISUAL_OPACITIES, suffix: "%" },
  { property: "overflow", label: "Overflow", values: VISUAL_OVERFLOWS },
  { property: "position", label: "Position", values: VISUAL_POSITIONS },
];

const PRECISE_FIELDS: {
  property: keyof VisualStyle;
  label: string;
  min: number;
  max: number;
}[] = [
  { property: "widthPercent", label: "Width (%)", min: 5, max: 100 },
  { property: "widthPx", label: "Width (px)", min: 24, max: 4000 },
  { property: "heightPx", label: "Height (px)", min: 0, max: 4000 },
  { property: "maxWidthPx", label: "Max width (px)", min: 24, max: 4000 },
  { property: "minHeightPx", label: "Min height (px)", min: 0, max: 4000 },
  { property: "top", label: "Top (px)", min: -4000, max: 4000 },
  { property: "right", label: "Right (px)", min: -4000, max: 4000 },
  { property: "bottom", label: "Bottom (px)", min: -4000, max: 4000 },
  { property: "left", label: "Left (px)", min: -4000, max: 4000 },
  { property: "zIndex", label: "Stack order", min: -10, max: 100 },
];

export function StyleClassEditor({
  value,
  disabled,
  tokenAliases,
  onChange,
  onRemove,
}: {
  value: ThemeStyleClass;
  disabled: boolean;
  tokenAliases: readonly ThemeTokenAlias[];
  onChange: (next: ThemeStyleClass) => void;
  onRemove: () => void;
}) {
  const [device, setDevice] = useState<VisualBreakpoint>("desktop");
  const [componentState, setComponentState] = useState<VisualState>("hover");
  const style = value.visual.styles?.[device] ?? {};

  function setStyle(property: keyof VisualStyle, next: string | number | undefined) {
    const currentStyle = { ...style } as Record<string, unknown>;
    if (next === undefined || next === "") delete currentStyle[property];
    else currentStyle[property] = next;
    if (next !== undefined && next !== "" && property === "background") {
      delete currentStyle.backgroundToken;
    }
    if (next !== undefined && next !== "" && property === "color") delete currentStyle.colorToken;
    onChange({
      ...value,
      visual: {
        ...value.visual,
        styles: { ...value.visual.styles, [device]: currentStyle as VisualStyle },
      },
    });
  }

  function setStyleToken(
    property: "backgroundToken" | "colorToken",
    counterpart: "background" | "color",
    next: string
  ) {
    const currentStyle = { ...style } as Record<string, unknown>;
    if (next) {
      currentStyle[property] = next;
      delete currentStyle[counterpart];
    } else {
      delete currentStyle[property];
    }
    onChange({
      ...value,
      visual: {
        ...value.visual,
        styles: { ...value.visual.styles, [device]: currentStyle as VisualStyle },
      },
    });
  }

  function setEffect(property: keyof VisualEffects, next: string | number) {
    const effects = { ...value.visual.effects } as Record<string, unknown>;
    if (next === "") delete effects[property];
    else effects[property] = next;
    onChange({ ...value, visual: { ...value.visual, effects } });
  }

  function setEntrance(next: string) {
    const effects = { ...value.visual.effects } as Record<string, unknown>;
    if (!next) delete effects.entrance;
    else effects.entrance = next;
    if (!next || next === "none") {
      delete effects.revealBehavior;
      delete effects.revealDelay;
    }
    onChange({ ...value, visual: { ...value.visual, effects } });
  }

  function setStateStyle(property: keyof VisualStateStyle, next: string) {
    const stateStyle = { ...(value.visual.states?.[componentState] ?? {}) } as Record<
      string,
      unknown
    >;
    if (!next) delete stateStyle[property];
    else stateStyle[property] = property === "opacity" ? Number(next) : next;
    if (next && property === "backgroundToken") delete stateStyle.background;
    if (next && property === "colorToken") delete stateStyle.color;
    if (next && property === "background") delete stateStyle.backgroundToken;
    if (next && property === "color") delete stateStyle.colorToken;
    const states = { ...value.visual.states };
    if (Object.keys(stateStyle).length > 0) {
      states[componentState] = stateStyle as VisualStateStyle;
    } else {
      delete states[componentState];
    }
    onChange({ ...value, visual: { ...value.visual, states } });
  }

  return (
    <div className="border border-mg-bd/15 p-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-[240px] flex-1">
          <TextInput
            label="Class name"
            value={value.name}
            disabled={disabled}
            onChange={(name) => onChange({ ...value, name })}
            help={`Stable id: ${value.id}`}
          />
        </div>
        <Button size="sm" variant="danger" disabled={disabled} onClick={onRemove}>
          Remove class
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Responsive breakpoint">
        {DEVICES.map((candidate) => (
          <Button
            key={candidate}
            size="sm"
            variant={device === candidate ? "solid" : "ghost"}
            onClick={() => setDevice(candidate)}
          >
            {candidate}
          </Button>
        ))}
      </div>

      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-mg-fg/60">
        Responsive layout and appearance — {device}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {PRESET_FIELDS.map((field) => (
          <Select
            key={field.property}
            label={field.label}
            value={style[field.property] === undefined ? "" : String(style[field.property])}
            placeholder="Inherit"
            options={options(field.values, field.suffix)}
            disabled={disabled}
            onChange={(next) =>
              setStyle(
                field.property,
                next === "" ? undefined : typeof field.values[0] === "number" ? Number(next) : next
              )
            }
          />
        ))}
        {PRECISE_FIELDS.map((field) => (
          <NumberInput
            key={field.property}
            label={field.label}
            value={style[field.property] as number | undefined}
            min={field.min}
            max={field.max}
            integer
            disabled={disabled}
            onChange={(next) => setStyle(field.property, next)}
          />
        ))}
        {tokenAliases.length > 0 && (
          <>
            <Select
              label="Shared background token"
              value={style.backgroundToken ?? ""}
              placeholder="Inherit"
              options={tokenAliases.map((token) => ({ value: token.id, label: token.name }))}
              disabled={disabled}
              onChange={(next) => setStyleToken("backgroundToken", "background", next)}
            />
            <Select
              label="Shared text token"
              value={style.colorToken ?? ""}
              placeholder="Inherit"
              options={tokenAliases.map((token) => ({ value: token.id, label: token.name }))}
              disabled={disabled}
              onChange={(next) => setStyleToken("colorToken", "color", next)}
            />
          </>
        )}
      </div>

      <p className="mb-3 mt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-mg-fg/60">
        Interaction
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Select
          label="Hover effect"
          value={value.visual.effects?.hover ?? ""}
          placeholder="None"
          options={options(VISUAL_HOVERS)}
          disabled={disabled}
          onChange={(next) => setEffect("hover", next)}
        />
        <Select
          label="Motion"
          value={value.visual.effects?.motion ?? ""}
          placeholder="Default"
          options={options(VISUAL_MOTIONS)}
          disabled={disabled}
          onChange={(next) => setEffect("motion", next)}
        />
        <Select
          label="Entrance"
          value={value.visual.effects?.entrance ?? ""}
          placeholder="No reveal"
          options={options(VISUAL_ENTRANCES)}
          disabled={disabled}
          onChange={setEntrance}
        />
        {value.visual.effects?.entrance && value.visual.effects.entrance !== "none" && (
          <>
            <Select
              label="Scroll behavior"
              value={value.visual.effects.revealBehavior ?? "once"}
              options={options(VISUAL_REVEAL_BEHAVIORS)}
              disabled={disabled}
              onChange={(next) => setEffect("revealBehavior", next)}
            />
            <Select
              label="Entrance delay"
              value={String(value.visual.effects.revealDelay ?? 0)}
              options={options(VISUAL_REVEAL_DELAYS, "ms")}
              disabled={disabled}
              onChange={(next) => setEffect("revealDelay", Number(next))}
            />
          </>
        )}
      </div>

      <p className="mb-3 mt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-mg-fg/60">
        Component states
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Select
          label="State"
          value={componentState}
          options={options(VISUAL_STATES)}
          disabled={disabled}
          onChange={(next) => setComponentState(next as VisualState)}
        />
        {STATE_FIELDS.map((field) => (
          <Select
            key={field.property}
            label={field.label}
            value={String(value.visual.states?.[componentState]?.[field.property] ?? "")}
            placeholder="Inherit"
            options={options(field.values, field.suffix)}
            disabled={disabled}
            onChange={(next) => setStateStyle(field.property, next)}
          />
        ))}
        {tokenAliases.length > 0 && (
          <>
            <Select
              label="State background token"
              value={value.visual.states?.[componentState]?.backgroundToken ?? ""}
              placeholder="Inherit"
              options={tokenAliases.map((token) => ({ value: token.id, label: token.name }))}
              disabled={disabled}
              onChange={(next) => setStateStyle("backgroundToken", next)}
            />
            <Select
              label="State text token"
              value={value.visual.states?.[componentState]?.colorToken ?? ""}
              placeholder="Inherit"
              options={tokenAliases.map((token) => ({ value: token.id, label: token.name }))}
              disabled={disabled}
              onChange={(next) => setStateStyle("colorToken", next)}
            />
          </>
        )}
      </div>
    </div>
  );
}

const STATE_FIELDS: {
  property: keyof VisualStateStyle;
  label: string;
  values: readonly (string | number)[];
  suffix?: string;
}[] = [
  { property: "background", label: "Background", values: VISUAL_BACKGROUNDS },
  { property: "color", label: "Text color", values: VISUAL_COLORS },
  { property: "border", label: "Border", values: VISUAL_BORDERS },
  { property: "radius", label: "Corners", values: VISUAL_RADII },
  { property: "shadow", label: "Shadow", values: VISUAL_SHADOWS },
  { property: "opacity", label: "Opacity", values: VISUAL_OPACITIES, suffix: "%" },
];
