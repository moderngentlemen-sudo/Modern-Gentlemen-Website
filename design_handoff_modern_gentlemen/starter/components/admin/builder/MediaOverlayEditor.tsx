"use client";
import { DEFAULT_MEDIA_OVERLAY, type MediaOverlay } from "@/lib/domain/mediaOverlay";
import { Select } from "../ui/Select";
import { ColorInput } from "../ui/Input";
import { NumberInput } from "../ui/NumberInput";
export function MediaOverlayEditor({
  value,
  onChange,
  label = "Media overlay",
}: {
  label?: string;
  value?: MediaOverlay;
  onChange: (value: MediaOverlay) => void;
}) {
  const o = value || DEFAULT_MEDIA_OVERLAY;
  const set = (patch: Partial<MediaOverlay>) => onChange({ ...o, ...patch });
  return (
    <fieldset className="space-y-3">
      <legend>{label}</legend>
      <Select
        label="Overlay style"
        value={o.mode}
        options={["none", "solid", "linear", "radial"].map((value) => ({ value, label: value }))}
        onChange={(v) => set({ mode: v as MediaOverlay["mode"] })}
      />
      {o.mode !== "none" && (
        <>
          <ColorInput label="Overlay color" value={o.color} onChange={(color) => set({ color })} />
          <NumberInput
            label="Overlay opacity · %"
            min={0}
            max={100}
            value={o.opacity}
            onChange={(v) => v !== undefined && set({ opacity: v })}
          />
          {o.mode !== "solid" && (
            <>
              <ColorInput
                label="Gradient end color"
                value={o.endColor}
                onChange={(endColor) => set({ endColor })}
              />
              <NumberInput
                label="Gradient angle"
                min={0}
                max={360}
                value={o.angle}
                onChange={(v) => v !== undefined && set({ angle: v })}
              />
              {(
                [
                  ["start", "First stop"],
                  ["end", "Last stop"],
                  ...(o.mode === "radial"
                    ? [
                        ["x", "Center X"],
                        ["y", "Center Y"],
                      ]
                    : []),
                ] as ["start" | "end" | "x" | "y", string][]
              ).map(([key, label]) => (
                <NumberInput
                  key={key}
                  label={label + " · %"}
                  min={key === "end" ? o.start : 0}
                  max={key === "start" ? o.end : 100}
                  value={o[key]}
                  onChange={(v) => v !== undefined && set({ [key]: v })}
                />
              ))}
            </>
          )}
        </>
      )}
    </fieldset>
  );
}
