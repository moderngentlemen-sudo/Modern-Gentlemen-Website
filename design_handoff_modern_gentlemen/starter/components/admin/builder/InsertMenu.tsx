"use client";

import { useMemo, useState } from "react";
import { clsx } from "@/components/ui/clsx";
import { blockCatalog } from "@/components/sections/registry";
import { BLOCK_CATEGORIES } from "@/lib/blocks/types";
import { TextInput } from "@/components/admin/ui/Input";
import { FOCUS_RING, HAIRLINE, LABEL_SM } from "@/components/admin/ui/styles";

/**
 * The section picker.
 *
 * Fed straight from `blockCatalog`, which `components/sections/registry.ts`
 * already derives from the manifests — so a block's label and description have
 * exactly one home, and a new block appears here the moment its manifest exists.
 *
 * Groups iterate `BLOCK_CATEGORIES` rather than the categories present in the
 * catalogue, so the order is the declared one (hero, editorial, commerce, bands,
 * people) instead of whatever order blocks happen to be registered in.
 */
export function InsertMenu({ onInsert }: { onInsert: (type: string) => void }) {
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matches = term
      ? blockCatalog.filter(
          (block) =>
            block.label.toLowerCase().includes(term) ||
            block.description.toLowerCase().includes(term)
        )
      : blockCatalog;

    return BLOCK_CATEGORIES.map((category) => ({
      category,
      blocks: matches.filter((block) => block.category === category),
    })).filter((group) => group.blocks.length > 0);
  }, [query]);

  return (
    <div className="flex h-full flex-col">
      <div className={clsx("border-b px-3 py-3", HAIRLINE)}>
        <TextInput label="Add a section" value={query} onChange={setQuery} placeholder="Search…" />
      </div>

      <div className="flex-1 overflow-y-auto">
        {grouped.length === 0 && (
          <p className="px-3 py-6 text-center text-[12px] text-mg-fg/40">
            No section matches “{query}”.
          </p>
        )}

        {grouped.map((group) => (
          <section key={group.category} className={clsx("border-b", HAIRLINE)}>
            <h3 className={clsx(LABEL_SM, "px-3 pb-1 pt-3")}>{group.category}</h3>
            <ul>
              {group.blocks.map((block) => (
                <li key={block.type}>
                  <button
                    type="button"
                    onClick={() => onInsert(block.type)}
                    className={clsx(
                      "block w-full px-3 py-2 text-left transition-colors hover:bg-mg-fg/5",
                      FOCUS_RING
                    )}
                  >
                    <span className="block text-[13px] font-medium">{block.label}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-mg-fg/45">
                      {block.description}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
