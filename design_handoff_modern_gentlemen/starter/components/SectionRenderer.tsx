import { GridCell } from "./sections/GridLayout";
import { Fragment, type ComponentType, type ReactNode } from "react";
import { registry, type BlockType } from "./sections/registry";
import { MissingBlock } from "./sections/MissingBlock";
import { normalizeBlock } from "@/lib/blocks/normalize";
import { manifestFor } from "@/lib/blocks/manifests";
import type { BlockNode } from "@/lib/blocks/types";
import { BlockDesignFrame } from "./BlockDesignFrame";
import { VisualElementFrame } from "./VisualElementFrame";
import { BlockVisibilityFrame } from "./BlockVisibilityFrame";
import { DOCUMENT_CONTENT_TYPE } from "@/lib/blocks/templateContent";

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
export function SectionRenderer({
  sections,
  documentContent,
}: {
  sections?: Block[];
  /** Runtime content inserted at a template marker. */
  documentContent?: ReactNode;
}) {
  if (!sections?.length) return null;
  return (
    <>
      {sections.map((block) => {
        if (block._type === DOCUMENT_CONTENT_TYPE && documentContent !== undefined) {
          return <Fragment key={block._key}>{documentContent}</Fragment>;
        }

        const Cmp = registry[block._type as BlockType];
        if (!Cmp) {
          return process.env.NODE_ENV === "development" ? (
            <MissingBlock key={block._key} type={String(block._type)} />
          ) : null;
        }
        const Component = Cmp as ComponentType<Record<string, unknown>>;

        const children = block.children;
        if (manifestFor(block._type)?.slot && children?.length) {
          return (
            <BlockVisibilityFrame
              key={block._key}
              blockKey={block._key}
              visibility={block.visibility}
            >
              <BlockDesignFrame design={block.design}>
                <VisualElementFrame blockKey={block._key} visual={block.visual}>
                  <Component {...normalizeBlock(block)}>
                    {block._type === "gridLayout" ? (
                      children.map((child) => (
                        <BlockVisibilityFrame
                          key={child._key}
                          blockKey={child._key}
                          visibility={child.visibility}
                        >
                          <GridCell grid={child.visual?.grid}>
                            <SectionRenderer sections={[child]} documentContent={documentContent} />
                          </GridCell>
                        </BlockVisibilityFrame>
                      ))
                    ) : (
                      <SectionRenderer sections={children} documentContent={documentContent} />
                    )}
                  </Component>
                </VisualElementFrame>
              </BlockDesignFrame>
            </BlockVisibilityFrame>
          );
        }

        return (
          <BlockVisibilityFrame
            key={block._key}
            blockKey={block._key}
            visibility={block.visibility}
          >
            <BlockDesignFrame design={block.design}>
              <VisualElementFrame blockKey={block._key} visual={block.visual}>
                <Component {...normalizeBlock(block)} />
              </VisualElementFrame>
            </BlockDesignFrame>
          </BlockVisibilityFrame>
        );
      })}
    </>
  );
}
