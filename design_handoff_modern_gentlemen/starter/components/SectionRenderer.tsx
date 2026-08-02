import { registry, type BlockType } from "./sections/registry";
import { MissingBlock } from "./sections/MissingBlock";
import { normalizeBlock } from "@/lib/blocks/normalize";
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
 *  where there is an editor to tell. */
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
        // @ts-expect-error — a lookup by string cannot narrow to one component's
        // props; the manifest's Zod schema is what validates them.
        return <Cmp key={block._key} {...normalizeBlock(block)} />;
      })}
    </>
  );
}
