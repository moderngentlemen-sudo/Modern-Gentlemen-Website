import { MonoLabel } from "@/components/ui/Eyebrow";

/**
 * The "nothing here yet" panel. Three callers already: the pages list with no
 * pages, the canvas with no blocks, and the history drawer with no revisions.
 */
export function EmptyState({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {eyebrow && <MonoLabel>{eyebrow}</MonoLabel>}
      <h2 className="mt-2 font-grotesk text-[20px] font-semibold tracking-[-0.02em]">{title}</h2>
      {children && <p className="mt-2 max-w-[420px] text-[13px] text-mg-fg/60">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
