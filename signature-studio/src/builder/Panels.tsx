import { ChevronRight, EyeOff, RotateCcw } from "lucide-react";
import type { Block, Column } from "../core/types";
import { ui, useStudio } from "../store/editor";
import { addBlock, resetLayout } from "./actions";
import { blockLabel, CATALOG, type CatalogItem } from "./catalog";
import { armDrag } from "./dnd";

const GROUPS: CatalogItem["group"][] = ["Layout", "You", "Content", "Promote"];
const GROUP_LABEL: Record<CatalogItem["group"], string> = { Layout: "Layout", You: "About you", Content: "Content", Promote: "Promote" };

export function BlocksPanel() {
  return (
    <>
      <h2>Blocks</h2>
      <p className="lede">Drag a block onto your signature, or tap to add it below the selected block.</p>
      {GROUPS.map((g) => (
        <section key={g}>
          <div className="section-title">{GROUP_LABEL[g]}</div>
          <div className="palette-blocks">
            {CATALOG.filter((c) => c.group === g).map((item) => (
              <button
                key={item.id}
                className="pblock"
                title={item.hint}
                data-testid={`palette-${item.id}`}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  armDrag(e, { kind: "new", create: item.create }, item.label, () => addBlock(item.create()));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    addBlock(item.create());
                  }
                }}
              >
                <span className="pblock-ico">{item.icon}</span>
                <span className="pblock-t">{item.label}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
      <button className="btn sm ghost" style={{ marginTop: 18 }} onClick={resetLayout}>
        <RotateCcw size={14} /> Rebuild layout from template
      </button>
    </>
  );
}

function LayerRows({ column, depth }: { column: Column; depth: number }) {
  const selected = useStudio((s) => s.selected);
  return (
    <>
      {column.blocks.map((b: Block) => (
        <div key={b.id}>
          <button className="layer" aria-current={selected === b.id} style={{ paddingLeft: 10 + depth * 16 }} onClick={() => ui({ selected: b.id })}>
            {b.type === "row" ? <ChevronRight size={13} style={{ transform: "rotate(90deg)" }} /> : <span style={{ width: 13 }} />}
            <span className="grow">{blockLabel(b)}</span>
            {b.visibility && b.visibility !== "both" && (
              <span className="badge" title={b.visibility === "full" ? "New emails only" : "Replies only"}>
                <EyeOff size={11} /> {b.visibility === "full" ? "New" : "Reply"}
              </span>
            )}
          </button>
          {b.type === "row" &&
            b.columns.map((c, i) => (
              <div key={c.id}>
                {b.columns.length > 1 && (
                  <div className="layer-col" style={{ paddingLeft: 26 + depth * 16 }}>
                    Column {i + 1}
                  </div>
                )}
                <LayerRows column={c} depth={depth + 1} />
              </div>
            ))}
        </div>
      ))}
    </>
  );
}

export function LayersPanel() {
  const root = useStudio((s) => s.doc?.blocks);
  return (
    <>
      <h2>Layers</h2>
      <p className="lede">Everything in your signature, top to bottom. Select a layer to edit it.</p>
      <div className="layers">{root ? <LayerRows column={root} depth={0} /> : null}</div>
    </>
  );
}
