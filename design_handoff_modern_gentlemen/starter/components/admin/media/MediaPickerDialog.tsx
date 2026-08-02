"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "@/components/ui/clsx";
import { isPickableAs, type MediaKind } from "@/lib/domain/media";
import type { AssetView } from "@/lib/services/media";
import { Dialog } from "../ui/Dialog";
import { CONTROL } from "../ui/styles";
import { MediaGrid } from "./MediaGrid";
import { useMediaPicker } from "./MediaPickerContext";

/**
 * Choose an asset for an `image` or `video` field.
 *
 * The filter is by field kind, not by a free choice: a video field asking for a
 * PDF is not a decision worth supporting, and `isPickableAs` is where that rule
 * lives — including the one non-obvious part, that a `gif` belongs in an image
 * field.
 *
 * Picking writes the asset's **public URL** into the block, which is the whole
 * reason no manifest changed for Phase 5. The block stores what it always
 * stored; `lib/services/media` reverses the URL to an asset when it reconciles
 * usage.
 */
export function MediaPickerDialog({
  open,
  onClose,
  onPick,
  kind,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (asset: AssetView) => void;
  kind: "image" | "video";
}) {
  const picker = useMediaPicker();
  const [assets, setAssets] = useState<AssetView[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Same staleness guard as the library: the last request started is the only
  // one allowed to write state.
  const requestId = useRef(0);

  useEffect(() => {
    if (!open || !picker) return;

    const id = ++requestId.current;
    const handle = setTimeout(async () => {
      setLoading(true);
      setError(null);

      // Fetch by kind where the mapping is one-to-one, and filter locally for
      // an image field, which legitimately accepts two kinds. One query either
      // way; `listAssets` takes a single `kind`.
      const result = await picker.search({
        search: search.trim() || undefined,
        kind: kind === "video" ? "video" : undefined,
        limit: 60,
      });
      if (id !== requestId.current) return;

      setLoading(false);
      if (result.ok) {
        setAssets(result.data.assets.filter((a) => isPickableAs(a.kind as MediaKind, kind)));
      } else {
        setError(result.error);
      }
    }, 200);

    return () => clearTimeout(handle);
  }, [open, search, kind, picker]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={kind === "image" ? "Choose an image" : "Choose a video"}
      description="Assets come from the media library. Uploading is done there."
      size="lg"
    >
      <input
        type="search"
        value={search}
        autoFocus
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search the library"
        aria-label="Search the media library"
        className={clsx(CONTROL, "mb-4")}
      />

      {error && <p className="mb-3 text-[12px] text-mg-accentSerif">{error}</p>}

      {loading ? (
        <p className="py-10 text-center text-[13px] text-mg-fg/45">Searching…</p>
      ) : (
        <MediaGrid
          assets={assets}
          onSelect={(asset) => {
            onPick(asset);
            onClose();
          }}
          emptyLabel={
            search
              ? "Nothing in the library matches."
              : `No ${kind === "image" ? "images" : "videos"} in the library yet.`
          }
        />
      )}
    </Dialog>
  );
}
