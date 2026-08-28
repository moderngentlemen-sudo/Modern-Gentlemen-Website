"use client";

import { useState } from "react";
import { clsx } from "@/components/ui/clsx";
import { FOCUS_RING, HAIRLINE, LABEL_SM, SURFACE } from "./styles";
import { Badge } from "./Badge";

/**
 * A bordered admin surface. `HairlineGrid` is the site's equivalent shell, but
 * it is a *grid* whose children supply their own background; this is a single
 * panel with a header, which is what the properties panel and the lists want.
 */
export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx("border", HAIRLINE, SURFACE, className)}>{children}</div>;
}

/**
 * A collapsible section inside a panel — one per `group` field, plus the
 * block's own Display section.
 *
 * `issueCount` surfaces validation nested *below* the header, so a collapsed
 * group still announces that something inside it is wrong. Without it, an
 * editor hunting a publish failure would have to open every group.
 */
export function PanelSection({
  title,
  children,
  defaultOpen = true,
  issueCount = 0,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  issueCount?: number;
  actions?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={clsx("border-b last:border-b-0", HAIRLINE)}>
      <div className="flex items-center gap-2 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={clsx("flex min-w-0 flex-1 items-center gap-2 text-left", FOCUS_RING)}
        >
          <span aria-hidden className="text-[9px] text-mg-fg/60">
            {open ? "▾" : "▸"}
          </span>
          <span className={clsx(LABEL_SM, "truncate")}>{title}</span>
          {issueCount > 0 && <Badge tone="danger">{issueCount}</Badge>}
        </button>
        {actions}
      </div>
      {open && <div className="space-y-4 px-4 pb-4">{children}</div>}
    </section>
  );
}
