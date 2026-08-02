import Link from "next/link";
import { clsx } from "./clsx";

export function Button({
  href,
  children,
  variant = "solid",
  className,
  onClick,
  type = "button",
}: {
  href?: string;
  children: React.ReactNode;
  variant?: "solid" | "outline";
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center justify-center px-8 py-3 font-mono text-xs uppercase tracking-[0.15em] transition-colors";
  const styles =
    variant === "solid"
      ? "bg-mg-accent text-white hover:bg-mg-fg hover:text-mg-bg"
      : "border border-mg-bd text-mg-fg hover:bg-mg-fg hover:text-mg-bg";
  const cls = clsx(base, styles, className);
  if (href)
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  return (
    <button type={type} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}
