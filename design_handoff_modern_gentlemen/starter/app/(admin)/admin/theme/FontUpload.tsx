"use client";

import { useId, useRef, useState } from "react";
import { FONT_UPLOAD_ACCEPT, fontUploadFileError } from "@/lib/domain/fontUpload";
import type { ThemeWebfont } from "@/lib/domain/theme";
import { uploadThemeFontAction } from "./actions";

export function FontUpload({
  disabled,
  onUploaded,
  onBusyChange,
}: {
  disabled: boolean;
  onUploaded: (font: ThemeWebfont) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const id = useId();
  const active = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function upload(file: File) {
    if (disabled || active.current) return;
    setError(null);
    setMessage("");
    const invalid = fontUploadFileError(file.name, file.size);
    if (invalid) {
      setError(invalid);
      return;
    }
    active.current = true;
    setBusy(true);
    onBusyChange(true);
    try {
      // The browser's font decoder catches damaged font data before storing it.
      const face = new FontFace("MG Upload Check", await file.arrayBuffer());
      await face.load();
      const data = new FormData();
      data.set("file", file);
      const result = await uploadThemeFontAction(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onUploaded(result.data);
      setMessage(
        `${result.data.label} uploaded. Choose its typography roles, then save the draft.`
      );
    } catch {
      setError("The font could not be read or uploaded. Choose a valid font file and try again.");
    } finally {
      active.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  return (
    <div className="space-y-2 border border-mg-bd/15 p-4">
      <label htmlFor={id} className="block text-[13px] font-medium">
        Upload a custom font
      </label>
      <p id={`${id}-help`} className="text-[12px] leading-relaxed text-mg-fg/60">
        WOFF, WOFF2, TTF or OTF, up to 5 MiB. Upload a font licensed for use on your website. Set
        its weight, style and fallback below. Save and publish the theme to use it on the site.
      </p>
      <input
        id={id}
        type="file"
        accept={FONT_UPLOAD_ACCEPT}
        disabled={disabled || busy}
        aria-describedby={`${id}-help`}
        className="block w-full text-[13px] file:mr-3 file:border file:border-mg-bd/25 file:bg-transparent file:px-3 file:py-2 file:text-mg-fg disabled:opacity-50"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
      <p role="status" className="text-[12px] text-mg-fg/70">
        {busy ? "Uploading font…" : message}
      </p>
      {error && (
        <p role="alert" className="text-[12px] text-mg-accentInk">
          {error}
        </p>
      )}
    </div>
  );
}
