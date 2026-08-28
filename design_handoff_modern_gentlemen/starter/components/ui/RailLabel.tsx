import { clsx } from "./clsx";

/** Red-tick + mono section label. Heads THE LEAD / MORE IN {CAT} / WHAT WE
 *  COVER / THE MASTHEAD / WHAT MEMBERS GET / QUESTIONS across the editorial
 *  pages. The 26×2px tick is accent red; the label is muted-fg mono. */
export function RailLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex items-baseline gap-[14px]", className)}>
      <span aria-hidden className="block h-[2px] w-[26px] bg-mg-accent" />
      <span className="font-mono uppercase text-[11px] tracking-[0.22em] text-mg-fg/60">
        {children}
      </span>
    </div>
  );
}
