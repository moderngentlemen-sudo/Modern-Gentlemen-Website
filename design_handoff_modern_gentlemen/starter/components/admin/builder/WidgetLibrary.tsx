"use client";
import { useState } from "react";
import { WIDGET_DESIGNS } from "@/lib/blocks/widgets";
import { blockCatalog } from "@/components/sections/registry";
import { TextInput } from "@/components/admin/ui/Input";
import { newBlockNode } from "./node";
import { useBuilder } from "./StoreContext";
import { findBlock } from "@/lib/blocks/traverse";
import { manifestFor } from "@/lib/blocks/manifests";
import { locate } from "./tree";
import { BlockPreview } from "./BlockPreview";
import { WidgetStudio } from "@/components/sections/WidgetStudio";
export function WidgetLibrary() {
  const [query, setQuery] = useState(""),
    [preview, setPreview] = useState<string | null>(null);
  const tree = useBuilder((s) => s.tree),
    selected = useBuilder((s) => s.selectedKey),
    insert = useBuilder((s) => s.insertMany);
  const entries = [
    ...WIDGET_DESIGNS.map((w) => ({
      type: "widgetStudio",
      variant: w.id,
      label: w.label,
      description: w.description,
    })),
    ...blockCatalog.filter((b) => b.type.startsWith("native")).map((b) => ({ ...b, variant: "" })),
  ];
  const shown = entries.filter((w) =>
    `${w.label} ${w.description}`.toLowerCase().includes(query.toLowerCase().trim())
  );
  function add(type: string, variant: string) {
    const node = newBlockNode(type);
    if (variant) node.settings = { ...node.settings, variant };
    const parent = selected ? findBlock(tree, selected) : null;
    const slot = parent ? manifestFor(parent._type)?.slot : null;
    const at = selected ? locate(tree, selected) : null;
    if (parent && slot && (!slot.allow || slot.allow.includes(type)) && !parent.locked)
      insert([node], undefined, parent._key);
    else insert([node], at ? at.index + 1 : undefined, at?.parentKey ?? null);
  }
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-mg-bd/20 p-3">
        <TextInput
          label="Widget studio"
          placeholder="Search widgets…"
          value={query}
          onChange={setQuery}
        />
        <p className="mt-2 text-xs text-mg-fg/70">
          Select a grid or container to insert inside it. Every widget remains editable.
        </p>
      </div>
      <div className="overflow-y-auto">
        {shown.length === 0 && <p className="p-4 text-sm">No matching widgets.</p>}
        {shown.map((w) => (
          <div key={`${w.type}-${w.variant}`} className="border-b border-mg-bd/20 p-3">
            <button
              type="button"
              onClick={() => add(w.type, w.variant)}
              className="w-full text-left"
            >
              <span className="block text-sm font-medium">{w.label}</span>
              <span className="block text-xs text-mg-fg/70">{w.description}</span>
            </button>
            {
              <button
                type="button"
                className="mt-2 text-xs underline"
                onClick={() =>
                  setPreview(preview === `${w.type}-${w.variant}` ? null : `${w.type}-${w.variant}`)
                }
              >
                Preview {w.label}
              </button>
            }
            {preview === `${w.type}-${w.variant}` && (
              <div className="mt-3 overflow-hidden" inert aria-hidden="true">
                {w.type === "widgetStudio" ? (
                  <WidgetStudio
                    variant={w.variant}
                    title="Sample preview"
                    target="2099-01-01T00:00:00Z"
                    text="Preview content"
                    value="01"
                    progress={50}
                    padding={8}
                    size={24}
                    mobileSize={24}
                    items={[
                      { title: "First", text: "First panel", href: "https://example.com" },
                      { title: "Second", text: "Second panel" },
                    ]}
                  />
                ) : (
                  <BlockPreview type={w.type} />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
