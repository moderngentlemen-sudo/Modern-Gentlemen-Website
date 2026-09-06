import type { CSSProperties, ReactNode } from "react";
import { gridVariables, type ResponsiveGrid, type GridDevice } from "@/lib/blocks/grid";
import styles from "./GridLayout.module.css";
export function GridLayout({
  children,
  gap = 24,
  mobileGap = 16,
  rowHeight = 48,
  previewDevice,
}: {
  children?: ReactNode;
  gap?: number;
  mobileGap?: number;
  rowHeight?: number;
  previewDevice?: GridDevice;
}) {
  return (
    <div
      className={styles.grid}
      data-grid-layout=""
      data-grid-preview={previewDevice}
      style={
        {
          "--grid-gap": `${gap}px`,
          "--grid-mobile-gap": `${mobileGap}px`,
          "--grid-row-height": `${rowHeight}px`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
export function GridCell({ children, grid }: { children: ReactNode; grid?: ResponsiveGrid }) {
  return (
    <div className={styles.cell} style={gridVariables(grid) as CSSProperties}>
      {children}
    </div>
  );
}
