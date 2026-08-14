import type { ReactNode } from "react";

import { clsx } from "../ui/clsx";

/**
 * The layout block: a row of columns holding other blocks.
 *
 * ⚠️ **This is the one component permitted to define its own responsive
 * behaviour.** The handoff bundle contains no layout primitive — `05_SECTION_
 * BUILDER.md` says "the renderer just stacks them" — so there is nothing to
 * infer breakpoints from, and the exception is recorded beside the rule it
 * modifies in `design_handoff_modern_gentlemen/CLAUDE.md`.
 *
 * The exception is used as sparingly as it can be: `stackAt` offers **the
 * site's own three breakpoints (680 / 820 / 1024)** rather than new numbers.
 * Inventing was licensed; it was not necessary, and a fourth breakpoint would
 * show up as a layout that changes where nothing else on the page does.
 *
 * Children arrive as rendered React nodes, not as block data. `SectionRenderer`
 * recurses and passes them in, so this component knows nothing about
 * `BlockNode` and stays as ordinary as every other section.
 */

export type ColumnsRatio = "1-1" | "2-1" | "1-2" | "1-1-1" | "1-1-1-1";
export type ColumnsStackAt = "680" | "820" | "1024";

/**
 * Tailwind reads class names as literal strings — a template built at runtime
 * emits no CSS — so every combination is spelled out. Fifteen rows is a small
 * price for the JIT seeing all of them.
 */
const GRID: Record<ColumnsRatio, Record<ColumnsStackAt, string>> = {
  "1-1": {
    "680": "min-[681px]:grid-cols-2",
    "820": "min-[821px]:grid-cols-2",
    "1024": "min-[1025px]:grid-cols-2",
  },
  "2-1": {
    "680": "min-[681px]:grid-cols-[2fr_1fr]",
    "820": "min-[821px]:grid-cols-[2fr_1fr]",
    "1024": "min-[1025px]:grid-cols-[2fr_1fr]",
  },
  "1-2": {
    "680": "min-[681px]:grid-cols-[1fr_2fr]",
    "820": "min-[821px]:grid-cols-[1fr_2fr]",
    "1024": "min-[1025px]:grid-cols-[1fr_2fr]",
  },
  "1-1-1": {
    "680": "min-[681px]:grid-cols-3",
    "820": "min-[821px]:grid-cols-3",
    "1024": "min-[1025px]:grid-cols-3",
  },
  "1-1-1-1": {
    "680": "min-[681px]:grid-cols-4",
    "820": "min-[821px]:grid-cols-4",
    "1024": "min-[1025px]:grid-cols-4",
  },
};

/** The 8px rhythm the design tokens are built on. */
const GAP = {
  none: "gap-0",
  sm: "gap-4",
  md: "gap-8",
  lg: "gap-12",
} as const;

const ALIGN = {
  top: "items-start",
  middle: "items-center",
  stretch: "items-stretch",
} as const;

interface Props {
  ratio?: ColumnsRatio;
  stackAt?: ColumnsStackAt;
  gap?: keyof typeof GAP;
  align?: keyof typeof ALIGN;
  /** `contained` caps content at the 1320px column; `full` goes edge to edge. */
  width?: "contained" | "full";
  children?: ReactNode;
}

export function Columns({
  ratio = "1-1",
  stackAt = "680",
  gap = "md",
  align = "stretch",
  width = "contained",
  children,
}: Props) {
  return (
    <section className={clsx("py-[48px]", width === "contained" && "container-mg")}>
      <div className={clsx("grid grid-cols-1", GRID[ratio][stackAt], GAP[gap], ALIGN[align])}>
        {children}
      </div>
    </section>
  );
}
