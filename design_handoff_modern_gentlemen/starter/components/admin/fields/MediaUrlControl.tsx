"use client";

import { useState } from "react";
import { TextInput } from "@/components/admin/ui/Input";
import { Button } from "@/components/admin/ui/Button";
import { MediaPickerDialog } from "@/components/admin/media/MediaPickerDialog";
import { useMediaPicker } from "@/components/admin/media/MediaPickerContext";

/**
 * Image and video fields: a library picker, with the URL box kept underneath it.
 *
 * The URL box is not a leftover. Blocks store a URL string — which is precisely
 * what Phase 5 chose to keep, so no manifest changed and the pixel-verified
 * public site renders the same values it always did. That also means a field can
 * legitimately hold something the library does not own: the demo media in
 * `lib/media.ts` are third-party CDN URLs, and `/public` files are still valid
 * content. Removing the text input to force everything through the library would
 * have made those unrepresentable.
 *
 * The Browse button appears only when a `MediaPickerProvider` sits above it —
 * the admin layout mounts one. Without it (a unit test, say) this degrades to
 * exactly the control it was in Phase 4.
 *
 * The preview is a plain `<img>`, deliberately not `next/image`:
 * `next.config.mjs` only allows `*.supabase.co` in `remotePatterns`, which those
 * same third-party URLs would fail.
 */
export function MediaUrlControl({
  kind,
  label,
  value,
  onChange,
  help,
  error,
  required,
  disabled,
  placeholder,
}: {
  kind: "image" | "video";
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const picker = useMediaPicker();
  const [browsing, setBrowsing] = useState(false);

  return (
    <div>
      <TextInput
        label={label}
        value={value}
        onChange={onChange}
        help={help}
        error={error}
        required={required}
        disabled={disabled}
        placeholder={placeholder ?? (kind === "image" ? "/images/…" : "https://…")}
      />

      {picker && !disabled && (
        <div className="mt-1.5 flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setBrowsing(true)}>
            Browse library
          </Button>
          {value !== "" && (
            <Button size="sm" variant="ghost" onClick={() => onChange("")}>
              Clear
            </Button>
          )}
        </div>
      )}

      {value !== "" && (
        <div className="mt-2 border border-mg-bd/15 bg-mg-bg/40 p-1">
          {kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element -- see the note above
            <img
              src={value}
              alt=""
              className="h-24 w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <video src={value} muted playsInline className="h-24 w-full object-cover" />
          )}
        </div>
      )}

      {picker && (
        <MediaPickerDialog
          open={browsing}
          onClose={() => setBrowsing(false)}
          kind={kind}
          // Alt text stays on the asset rather than being copied into the block:
          // the library is where it is authored, and the grid flags an image
          // that has none. Copying it would fork one description into many.
          onPick={(asset) => onChange(asset.url)}
        />
      )}
    </div>
  );
}
