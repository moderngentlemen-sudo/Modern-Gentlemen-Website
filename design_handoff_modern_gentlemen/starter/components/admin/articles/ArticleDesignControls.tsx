"use client";
import {
  ARTICLE_DESIGN_PRESETS,
  articleDesignById,
  type ArticleDesign,
} from "@/lib/domain/articleDesign";
import { Select } from "../ui/Select";
import { NumberInput } from "../ui/NumberInput";
import { ColorInput } from "../ui/Input";
import { Toggle } from "../ui/Toggle";
import { MediaOverlayEditor } from "../builder/MediaOverlayEditor";
import styles from "./ArticleDesignControls.module.css";
export function ArticleDesignControls({
  value,
  onChange,
  inherit = false,
  disabled = false,
}: {
  value?: ArticleDesign;
  onChange: (value: ArticleDesign) => void;
  inherit?: boolean;
  disabled?: boolean;
}) {
  const design = value || { preset: inherit ? "inherit" : "legacy" };
  const set = (patch: Partial<ArticleDesign>) => onChange({ ...design, ...patch });
  const preset = articleDesignById(design.preset);
  return (
    <fieldset disabled={disabled} className="space-y-4 border-t border-mg-bd/15 pt-4">
      <legend className="text-sm font-medium">Article design collection</legend>
      <Select
        label={inherit ? "Article design" : "Default article design"}
        value={design.preset}
        options={[
          ...(inherit ? [{ value: "inherit", label: "Use Appearance Studio default" }] : []),
          { value: "legacy", label: "Use original template system" },
          ...ARTICLE_DESIGN_PRESETS.map((p) => ({ value: p.id, label: p.name })),
        ]}
        onChange={(value) => set({ preset: value as ArticleDesign["preset"] })}
      />
      {preset && <p className="text-xs leading-relaxed text-mg-fg/60">{preset.description}</p>}
      <details>
        <summary className="cursor-pointer py-2 text-xs">Browse all 29 designs</summary>
        <div className={styles.gallery}>
          {ARTICLE_DESIGN_PRESETS.map((p, i) => (
            <button
              type="button"
              key={p.id}
              aria-pressed={p.id === design.preset}
              onClick={() => set({ preset: p.id })}
            >
              <span className={styles.miniature} data-layout={p.layout} aria-hidden>
                <i />
                <b />
                <em />
              </span>
              <span>
                {String(i + 1).padStart(2, "0")} · {p.name}
              </span>
            </button>
          ))}
        </div>
      </details>
      {design.preset !== "legacy" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["heroHeight", "Media height · px", 240, 1200],
                ["titleSize", "Title size · px", 32, 120],
                ["bodyWidth", "Reading width · px", 420, 900],
                ["bodySize", "Body type · px", 16, 24],
                ["focalX", "Image focus X · %", 0, 100],
                ["focalY", "Image focus Y · %", 0, 100],
              ] as const
            ).map(([key, label, min, max]) => (
              <NumberInput
                key={key}
                label={label}
                min={min}
                max={max}
                value={design[key]}
                onChange={(v) => set({ [key]: v })}
              />
            ))}
          </div>
          <Select
            label="Title alignment"
            value={design.titleAlign || "default"}
            options={["default", "left", "center", "right"].map((value) => ({
              value,
              label: value === "default" ? "Follow design" : value,
            }))}
            onChange={(value) =>
              set({
                titleAlign:
                  value === "default" ? undefined : (value as ArticleDesign["titleAlign"]),
              })
            }
          />
          <ColorInput
            label="Title color"
            value={design.titleColor || ""}
            onChange={(titleColor) => set({ titleColor: titleColor || undefined })}
          />
          <Toggle
            label="Show media in color"
            checked={design.imageColor !== false}
            onChange={(imageColor) => set({ imageColor })}
          />
          <Select
            label="Media fit"
            value={design.mediaFit || "cover"}
            options={[
              { value: "cover", label: "Fill image area" },
              { value: "contain", label: "Show entire image" },
            ]}
            onChange={(mediaFit) => set({ mediaFit: mediaFit as ArticleDesign["mediaFit"] })}
          />
          <MediaOverlayEditor
            label="Article media overlay"
            value={design.overlay}
            onChange={(overlay) => set({ overlay })}
          />
          <details>
            <summary className="cursor-pointer py-2 text-xs">Video playback</summary>
            <div className="space-y-3 pt-3">
              <Toggle
                label="Autoplay uploaded video silently"
                checked={design.autoplay === true}
                onChange={(autoplay) => set({ autoplay })}
              />
              <Toggle
                label="Loop playback"
                checked={design.loop === true}
                onChange={(loop) => set({ loop })}
              />
              <Toggle
                label="Start uploaded video muted"
                checked={design.muted !== false}
                onChange={(muted) => set({ muted })}
              />
              <Toggle
                label="Show native video controls"
                checked={design.controls !== false}
                onChange={(controls) => set({ controls })}
              />
              <Toggle
                label="Show central play button"
                checked={design.showPlayButton !== false}
                onChange={(showPlayButton) => set({ showPlayButton })}
              />
              <p className="text-xs text-mg-fg/60">
                YouTube and Vimeo load when the reader presses play. Pause and sound controls remain
                available for uploaded video.
              </p>
            </div>
          </details>
          <button
            type="button"
            className="text-xs underline"
            onClick={() => onChange({ preset: design.preset })}
          >
            Reset design adjustments
          </button>
        </>
      )}
      <p className="text-xs leading-relaxed text-mg-fg/60">
        {inherit
          ? "Use the featured media section below for images, video, YouTube, or galleries."
          : "Articles can override this default in their Presentation settings."}{" "}
        Assigned builder templates keep their own composition.
      </p>
    </fieldset>
  );
}
