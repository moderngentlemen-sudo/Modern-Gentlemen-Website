"use client";

import { clsx } from "@/components/ui/clsx";
import { formatByteSize } from "@/lib/domain/media";
import type { AssetView } from "@/lib/services/media";
import { FOCUS_RING, HAIRLINE } from "../ui/styles";
import { AssetThumb } from "./AssetThumb";

/**
 * The asset grid, shared by the library screen and the picker dialog.
 *
 * A `<button>` per asset rather than a div with a click handler: both callers
 * are asking the editor to *choose* one, and that is a button whether it opens
 * a details panel or fills a field.
 */
export function MediaGrid({
  assets,
  selectedId,
  onSelect,
  emptyLabel = "No assets match.",
}: {
  assets: AssetView[];
  selectedId?: string | null;
  onSelect: (asset: AssetView) => void;
  emptyLabel?: string;
}) {
  if (assets.length === 0) {
    return <p className="px-1 py-10 text-center text-[13px] text-mg-fg/45">{emptyLabel}</p>;
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {assets.map((asset) => {
        const selected = asset.id === selectedId;

        return (
          <li key={asset.id}>
            <button
              type="button"
              onClick={() => onSelect(asset)}
              aria-pressed={selected}
              className={clsx(
                "group block w-full border text-left transition-colors",
                selected ? "border-mg-accent" : clsx(HAIRLINE, "hover:border-mg-fg/40"),
                FOCUS_RING
              )}
            >
              <AssetThumb asset={asset} className="aspect-[4/3] w-full" />
              <span className={clsx("block border-t px-2 py-1.5", HAIRLINE)}>
                <span className="block truncate text-[12px] text-mg-fg/80">
                  {asset.title ?? asset.fileName}
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-mg-fg/40">
                  <span>{asset.kind}</span>
                  <span>{formatByteSize(asset.byteSize)}</span>
                </span>
                {/*
                  Missing alt text is worth surfacing in the grid rather than
                  only in the details panel. It is the one piece of metadata a
                  published page cannot do without, and the grid is where an
                  editor sees forty assets at once.
                */}
                {(asset.kind === "image" || asset.kind === "gif") && !asset.altText && (
                  <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.14em] text-mg-accentSerif">
                    No alt text
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
