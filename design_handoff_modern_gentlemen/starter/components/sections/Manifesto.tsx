/** About "Our Position" — a labelled two-column brand statement (mono label +
 *  large-body prose). Collapses to a single column ≤820px. */
export function Manifesto({ label, paragraphs }: { label: string; paragraphs: string[] }) {
  return (
    <section
      className="py-[72px]"
      style={{ paddingInline: "max(22px, calc((100% - 1320px) / 2))" }}
    >
      <div className="grid grid-cols-1 gap-[20px] min-[821px]:grid-cols-[0.7fr_1.3fr] min-[821px]:gap-[48px]">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-mg-fg/60">
          {label}
        </div>
        <div className="max-w-[680px] font-grotesk font-light text-[21px] leading-[1.7] text-mg-fg/[0.86] text-pretty">
          {paragraphs.map((p, i) => (
            <p key={i} className={i < paragraphs.length - 1 ? "mb-6" : ""}>
              {p}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
