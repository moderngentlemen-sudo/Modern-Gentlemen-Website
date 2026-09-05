"use client";

import { useRef, useState } from "react";
import { MAX_MEDIA_UPLOAD_BYTES, MEDIA_UPLOAD_SIZE_MESSAGE } from "@/lib/domain/media";
import { clsx } from "@/components/ui/clsx";
import type { ActionResult } from "@/app/(admin)/admin/_lib/action-result";
import type { AssetView } from "@/lib/services/media";
import { Button } from "../ui/Button";
import { FOCUS_RING, LABEL_SM } from "../ui/styles";

export type UploadAction = (formData: FormData) => Promise<ActionResult<AssetView>>;

/**
 * Drop files here, or pick them.
 *
 * Uploads run one at a time rather than in parallel. Deduplication is a
 * read-then-write against `checksum`, so two identical files racing each other
 * would both miss the existing row and both insert — and the second would fail
 * on the unique `(bucket, storage_path)`… except their paths differ, so it
 * would quietly succeed and leave a duplicate. Sequential uploads make the
 * dedupe check mean what it says.
 */
export function UploadZone({
  upload,
  folderId,
  onUploaded,
  onError,
}: {
  upload: UploadAction;
  folderId: string | null;
  onUploaded: (asset: AssetView) => void;
  onError: (message: string) => void;
}) {
  const sendingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);

  async function send(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0 || sendingRef.current) return;
    sendingRef.current = true;

    setBusy({ done: 0, total: list.length });

    for (const [index, file] of list.entries()) {
      const formData = new FormData();
      formData.set("file", file);
      if (folderId) formData.set("folderId", folderId);

      try {
        if (file.size > MAX_MEDIA_UPLOAD_BYTES)
          onError(`${file.name}: ${MEDIA_UPLOAD_SIZE_MESSAGE}`);
        else {
          const result = await upload(formData);
          if (result.ok) onUploaded(result.data);
          else onError(`${file.name}: ${result.error}`);
        }
      } catch {
        onError(`${file.name}: Upload failed. Please try this file again.`);
      }

      setBusy({ done: index + 1, total: list.length });
    }

    sendingRef.current = false;
    setBusy(null);
    // Clearing the input matters: re-picking the same file after a failed
    // upload fires no change event otherwise, and the editor gets no response.
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void send(event.dataTransfer.files);
      }}
      className={clsx(
        "flex flex-col items-center justify-center gap-2 border border-dashed px-6 py-8 text-center transition-colors",
        dragging ? "border-mg-accent bg-mg-accent/5" : "border-mg-bd/25"
      )}
    >
      <p className={LABEL_SM}>
        {busy
          ? `Uploading ${Math.min(busy.done + 1, busy.total)} of ${busy.total}`
          : "Drop files here"}
      </p>
      <p className="text-[12px] text-mg-fg/60">Up to 20 MiB per file. Uploads run one at a time.</p>
      <Button size="sm" onClick={() => inputRef.current?.click()} disabled={busy !== null}>
        {busy ? "Uploading…" : "Choose files"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*,application/pdf"
        onChange={(event) => {
          if (event.target.files) void send(event.target.files);
        }}
        className={clsx("sr-only", FOCUS_RING)}
      />
    </div>
  );
}
