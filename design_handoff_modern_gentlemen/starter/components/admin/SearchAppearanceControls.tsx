"use client";
import {
  SEARCH_LAYOUT_PRESETS,
  SEARCH_MOTION_PRESETS,
  readSearchAppearance,
  type SearchAppearance,
} from "@/lib/domain/searchPresets";
import { Select } from "./ui/Select";
import { NumberInput } from "./ui/NumberInput";
export function SearchAppearanceControls({
  value,
  onChange,
  onPreview,
}: {
  value?: SearchAppearance;
  onChange: (value: SearchAppearance) => void;
  onPreview?: () => void;
}) {
  const settings = readSearchAppearance(value);
  const set = (patch: Partial<SearchAppearance>) => onChange({ ...settings, ...patch });
  const selected = SEARCH_LAYOUT_PRESETS.find((p) => p.id === settings.layout);
  return (
    <fieldset className="space-y-4 border-t border-mg-bd/15 pt-5">
      <legend className="text-sm font-medium">Search experience</legend>
      <Select
        label="Search layout"
        value={settings.layout}
        onChange={(layout) => set({ layout: layout as SearchAppearance["layout"] })}
        options={[
          { value: "legacy", label: "Current site search" },
          ...SEARCH_LAYOUT_PRESETS.map((p) => ({
            value: p.id,
            label: `${p.name}${p.fullscreen ? " · Fullscreen" : ""}`,
          })),
        ]}
      />
      {selected && <p className="text-xs leading-relaxed text-mg-fg/65">{selected.description}</p>}
      <Select
        label="Opening & closing animation"
        value={settings.motion}
        options={[
          { value: "legacy", label: "Current transition" },
          { value: "none", label: "No animation" },
          ...SEARCH_MOTION_PRESETS.map((p) => ({
            value: p.id,
            label: `${p.name} · ${p.openMs} / ${p.closeMs} ms`,
          })),
        ]}
        onChange={(motion) => set({ motion: motion as SearchAppearance["motion"] })}
      />
      <Select
        label="Search color mode"
        value={settings.appearance}
        options={[
          { value: "site", label: "Follow site mode" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
        onChange={(appearance) => set({ appearance: appearance as SearchAppearance["appearance"] })}
      />
      <NumberInput
        label="Initial results"
        min={3}
        max={12}
        integer
        value={settings.initialResults}
        onChange={(initialResults) => initialResults !== undefined && set({ initialResults })}
      />
      <NumberInput
        label="Typing delay · ms"
        min={80}
        max={500}
        integer
        value={settings.debounceMs}
        onChange={(debounceMs) => debounceMs !== undefined && set({ debounceMs })}
      />
      <p className="text-xs leading-relaxed text-mg-fg/60">
        All layouts search published articles and store products. Readers can switch light and dark
        modes. Opening and closing respect reduced motion preferences.
      </p>
      {onPreview && (
        <button
          type="button"
          className="border border-mg-bd/25 px-4 py-2 text-xs"
          onClick={onPreview}
        >
          Preview search & animation
        </button>
      )}
    </fieldset>
  );
}
