import { registry, type BlockType } from "./sections/registry";
import { MissingBlock } from "./sections/MissingBlock";

export interface Block {
  _key: string;
  _type: BlockType | string;
  [key: string]: unknown;
}

/** Walks a page's sections[] and renders each block via the registry.
 *  Used by every composable page (home, category, about, membership). */
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
        // @ts-expect-error — each block's props are validated by its own component
        return <Cmp key={block._key} {...block} />;
      })}
    </>
  );
}
