import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AssetView } from "@/lib/services/media";
import { usePagedMedia } from "./usePagedMedia";

const assets = (start: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: String(start + i) }) as AssetView);
const page = (start: number, count: number, total: number) => ({
  ok: true as const,
  data: { assets: assets(start, count), total },
});
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
const flush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });

it("appends pages and consumes raw offsets while deduplicating overlapping rows", async () => {
  const list = vi
    .fn()
    .mockResolvedValueOnce(page(0, 60, 120))
    .mockResolvedValueOnce(page(59, 60, 120));
  const { result } = renderHook(() => usePagedMedia({ list, search: "" }));
  await flush();
  await act(async () => {
    await result.current.loadMore();
  });
  expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 60, limit: 60 }));
  expect(result.current.result.assets).toHaveLength(119);
  expect(result.current.hasMore).toBe(false);
});

it("ignores a stale next page when search changes", async () => {
  let resolve!: (value: ReturnType<typeof page>) => void;
  const list = vi
    .fn()
    .mockResolvedValueOnce(page(0, 60, 61))
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    )
    .mockResolvedValueOnce(page(200, 1, 1));
  const { result, rerender } = renderHook(({ search }) => usePagedMedia({ list, search }), {
    initialProps: { search: "" },
  });
  await flush();
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.loadMore();
  });
  rerender({ search: "new" });
  await flush();
  await act(async () => {
    resolve(page(60, 1, 61));
    await pending;
  });
  expect(result.current.result.assets.map((a) => a.id)).toEqual(["200"]);
  expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ search: "new", offset: 0 }));
});

it("keeps loaded assets after failure and permits retrying the same offset", async () => {
  const list = vi
    .fn()
    .mockResolvedValueOnce(page(0, 60, 61))
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(page(60, 1, 61));
  const { result } = renderHook(() => usePagedMedia({ list, search: "" }));
  await flush();
  await act(async () => {
    await result.current.loadMore();
  });
  expect(result.current.error).toMatch(/Could not load/);
  expect(result.current.result.assets).toHaveLength(60);
  await act(async () => {
    await result.current.loadMore();
  });
  expect(result.current.result.assets).toHaveLength(61);
  expect(result.current.error).toBeNull();
});

it("ignores a response after the picker closes and blocks duplicate load-more requests", async () => {
  let resolve!: (value: ReturnType<typeof page>) => void;
  const list = vi
    .fn()
    .mockResolvedValueOnce(page(0, 60, 61))
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    );
  const { result, rerender } = renderHook(
    ({ enabled }) => usePagedMedia({ list, search: "", enabled }),
    { initialProps: { enabled: true } }
  );
  await flush();
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.loadMore();
    void result.current.loadMore();
  });
  expect(list).toHaveBeenCalledTimes(2);
  rerender({ enabled: false });
  await act(async () => {
    resolve(page(60, 1, 61));
    await pending;
  });
  expect(result.current.result.assets).toHaveLength(60);
  expect(result.current.loadingMore).toBe(false);
});

it("retries an initial transport failure and stops after an empty later page", async () => {
  const list = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(page(0, 60, 61))
    .mockResolvedValueOnce(page(60, 0, 61));
  const { result } = renderHook(() => usePagedMedia({ list, search: "" }));
  await flush();
  expect(result.current.loading).toBe(false);
  act(() => result.current.retry());
  await flush();
  await act(async () => {
    await result.current.loadMore();
  });
  expect(result.current.hasMore).toBe(false);
});
