import { registry, type BlockType } from "./sections/registry";
import { MissingBlock } from "./sections/MissingBlock";
import { normalizeBlock } from "@/lib/blocks/normalize";
import { manifestFor } from "@/lib/blocks/manifests";
import type { BlockNode } from "@/lib/blocks/types";

/**
 * The stored shape of a section. Aliased to `BlockNode` rather than redeclared,
 * so the renderer and the manifest layer cannot drift into two ideas of what a
 * block is.
 */
export type Block = BlockNode;

/** Walks a page's sections[] and renders each block via the registry.
 *  Used by every composable page (home, category, about, membership).
 *
 *  Props pass through `normalizeBlock` first: manifest defaults are applied and
 *  undeclared keys dropped, so a component receives exactly the prop set its
 *  manifest describes. Normalization is deliberately forgiving — content that
 *  fails its schema renders with its props untouched rather than failing the
 *  page. Reporting bad content is publish validation's job, at authoring time,
 *  where there is an editor to tell.
 *
 *  **Containers recurse.** A block whose manifest declares a `slot` is handed
 *  its rendered children; every other block is called exactly as before — same
 *  element, same props, no wrapper. That asymmetry is deliberate and is what
 *  keeps the sixteen pixel baselines meaningful across this change: a leaf
 *  cannot tell that nesting exists.
 *
 *  `children` never arrives as a prop, either. `normalizeBlock` strips it as a
 *  structural key, so a component receives React nodes and knows nothing about
 *  `BlockNode` — the same separation the block/component split rests on. */
export function SectionRenderer({ sections }: { sections?: Block[] }) {
  if (!sections?.length) return null;
  return (
    <>
      {sections.map((block) => {
        const Cmp = registry[block._type as BlockType];
        if (!Cmp) {
          return process.env.NODE_ENV === "development" ? (
            <MissingBlock key={block._key} type={String(block._type)} />
          ) : null;
        }

        const children = block.children;
        if (manifestFor(block._type)?.slot && children?.length) {
          return (
            // @ts-expect-error — see below; a container is typed no better than
            // a leaf by a lookup on a heterogeneous map.
            <Cmp key={block._key} {...normalizeBlock(block)}>
              <SectionRenderer sections={children} />
            </Cmp>
          );
        }

        // @ts-expect-error — a lookup by string cannot narrow to one component's
        // props; the manifest's Zod schema is what validates them.
        return <Cmp key={block._key} {...normalizeBlock(block)} />;
      })}
    </>
  );
}
