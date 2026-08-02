import { clsx } from "../ui/clsx";

interface Props {
  eyebrow: string;
  headline: string;
  accent?: string; // trailing clause rendered in accent red
  dek?: string;
  align?: "left" | "center";
  children?: React.ReactNode; // slot below the dek (e.g. Membership billing toggle)
}

/**
 * Lightweight editorial page hero — a text headline (with an optional accent
 * clause) over a serif dek. `left` = About (1320 column, big left headline);
 * `center` = Membership (900 column, centered, slots its billing toggle into
 * `children`). Sits inside the fixed-header reserve (no bleed).
 */
export function EditorialHero({ eyebrow, headline, accent, dek, align = "left", children }: Props) {
  const centered = align === "center";
  const width = centered ? 900 : 1320;
  return (
    <section
      className={clsx(
        "pt-[78px]",
        centered ? "pb-[40px] text-center" : "border-b border-mg-bd/[0.09] pb-[72px]"
      )}
      style={{ paddingInline: `max(22px, calc((100% - ${width}px) / 2))` }}
    >
      <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#ff4d5e]">
        {eyebrow}
      </div>
      <h1
        className={clsx(
          "font-grotesk font-semibold text-balance",
          centered
            ? "mt-6 text-[46px] min-[681px]:text-[66px] leading-[0.98] tracking-[-0.045em]"
            : "mt-[26px] max-w-[1000px] text-[38px] min-[681px]:text-[46px] min-[821px]:text-[68px] leading-[1.02] tracking-[-0.04em]"
        )}
      >
        {headline}
        {accent && <span className="text-mg-accent">{accent}</span>}
      </h1>
      {dek && (
        <p
          className={clsx(
            "font-serif italic text-mg-fg/[0.78] text-pretty",
            centered
              ? "mx-auto mt-[26px] max-w-[540px] text-[22px] leading-[1.45]"
              : "mt-[34px] max-w-[640px] text-[19px] min-[681px]:text-[24px] leading-[1.5]"
          )}
        >
          {dek}
        </p>
      )}
      {children}
    </section>
  );
}
