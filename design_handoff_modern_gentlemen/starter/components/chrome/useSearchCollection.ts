"use client";
import { useEffect, useMemo, useState } from "react";
import { useCatalog } from "@/lib/catalog/CatalogProvider";
import { matchesSearchQuery, type EditorialSearchEntry } from "@/lib/domain/search";
import { formatGBP } from "@/lib/domain/money";
export type SearchResult = EditorialSearchEntry & {
  collection: "Editorial" | "Store";
  excerpt?: string;
  specs?: { label: string; value: string }[];
};
const cache = new Map<string, { at: number; results: EditorialSearchEntry[] }>();
export function isSearchEntry(value: unknown): value is EditorialSearchEntry {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    ["tag", "title", "meta", "href", "img"].every((k) => typeof r[k] === "string") &&
    typeof r.href === "string" &&
    /^\/article\/[a-z0-9-]+$/i.test(r.href)
  );
}
export function useSearchCollection(query: string, delay: number) {
  const { allProducts } = useCatalog();
  const [editorial, setEditorial] = useState<EditorialSearchEntry[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!query) {
      setEditorial([]);
      setStatus("idle");
      return;
    }
    const saved = cache.get(query);
    if (saved && Date.now() - saved.at < 60000) {
      setEditorial(saved.results);
      setStatus("ready");
      return;
    }
    const controller = new AbortController();
    setEditorial([]);
    setStatus("loading");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/articles?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error("Search unavailable");
        const data = await response.json();
        if (controller.signal.aborted) return;
        const results = Array.isArray(data.results) ? data.results.filter(isSearchEntry) : [];
        cache.delete(query);
        cache.set(query, { at: Date.now(), results });
        while (cache.size > 20) cache.delete(cache.keys().next().value!);
        setEditorial(results);
        setStatus("ready");
      } catch {
        if (!controller.signal.aborted) {
          setEditorial([]);
          setStatus("error");
        }
      }
    }, delay);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, delay, retry]);
  const results = useMemo<SearchResult[]>(
    () =>
      !query
        ? []
        : [
            ...editorial.map((r) => ({ ...r, collection: "Editorial" as const })),
            ...allProducts()
              .filter((p) =>
                matchesSearchQuery([p.name, p.catLabel, p.material, p.tag, p.blurb], query)
              )
              .map((p) => ({
                title: p.name,
                tag: p.catLabel,
                meta: formatGBP(p.price),
                href: `/product/${p.slug}`,
                img: p.images?.[0] || "",
                collection: "Store" as const,
                excerpt: p.blurb || p.story || p.material,
                specs: p.specs.map(([label, value]) => ({ label, value })),
              })),
          ],
    [query, editorial, allProducts]
  );
  return { results, status, retry: () => setRetry((n) => n + 1) };
}
