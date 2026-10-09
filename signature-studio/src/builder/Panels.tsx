import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight, Eye, EyeOff, RotateCcw, Search } from "lucide-react";
import type { Block, Column } from "../core/types";
import { ui, useStudio, treeOf } from "../store/editor";
import { addBlock, nudgeBlock, resetLayout, toggleHidden, toggleInSelection } from "./actions";
import { blockLabel, CATALOG, type CatalogItem } from "./catalog";
import { armDrag } from "./dnd";

const GROUPS: CatalogItem["group"][] = ["Layout", "You", "Content", "Promote", "Ready-made"];
const GROUP_LABEL: Record<CatalogItem["group"], string> = {
  Layout: "Layout",
  You: "About you",
  Content: "Content",
  Promote: "Promote",
  "Ready-made": "Ready-made",
};

export function BlocksPanel() {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const matches = (c: CatalogItem) => !query || `${c.label} ${c.hint} ${c.group}`.toLowerCase().includes(query);
  return (
    <>
      <h2>Blocks</h2>
      <p className="lede">Drag a block onto your signature, or tap to add it below the selected block.</p>
      <div className="palette-search">
        <Search size={16} />
        <input
          className="input"
          placeholder="Find a block: QR, hours, logo…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Find a block"
          data-testid="palette-search"
        />
      </div>
      {GROUPS.filter((g) => CATALOG.some((c) => c.group === g && matches(c))).map((g) => (
        <section key={g}>
          <div className="section-title">{GROUP_LABEL[g]}</div>
          <div className="palette-blocks">
            {CATALOG.filter((c) => c.group === g && matches(c)).map((item) => (
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
  const multi = useStudio((s) => s.multi);
  return (
    <>
      {column.blocks.map((b: Block) => (
        <div key={b.id}>
          <button
            className={`layer${b.visibility === "hidden" ? " is-hidden" : ""}`}
            aria-current={multi.length ? multi.includes(b.id) : selected === b.id}
            style={{ paddingLeft: 10 + depth * 16 }}
            onClick={(e) => (e.shiftKey || e.metaKey || e.ctrlKey ? toggleInSelection(b.id) : ui({ selected: b.id }))}
            data-testid="layer"
          >
            {b.type === "row" ? <ChevronRight size={13} style={{ transform: "rotate(90deg)" }} /> : <span style={{ width: 13 }} />}
            <span className="grow">{blockLabel(b)}</span>
            <span className="layer-actions">
              {[
                {
                  icon: b.visibility === "hidden" ? <Eye size={13} /> : <EyeOff size={13} />,
                  label: b.visibility === "hidden" ? "Show" : "Hide",
                  run: () => toggleHidden(b.id),
                },
                { icon: <ArrowUp size={13} />, label: "Move up", run: () => nudgeBlock(b.id, -1) },
                { icon: <ArrowDown size={13} />, label: "Move down", run: () => nudgeBlock(b.id, 1) },
              ].map((a) => (
                <span
                  key={a.label}
                  role="button"
                  tabIndex={-1}
                  title={a.label}
                  aria-label={`${a.label} ${blockLabel(b)}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    a.run();
                  }}
                >
                  {a.icon}
                </span>
              ))}
            </span>
            {b.visibility && b.visibility !== "both" && b.visibility !== "hidden" && (
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
  const root = useStudio(treeOf);
  return (
    <>
      <h2>Layers</h2>
      <p className="lede">Everything in your signature, top to bottom. Select a layer to edit it.</p>
      <div className="layers">{root ? <LayerRows column={root} depth={0} /> : null}</div>
    </>
  );
}
