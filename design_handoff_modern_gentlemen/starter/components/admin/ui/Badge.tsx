import { clsx } from "@/components/ui/clsx";
import type { DocumentStatus } from "@/lib/domain/documents";

export type BadgeTone = "neutral" | "accent" | "danger" | "muted";

const TONES: Record<BadgeTone, string> = {
  neutral: "border-mg-bd/25 text-mg-fg/70",
  accent: "border-mg-accent/40 bg-mg-accent/10 text-mg-accent",
  danger: "border-mg-accentSerif/40 bg-mg-accentSerif/10 text-mg-accentSerif",
  muted: "border-mg-bd/15 text-mg-fg/40",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
        TONES[tone]
      )}
    >
      {children}
    </span>
  );
}

/**
 * A document's status, from `DOCUMENT_STATUSES`. Published is the only state
 * that earns the accent — it is the one that means "the public can see this".
 */
const STATUS_TONES: Record<DocumentStatus, BadgeTone> = {
  published: "accent",
  draft: "neutral",
  scheduled: "neutral",
  archived: "muted",
};

export function StatusPill({ status }: { status: DocumentStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{status}</Badge>;
}
