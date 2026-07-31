"use client";

import { TextInput } from "@/components/admin/ui/Input";

/**
 * Image and video fields, as a URL with a preview.
 *
 * The media library is Phase 5 — there is no media service or repository in the
 * repo at all yet, though the `media.read/write/delete` permissions exist. Until
 * there is one, a URL field with a preview is the honest control: it does
 * everything an editor needs except browse.
 *
 * The preview is a plain `<img>`, deliberately not `next/image`:
 * `next.config.mjs` only allows `*.supabase.co` in `remotePatterns`, and the
 * demo media in `lib/media.ts` are third-party CDN URLs that `next/image` would
 * reject outright.
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
    </div>
  );
}
