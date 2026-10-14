"use client";

import { useState } from "react";
import { uploadAssetAction } from "@/app/(admin)/admin/media/actions";
import { DEFAULT_SITE_IDENTITY, type SiteIdentity } from "@/lib/domain/siteIdentity";
import { MediaPickerDialog } from "./media/MediaPickerDialog";
import { useMediaPicker } from "./media/MediaPickerContext";
import { TextArea, TextInput } from "./ui/Input";

type IconField = "faviconUrl" | "appleTouchIconUrl";
const MAX_ICON_UPLOAD_BYTES = 2 * 1024 * 1024;
const ICON_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function IconPreview({ url, label, size }: { url: string; label: string; size: number }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[10px] text-mg-fg/60">{label}</span>
      <div
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#0d0d0d]"
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- media library URLs can be external */}
        <img src={url} alt="" width={size} height={size} className="h-full w-full object-contain" />
      </div>
    </div>
  );
}

/**
 * Lives inside Appearance Studio's existing theme draft/history/publish flow.
 * Uploads use the SAME permission-checked Media Library action as /admin/media;
 * selecting an asset changes the draft only. The published browser icon changes
 * after the editor saves and publishes the site theme.
 */
export function SiteIdentityControls({
  value,
  onChange,
  canBrowse,
  canUpload,
}: {
  value: SiteIdentity;
  onChange: (value: SiteIdentity) => void;
  canBrowse: boolean;
  canUpload: boolean;
}) {
  const picker = useMediaPicker();
  const [browseField, setBrowseField] = useState<IconField | null>(null);
  const [uploading, setUploading] = useState<IconField | null>(null);
  const [error, setError] = useState("");
  const iconUrl = value.faviconUrl || DEFAULT_SITE_IDENTITY.faviconUrl;

  const change = (key: keyof SiteIdentity, next: string) => {
    setError("");
    onChange({ ...value, [key]: next });
  };

  async function upload(key: IconField, file?: File) {
    if (!file) return;
    if (!ICON_MIME_TYPES.has(file.type)) {
      setError(
        "Upload a PNG, JPEG or WebP image. SVG files can be selected from the media library."
      );
      return;
    }
    if (file.size === 0 || file.size > MAX_ICON_UPLOAD_BYTES) {
      setError("The icon must be between 1 byte and 2 MB.");
      return;
    }
    setError("");
    setUploading(key);
    try {
      const data = new FormData();
      data.set("file", file);
      const result = await uploadAssetAction(data);
      if (!result.ok) throw new Error(result.error);
      change(key, result.data.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The image could not be uploaded.");
    } finally {
      setUploading(null);
    }
  }

  return (
    <>
      <div className="space-y-3">
        <h2>Brand identity</h2>
        <TextInput
          label="Site name"
          value={value.siteName}
          onChange={(name) => change("siteName", name)}
          help={
            "Used for the default document title and browser application name. " +
            "Existing page-level SEO titles remain in control."
          }
        />
        <TextArea
          label="Default site description"
          value={value.description}
          onChange={(description) => change("description", description)}
          rows={3}
          help="A fallback for pages without their own SEO description."
        />
      </div>

      <div className="space-y-3">
        <h2>Browser tab favicon</h2>
        <div
          className="rounded-lg border border-mg-bd/20 bg-[#f4f4f4] p-3 text-[#222]"
          aria-label="Browser tab favicon preview"
        >
          <div className="flex items-center gap-2 rounded-t-lg bg-[#dededb] px-2 py-2 text-xs">
            {/* eslint-disable-next-line @next/next/no-img-element -- editor-selected icon URL */}
            <img src={iconUrl} width={16} height={16} alt="" className="h-4 w-4 object-contain" />
            <span className="min-w-0 truncate">{value.siteName}</span>
            <span className="ml-auto" aria-hidden="true">×</span>
          </div>
          <div className="truncate rounded-b-lg bg-white px-2 py-2 text-[10px] text-gray-500">
            moderngentlemen.co
          </div>
        </div>
        <div className="flex items-end gap-4 rounded-lg border border-mg-bd/15 p-3">
          <IconPreview url={iconUrl} label="16 px" size={16} />
          <IconPreview url={iconUrl} label="32 px" size={32} />
          <IconPreview url={iconUrl} label="64 px" size={64} />
        </div>
        <TextInput
          label="Favicon image URL"
          type="url"
          value={value.faviconUrl}
          onChange={(url) => change("faviconUrl", url)}
          placeholder="/site-icon.svg"
          help={
            "PNG, SVG or WebP from your media library. " +
            "Use a square design with generous padding."
          }
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canBrowse || !picker}
            onClick={() => setBrowseField("faviconUrl")}
          >
            Browse library
          </button>
          <button
            type="button"
            onClick={() => change("faviconUrl", DEFAULT_SITE_IDENTITY.faviconUrl)}
          >
            Restore MG icon
          </button>
        </div>
        {canUpload ? (
          <label className="block text-xs">
            Upload favicon (PNG, JPEG or WebP; max 2 MB)
            <input
              aria-label="Upload favicon"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={uploading !== null}
              className="mt-2 block w-full text-xs"
              onChange={(event) => {
                void upload("faviconUrl", event.currentTarget.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
          </label>
        ) : (
          <p className="text-xs">Uploading requires Media write permission.</p>
        )}
      </div>

      <div className="space-y-3">
        <h2>Apple home-screen icon</h2>
        <div className="flex items-center gap-4">
          <IconPreview
            url={value.appleTouchIconUrl || iconUrl}
            label="Home-screen preview"
            size={72}
          />
          <p className="max-w-[160px] text-[11px] leading-relaxed text-mg-fg/70">
            Use a separate 180 × 180 px PNG for optimal home-screen appearance.
            This preview uses the favicon until you choose one.
          </p>
        </div>
        <TextInput
          label="Apple touch icon URL"
          type="url"
          value={value.appleTouchIconUrl}
          onChange={(url) => change("appleTouchIconUrl", url)}
          placeholder="Optional — select a square PNG"
          help="Only included in live page metadata when set. Best size: 180 × 180 PNG."
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canBrowse || !picker}
            onClick={() => setBrowseField("appleTouchIconUrl")}
          >
            Browse library
          </button>
          {value.appleTouchIconUrl && (
            <button type="button" onClick={() => change("appleTouchIconUrl", "")}>
              Remove touch icon
            </button>
          )}
        </div>
        {canUpload && (
          <label className="block text-xs">
            Upload Apple touch icon (PNG recommended)
            <input
              aria-label="Upload Apple touch icon"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={uploading !== null}
              className="mt-2 block w-full text-xs"
              onChange={(event) => {
                void upload("appleTouchIconUrl", event.currentTarget.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
          </label>
        )}
      </div>
      {uploading && (
        <p role="status" className="text-xs">
          Uploading image to the media library…
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      <p className="text-xs leading-relaxed text-mg-fg/60">
        Changes are drafts until you select Save theme draft and Publish site theme.
        Browser favicon caches may need a hard refresh after publication.
      </p>
      {picker && (
        <MediaPickerDialog
          open={browseField !== null}
          kind="image"
          onClose={() => setBrowseField(null)}
          onPick={(asset) => {
            if (browseField) change(browseField, asset.url);
            setBrowseField(null);
          }}
        />
      )}
    </>
  );
}
