import { clsx } from "./clsx";

/** 1px-hairline rounded card grid shell (About "By the numbers" + Masthead,
 *  Membership benefits). The caller passes the responsive `grid-cols-*` via
 *  className; each child cell should set its own `bg-mg-surface` + padding so
 *  the 9%-fg gutters read as thin lines between surface tiles in both themes. */
export function HairlineGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx("grid gap-px overflow-hidden rounded-[12px] border border-mg-bd/[0.09] bg-mg-bd/[0.09]", className)}>
      {children}
    </div>
  );
}
