import { beforeEach, expect, it, vi } from "vitest";
import { MAX_MEDIA_UPLOAD_BYTES } from "@/lib/domain/media";
import { uploadAssetAction } from "./actions";
const upload = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/services/media", () => ({ uploadAsset: upload }));
beforeEach(() => vi.clearAllMocks());
it("rejects oversized originals before reading or uploading their bytes", async () => {
  const file = new File(["x"], "large.png", { type: "image/png" });
  Object.defineProperty(file, "size", { value: MAX_MEDIA_UPLOAD_BYTES + 1 });
  const arrayBuffer = vi.fn();
  Object.defineProperty(file, "arrayBuffer", { value: arrayBuffer });
  const form = { get: (key: string) => (key === "file" ? file : null) } as FormData;
  expect(await uploadAssetAction(form)).toEqual({
    ok: false,
    error: "Choose a file no larger than 20 MiB.",
  });
  expect(arrayBuffer).not.toHaveBeenCalled();
  expect(upload).not.toHaveBeenCalled();
});
it("accepts a 2 MiB original for the normal authorized service", async () => {
  const file = new File(["x"], "photo.png", { type: "image/png" });
  const bytes = new ArrayBuffer(2 * 1024 * 1024);
  Object.defineProperty(file, "size", { value: bytes.byteLength });
  Object.defineProperty(file, "arrayBuffer", { value: async () => bytes });
  upload.mockResolvedValue({ id: "saved" });
  const form = { get: (key: string) => (key === "file" ? file : null) } as FormData;
  expect((await uploadAssetAction(form)).ok).toBe(true);
  expect(upload).toHaveBeenCalledWith(
    expect.objectContaining({ fileName: "photo.png", mimeType: "image/png", bytes })
  );
});
