import { RailLabel } from "../ui/RailLabel";
import { HairlineGrid } from "../ui/HairlineGrid";

interface Person {
  initial: string;
  name: string;
  role: string;
}

/** About "The Masthead" — a hairline team grid with red initial avatars
 *  (4-up, collapsing to 2-up ≤820px). */
export function Masthead({ label, people }: { label: string; people: Person[] }) {
  return (
    <section
      className="pb-5"
      style={{
        paddingInline:
          "max(var(--layout-mobile-gutter), calc((100% - var(--layout-content-width)) / 2))",
      }}
    >
      <RailLabel className="mb-[30px]">{label}</RailLabel>
      <HairlineGrid className="grid-cols-2 min-[821px]:grid-cols-4">
        {people.map((p) => (
          <div key={p.name} className="bg-mg-surface p-[28px_26px]">
            <div className="mb-4 flex h-[44px] w-[44px] items-center justify-center rounded-full bg-mg-accent font-grotesk font-medium text-[16px] text-white">
              {p.initial}
            </div>
            <div className="font-grotesk font-medium text-[16px] tracking-[-0.01em]">{p.name}</div>
            <div className="mt-[5px] font-mono text-[10px] uppercase tracking-[0.14em] text-mg-fg/60">
              {p.role}
            </div>
          </div>
        ))}
      </HairlineGrid>
    </section>
  );
}
