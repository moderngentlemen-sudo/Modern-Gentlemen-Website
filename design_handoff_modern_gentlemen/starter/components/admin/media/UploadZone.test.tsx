import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MAX_MEDIA_UPLOAD_BYTES } from "@/lib/domain/media";
import { UploadZone } from "./UploadZone";
afterEach(cleanup);
it("continues after a transport failure and restores the picker", async () => {
  const upload = vi
    .fn()
    .mockRejectedValueOnce(new Error("Connection lost"))
    .mockResolvedValueOnce({ ok: true, data: { id: "saved" } });
  const onUploaded = vi.fn(),
    onError = vi.fn();
  const { container } = render(
    <UploadZone upload={upload} folderId={null} onUploaded={onUploaded} onError={onError} />
  );
  fireEvent.change(container.querySelector('input[type="file"]')!, {
    target: { files: [new File(["one"], "one.png"), new File(["two"], "two.png")] },
  });
  await waitFor(() => expect(onUploaded).toHaveBeenCalledWith({ id: "saved" }));
  expect(onError).toHaveBeenCalledWith("one.png: Upload failed. Please try this file again.");
  expect(screen.getByRole("button", { name: "Choose files" })).toBeEnabled();
});
it("rejects oversized files locally and still uploads the next file", async () => {
  const upload = vi.fn().mockResolvedValue({ ok: true, data: { id: "saved" } }),
    onError = vi.fn();
  const big = new File(["x"], "large.png");
  Object.defineProperty(big, "size", { value: MAX_MEDIA_UPLOAD_BYTES + 1 });
  const { container } = render(
    <UploadZone upload={upload} folderId={null} onUploaded={vi.fn()} onError={onError} />
  );
  fireEvent.change(container.querySelector('input[type="file"]')!, {
    target: { files: [big, new File(["ok"], "small.png")] },
  });
  await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
  expect(onError).toHaveBeenCalledWith("large.png: Choose a file no larger than 20 MiB.");
});
it("ignores a second drop while a batch is uploading", async () => {
  let resolve!: (value: unknown) => void;
  const upload = vi.fn(
    () =>
      new Promise((resolvePromise) => {
        resolve = resolvePromise;
      })
  );
  const { container } = render(
    <UploadZone upload={upload as never} folderId={null} onUploaded={vi.fn()} onError={vi.fn()} />
  );
  const input = container.querySelector('input[type="file"]')!;
  const files = [new File(["same"], "same.png")];
  fireEvent.change(input, { target: { files } });
  fireEvent.change(input, { target: { files } });
  expect(upload).toHaveBeenCalledTimes(1);
  resolve({ ok: true, data: { id: "saved" } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Choose files" })).toBeEnabled());
});
