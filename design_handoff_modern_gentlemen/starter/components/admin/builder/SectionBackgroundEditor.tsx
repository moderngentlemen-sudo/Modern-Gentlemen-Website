"use client";
import { readSectionBackground, type SectionBackground } from "@/lib/domain/sectionBackground";
import { MediaUrlControl } from "../fields/MediaUrlControl";
import { TextInput } from "../ui/Input";
import { Toggle } from "../ui/Toggle";
import type { BlockNode } from "@/lib/blocks/types";
import { useBuilder } from "./StoreContext";

export function SectionBackgroundEditor({ node }: { node: BlockNode }) {
  const setDesign = useBuilder((s) => s.setDesign);
  const background = readSectionBackground(node.design?.background);
  const update = (patch: Partial<SectionBackground>) =>
    setDesign(node._key, { background: { ...background, ...patch } });
  return (
    <fieldset disabled={node.locked} className="space-y-3 border-b border-mg-bd/20 p-4">
      <legend className="text-sm">Section background media</legend>
      <TextInput
        label="Section background colour"
        value={background.backgroundColor ?? ""}
        onChange={(backgroundColor) => update({ backgroundColor })}
        placeholder="#0d0d0d"
      />
      <MediaUrlControl
        kind="image"
        label="Section image / video poster"
        disabled={node.locked}
        value={background.backgroundImage ?? ""}
        onChange={(backgroundImage) => update({ backgroundImage })}
      />
      <MediaUrlControl
        kind="video"
        label="Section background video"
        disabled={node.locked}
        value={background.backgroundVideo ?? ""}
        onChange={(backgroundVideo) => update({ backgroundVideo })}
      />
      {(
        [
          ["overlayOpacity", "Section dark overlay", 0, 1, 0.05, 0],
          ["focalX", "Section horizontal focal point", 0, 100, 1, 50],
          ["focalY", "Section vertical focal point", 0, 100, 1, 50],
        ] as const
      ).map(([key, label, min, max, step, fallback]) => (
        <label key={key} className="block text-xs">
          {label}
          <input
            aria-label={label}
            className="w-full"
            type="range"
            min={min}
            max={max}
            step={step}
            value={background[key] ?? fallback}
            onChange={(e) => update({ [key]: Number(e.target.value) })}
          />
        </label>
      ))}
      <Toggle
        label="Play section video on mobile"
        checked={background.videoOnMobile ?? false}
        onChange={(videoOnMobile) => update({ videoOnMobile })}
      />
      <p className="text-xs text-mg-fg/70">
        Media sits behind this section. Its existing opaque content or gradient may cover it. Clear
        those backgrounds when you want the media visible.
      </p>
      <button
        type="button"
        className="text-xs underline"
        onClick={() => setDesign(node._key, { background: undefined })}
      >
        Clear section background media
      </button>
    </fieldset>
  );
}
