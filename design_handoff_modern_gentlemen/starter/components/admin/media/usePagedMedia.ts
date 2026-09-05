"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AssetView } from "@/lib/services/media";
import type { ListAssetsAction } from "./MediaPickerContext";

interface MediaResults {
  assets: AssetView[];
  total: number;
  nextOffset: number;
}

/** Cursor counts fetched rows, including kinds hidden by an image picker. */
export function usePagedMedia({
  list,
  search,
  kind,
  folderId,
  tagSlug,
  enabled = true,
  initialAssets = [],
  initialTotal = 0,
}: {
  list?: ListAssetsAction;
  search: string;
  kind?: string;
  folderId?: string | null;
  tagSlug?: string;
  enabled?: boolean;
  initialAssets?: AssetView[];
  initialTotal?: number;
}) {
  const [result, setResult] = useState<MediaResults>({
    assets: initialAssets,
    total: initialTotal,
    nextOffset: initialAssets.length,
  });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const requestId = useRef(0);
  const morePending = useRef(false);

  const fetchPage = useCallback(
    (offset: number) =>
      list?.({
        search: search.trim() || undefined,
        kind: kind || undefined,
        folderId,
        tagSlug: tagSlug || undefined,
        limit: 60,
        offset,
      }),
    [list, search, kind, folderId, tagSlug]
  );

  useEffect(() => {
    const id = ++requestId.current;
    morePending.current = false;
    setLoadingMore(false);
    setError(null);
    setLoading(enabled && !!list);
    if (!enabled || !list) return;

    const timer = setTimeout(async () => {
      try {
        const response = await fetchPage(0);
        if (id !== requestId.current || !response) return;
        if (response.ok) {
          setResult({ ...response.data, nextOffset: response.data.assets.length });
        } else setError(response.error);
      } catch {
        if (id === requestId.current) setError("Could not load media. Please try again.");
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      requestId.current = id + 1;
    };
  }, [enabled, list, fetchPage, revision]);

  async function loadMore() {
    if (!enabled || loading || morePending.current || result.nextOffset >= result.total) return;
    const id = requestId.current;
    const offset = result.nextOffset;
    morePending.current = true;
    setLoadingMore(true);
    setError(null);
    try {
      const response = await fetchPage(offset);
      if (id !== requestId.current || !response) return;
      if (response.ok) {
        setResult((current) => {
          const ids = new Set(current.assets.map((asset) => asset.id));
          return {
            assets: [
              ...current.assets,
              ...response.data.assets.filter((asset) => !ids.has(asset.id)),
            ],
            total: response.data.total,
            nextOffset: response.data.assets.length
              ? offset + response.data.assets.length
              : response.data.total,
          };
        });
      } else setError(response.error);
    } catch {
      if (id === requestId.current) setError("Could not load media. Please try again.");
    } finally {
      if (id === requestId.current) {
        morePending.current = false;
        setLoadingMore(false);
      }
    }
  }

  return {
    result,
    setResult,
    loading,
    loadingMore,
    error,
    loadMore,
    hasMore: result.nextOffset < result.total,
    retry: () => setRevision((value) => value + 1),
  };
}
