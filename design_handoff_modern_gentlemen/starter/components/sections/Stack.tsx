import type { ReactNode } from "react";

import { clsx } from "../ui/clsx";

export type StackDirection = "vertical" | "horizontal";
export type StackBreakpoint = "never" | "680" | "820" | "1024";

const DIRECTION: Record<StackDirection, Record<StackBreakpoint, string>> = {
  vertical: {
    never: "flex-col",
    "680": "flex-col",
    "820": "flex-col",
    "1024": "flex-col",
  },
  horizontal: {
    never: "flex-row",
    "680": "flex-col min-[681px]:flex-row",
    "820": "flex-col min-[821px]:flex-row",
    "1024": "flex-col min-[1025px]:flex-row",
  },
};

const GAP = {
  none: "gap-0",
  small: "gap-4",
  medium: "gap-8",
  large: "gap-12",
  xlarge: "gap-20",
} as const;

const ALIGN = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
} as const;

const JUSTIFY = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
} as const;

interface Props {
  direction?: StackDirection;
  stackAt?: StackBreakpoint;
  gap?: keyof typeof GAP;
  align?: keyof typeof ALIGN;
  justify?: keyof typeof JUSTIFY;
  wrap?: boolean;
  children?: ReactNode;
}

/** A nestable flex layout primitive, with bounded responsive behaviour. */
export function Stack({
  direction = "vertical",
  stackAt = "820",
  gap = "medium",
  align = "stretch",
  justify = "start",
  wrap = false,
  children,
}: Props) {
  return (
    <div
      className={clsx(
        "flex min-w-0",
        DIRECTION[direction][stackAt],
        GAP[gap],
        ALIGN[align],
        JUSTIFY[justify],
        wrap && "flex-wrap"
      )}
    >
      {children}
    </div>
  );
}
