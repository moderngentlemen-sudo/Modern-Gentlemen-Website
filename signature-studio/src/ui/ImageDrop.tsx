import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import type { AssetMeta } from "../core/types";
import { ACCEPT_ATTR, ingestFile, UploadError } from "../store/assets";
import { toast } from "../store/editor";
import { previewSource } from "./samples";
import { useSourcesVersion } from "./SigHtml";

export async function uploadImage(file: File): Promise<AssetMeta | null> {
  try {
    return await ingestFile(file);
  } catch (e) {
    toast(e instanceof UploadError ? e.message : "That image couldn't be added.", "error");
    return null;
  }
}

/** Click or drop an image. Shows the current image when there is one. */
export function ImageDrop({
  assetId,
  onFile,
  round,
  label,
  style,
  children,
  testId,
}: {
  assetId?: string;
  onFile: (meta: AssetMeta) => void;
  round?: boolean;
  label: string;
  style?: CSSProperties;
  children?: ReactNode;
  testId?: string;
}) {
  useSourcesVersion();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const src = assetId ? previewSource(assetId) : null;
  const take = async (file?: File | null) => {
    if (!file) return;
    setBusy(true);
    const meta = await uploadImage(file);
    setBusy(false);
    if (meta) onFile(meta);
  };
  return (
    <>
      <button
        type="button"
        className={`image-drop${round ? " round" : ""}`}
        style={{ ...style, ...(over ? { borderColor: "var(--brand)", background: "var(--brand-soft)" } : {}) }}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void take(e.dataTransfer.files[0]);
        }}
        aria-label={src ? `Replace ${label}` : `Upload ${label}`}
      >
        {busy ? <Loader2 className="spin" size={22} /> : src ? <img src={src} alt="" /> : (children ?? <ImagePlus size={24} />)}
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT_ATTR}
        hidden
        data-testid={testId}
        onChange={(e) => {
          void take(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </>
  );
}
