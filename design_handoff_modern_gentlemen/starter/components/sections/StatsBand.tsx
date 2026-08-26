import { HairlineGrid } from "../ui/HairlineGrid";

interface Stat {
  value: string;
  label: string;
}

/** By the Numbers — stats (library #08).
 *  - `band`  full-bleed dark, big white numerals (homepage/library default).
 *  - `cards` hairline card grid with red numerals (About "By the numbers"). */
export function StatsBand({
  eyebrow,
  stats,
  variant = "band",
}: {
  eyebrow?: string;
  stats: Stat[];
  variant?: "band" | "cards";
}) {
  if (variant === "cards") {
    return (
      <section style={{ paddingInline: "max(22px, calc((100% - 1320px) / 2))" }}>
        <HairlineGrid className="grid-cols-2 min-[821px]:grid-cols-4">
          {stats?.map((s, i) => (
            <div key={i} className="bg-mg-surface p-[40px_30px]">
              <div className="font-grotesk font-semibold text-[54px] leading-none tracking-[-0.04em] text-mg-accentInk">
                {s.value}
              </div>
              <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-mg-fg/60 text-pretty">
                {s.label}
              </div>
            </div>
          ))}
        </HairlineGrid>
      </section>
    );
  }
  return (
    <section data-darkband className="bg-[#0d0d0d] text-[#f4f4f4] py-20 md:py-28">
      <div className="container-mg">
        {eyebrow && (
          <div className="font-serif italic text-mg-accentSerif text-xl mb-10">{eyebrow}</div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-12">
          {stats?.map((s, i) => (
            <div key={i}>
              <div className="font-grotesk font-semibold text-5xl md:text-6xl tracking-tight">
                {s.value}
              </div>
              <div className="mt-3 font-mono text-xs uppercase tracking-[0.15em] text-white/50 text-pretty">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
