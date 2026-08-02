import Link from "next/link";
import { clsx } from "@/components/ui/clsx";
import { FOCUS_RING } from "./styles";

/**
 * The admin button.
 *
 * `components/ui/Button` is the site's, and it cannot serve here: it has no
 * `disabled` (Publish must go dead while a save is in flight — `SignInForm`
 * already hand-rolled its own submit button for exactly this reason), no size
 * scale (a fixed `px-8 py-3` is far too large for a canvas toolbar), and no
 * destructive variant. It is also used on pixel-verified pages, so growing it
 * risks the very thing the design rules protect.
 */
export type ButtonVariant = "solid" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: "button" | "submit";
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Shows a pending label and disables the button. */
  loading?: boolean;
  title?: string;
  className?: string;
}

const SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-[10px]",
  md: "px-5 py-2.5 text-[11px]",
};

const VARIANTS: Record<ButtonVariant, string> = {
  solid: "bg-mg-accent text-white hover:bg-mg-fg hover:text-mg-bg",
  outline: "border border-mg-bd/30 text-mg-fg hover:border-mg-fg",
  ghost: "text-mg-fg/70 hover:bg-mg-fg/5 hover:text-mg-fg",
  danger: "border border-mg-accentSerif/50 text-mg-accentSerif hover:bg-mg-accentSerif/10",
};

export function Button({
  children,
  variant = "outline",
  size = "md",
  type = "button",
  href,
  onClick,
  disabled,
  loading,
  title,
  className,
}: ButtonProps) {
  const cls = clsx(
    "inline-flex items-center justify-center gap-2 font-mono uppercase tracking-[0.15em] transition-colors",
    SIZES[size],
    VARIANTS[variant],
    FOCUS_RING,
    (disabled || loading) && "pointer-events-none opacity-40",
    className
  );

  if (href && !disabled && !loading) {
    return (
      <Link href={href} className={cls} title={title}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={cls}
    >
      {children}
    </button>
  );
}

/**
 * A square icon button for dense chrome — the block frame toolbar above all.
 * `label` is required rather than optional: every one of these is icon-only, so
 * without it the control is unreachable to a screen reader.
 */
export function IconButton({
  label,
  children,
  onClick,
  disabled,
  active,
  className,
  ...rest
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "inline-flex h-7 w-7 items-center justify-center border text-[11px] transition-colors",
        active
          ? "border-mg-accent bg-mg-accent text-white"
          : "border-mg-bd/25 text-mg-fg/70 hover:border-mg-fg hover:text-mg-fg",
        disabled && "pointer-events-none opacity-40",
        FOCUS_RING,
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
