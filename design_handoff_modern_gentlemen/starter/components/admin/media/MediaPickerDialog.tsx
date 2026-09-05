"use client";

import { useEffect, useState } from "react";
import { clsx } from "@/components/ui/clsx";
import { isPickableAs, type MediaKind, type MediaTag } from "@/lib/domain/media";
import type { AssetView } from "@/lib/services/media";
import { Dialog } from "../ui/Dialog";
import { CONTROL } from "../ui/styles";
import { MediaGrid } from "./MediaGrid";
import { useMediaPicker } from "./MediaPickerContext";
import { usePagedMedia } from "./usePagedMedia";
import { Button } from "../ui/Button";

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
  const [search, setSearch] = useState("");
  const [tagSlug, setTagSlug] = useState("");
  const [tags, setTags] = useState<MediaTag[]>([]);
  const { result, loading, loadingMore, error, loadMore, hasMore, retry } = usePagedMedia({
    list: picker?.search,
    search,
    kind: kind === "video" ? "video" : undefined,
    tagSlug,
    enabled: open,
  });
  const assets = result.assets.filter((asset) => isPickableAs(asset.kind as MediaKind, kind));

  useEffect(() => {
    if (!open || !picker?.listTags) return;
    let cancelled = false;
    void picker.listTags().then((result) => {
      if (!cancelled && result.ok) setTags(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, picker]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={kind === "image" ? "Choose an image" : "Choose a video"}
      description="Assets come from the media library. Uploading is done there."
      size="lg"
    >
      <div className="mb-4 flex gap-3">
        <input
          type="search"
          value={search}
          autoFocus
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search the library"
          aria-label="Search the media library"
          className={clsx(CONTROL, "min-w-0 flex-1")}
        />
        {tags.length > 0 && (
          <select
            value={tagSlug}
            onChange={(event) => setTagSlug(event.target.value)}
            aria-label="Filter media by tag"
            className={clsx(CONTROL, "w-auto")}
          >
            <option value="">All tags</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.slug}>
                {tag.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-3 text-[12px] text-mg-accentSerif">
          {error}{" "}
          <Button size="sm" onClick={retry}>
            Retry
          </Button>
        </p>
      )}

      {loading ? (
        <p className="py-10 text-center text-[13px] text-mg-fg/60">Searching…</p>
      ) : (
        <MediaGrid
          assets={assets}
          onSelect={(asset) => {
            onPick(asset);
            onClose();
          }}
          emptyLabel={
            hasMore
              ? `Load more to find ${kind === "image" ? "an image" : "a video"}.`
              : search || tagSlug
                ? "Nothing in the library matches."
                : `No ${kind === "image" ? "images" : "videos"} in the library yet.`
          }
        />
      )}
      {hasMore && (
        <div className="mt-4">
          <Button onClick={loadMore} disabled={loading || loadingMore}>
            {loadingMore ? "Loading more…" : "Load more assets"}
          </Button>
        </div>
      )}
    </Dialog>
  );
}
