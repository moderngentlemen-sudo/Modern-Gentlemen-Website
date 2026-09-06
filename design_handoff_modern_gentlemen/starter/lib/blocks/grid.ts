import { z } from "zod";

export const gridPlacementSchema = z
  .object({
    column: z.number().int().min(0).max(12),
    row: z.number().int().min(0).max(100),
    span: z.number().int().min(1).max(12),
    rows: z.number().int().min(1).max(40),
  })
  .strict()
  .refine(
    (p) => p.column === 0 || p.column + p.span <= 13,
    "The element must fit within 12 columns."
  );
export const responsiveGridSchema = z
  .object({
    desktop: gridPlacementSchema.optional(),
    tablet: gridPlacementSchema.optional(),
    mobile: gridPlacementSchema.optional(),
  })
  .strict();
export type GridPlacement = z.infer<typeof gridPlacementSchema>;
export type ResponsiveGrid = z.infer<typeof responsiveGridSchema>;
export type GridDevice = "desktop" | "tablet" | "mobile";
export function gridPlacement(grid: ResponsiveGrid | undefined, device: GridDevice): GridPlacement {
  const fallback = { column: 0, row: 0, span: device === "desktop" ? 6 : 12, rows: 1 };
  return gridPlacementSchema.safeParse(grid?.[device]).data ?? fallback;
}
export function shiftGrid(
  p: GridPlacement,
  dx: number,
  dy: number,
  resize: boolean
): GridPlacement {
  const column = Math.max(1, p.column);
  return resize
    ? {
        ...p,
        span: Math.max(1, Math.min(13 - column, p.span + dx)),
        rows: Math.max(1, Math.min(40, p.rows + dy)),
      }
    : {
        ...p,
        column: Math.max(1, Math.min(13 - p.span, column + dx)),
        row: Math.max(1, Math.min(100, Math.max(1, p.row) + dy)),
      };
}
export function gridPosition(p: GridPlacement) {
  return {
    gridColumn: `${p.column || "auto"} / span ${p.span}`,
    gridRow: `${p.row || "auto"} / span ${p.rows}`,
    minWidth: 0,
  };
}
export function gridVariables(grid?: ResponsiveGrid) {
  return Object.fromEntries(
    (["desktop", "tablet", "mobile"] as const).flatMap((d) => {
      const p = gridPosition(gridPlacement(grid, d));
      return [
        [`--grid-${d}-column`, p.gridColumn],
        [`--grid-${d}-row`, p.gridRow],
      ];
    })
  );
}
