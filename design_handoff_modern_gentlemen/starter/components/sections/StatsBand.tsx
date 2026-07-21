interface Stat { value: string; label: string }

/** By the Numbers — stats band (library #08). Full-bleed dark by default. */
export function StatsBand({ eyebrow, stats }: { eyebrow?: string; stats: Stat[] }) {
  return (
    <section data-darkband className="bg-[#0d0d0d] text-[#f4f4f4] py-20 md:py-28">
      <div className="container-mg">
        {eyebrow && <div className="font-serif italic text-mg-accentSerif text-xl mb-10">{eyebrow}</div>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-12">
          {stats?.map((s, i) => (
            <div key={i}>
              <div className="font-grotesk font-semibold text-5xl md:text-6xl tracking-tight">{s.value}</div>
              <div className="mt-3 font-mono text-xs uppercase tracking-[0.15em] text-white/50 text-pretty">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
