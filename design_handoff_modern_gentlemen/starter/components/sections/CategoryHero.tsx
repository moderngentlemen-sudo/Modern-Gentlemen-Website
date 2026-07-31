interface Props {
  eyebrow: string;
  title: string;
  blurb?: string;
  image: string;
  chips?: string[];
}

/**
 * Full-bleed category hero — a grayscale cover photo under a bottom-weighted
 * scrim, the category name at display size, and decorative subcategory chips.
 * Bleeds up behind the fixed 72px header (-mt-[72px]); dark in both themes.
 */
export function CategoryHero({ eyebrow, title, blurb, image, chips }: Props) {
  return (
    <section
      data-darkband
      className="relative -mt-[72px] overflow-hidden bg-[#0d0d0d] text-[#f4f4f4]"
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center [filter:grayscale(0.15)]"
        style={{ backgroundImage: `url(${image})` }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg,rgba(13,13,13,0.32) 0%,rgba(13,13,13,0.32) 45%,rgba(13,13,13,0.92) 100%)",
        }}
      />
      <div className="container-mg relative pt-[120px] pb-[56px]">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#ff4d5e]">
          {eyebrow}
        </p>
        <h1 className="mt-5 font-grotesk font-semibold text-[52px] min-[681px]:text-[84px] leading-[0.92] tracking-[-0.05em] text-balance">
          {title}
        </h1>
        {blurb && (
          <p className="mt-6 max-w-[560px] font-serif italic text-[22px] leading-[1.45] text-mg-fg/[0.82]">
            {blurb}
          </p>
        )}
        {chips?.length ? (
          <div className="mt-[30px] flex flex-wrap gap-[10px]">
            {chips.map((c) => (
              <span
                key={c}
                className="border border-white/[0.22] px-[17px] py-[9px] font-mono text-[10px] tracking-[0.16em] text-mg-fg/85"
              >
                {c}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
