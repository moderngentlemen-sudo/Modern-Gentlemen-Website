/**
 * The admin's shared class strings.
 *
 * The admin speaks the same visual language as the site — mono uppercase
 * labels, hairline rules, sharp corners, `mg.*` tokens — at a denser scale. The
 * site's own form primitives are tuned for checkout (`py-3`, no `name`, no help
 * slot) and are used on pixel-verified pages, so they are left alone rather than
 * grown a second set of props.
 *
 * `.container-mg` is deliberately absent: it is site-only (PROGRESS.md), and
 * admin screens use `px-8 py-10` instead.
 */

/** Mono uppercase caption above a control, and the admin's section-label voice. */
export const LABEL = "font-mono text-[11px] uppercase tracking-[0.15em] text-mg-fg/60";

/** The smaller variant, for panel section headers and table column heads. */
export const LABEL_SM = "font-mono text-[10px] uppercase tracking-[0.18em] text-mg-fg/50";

/**
 * A text-entry control. `data-invalid` drives the error treatment so the markup
 * matches the site's `components/store/Field`, which does the same.
 */
export const CONTROL =
  "w-full border border-mg-bd/25 bg-transparent px-3 py-2 text-[14px] text-mg-fg outline-none transition-colors placeholder:text-mg-fg/30 focus:border-mg-accent disabled:cursor-not-allowed disabled:opacity-50 data-[invalid]:border-mg-accentSerif data-[invalid]:bg-mg-accent/5";

/** 1px separator, the admin's main structural device. */
export const HAIRLINE = "border-mg-bd/15";

/** A raised surface: panels, cards, table bodies. */
export const SURFACE = "bg-mg-surface";

/** Inline error text under a control. */
export const ERROR_TEXT = "mt-1 block font-mono text-[10px] text-mg-accentSerif";

/** Help text under a control — every manifest field may carry `help`. */
export const HELP_TEXT = "mt-1 block text-[12px] leading-snug text-mg-fg/45";

/** Visible keyboard focus, for controls that aren't inputs (rows, handles). */
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-mg-accent";
