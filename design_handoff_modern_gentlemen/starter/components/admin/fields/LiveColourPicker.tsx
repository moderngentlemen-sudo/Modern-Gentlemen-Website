"use client";
import { useState, type PointerEvent } from "react";

export function colourAt(hue: number, saturation: number, value: number) {
  const chroma = value * saturation,
    x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1)),
    m = value - chroma;
  const rgb =
    hue < 60
      ? [chroma, x, 0]
      : hue < 120
        ? [x, chroma, 0]
        : hue < 180
          ? [0, chroma, x]
          : hue < 240
            ? [0, x, chroma]
            : hue < 300
              ? [x, 0, chroma]
              : [chroma, 0, x];
  return (
    "#" +
    rgb
      .map((n) =>
        Math.round((n + m) * 255)
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  );
}

export function LiveColourPicker({
  onPreview,
  onChange,
  disabled,
}: {
  onPreview: (value: string | null) => void;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [hue, setHue] = useState(0),
    [candidate, setCandidate] = useState("#ff0000");
  function pick(e: PointerEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return colourAt(
      hue,
      Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    );
  }
  return (
    <div
      className="space-y-2"
      onPointerLeave={() => onPreview(null)}
      onKeyDown={(e) => {
        if (e.key === "Escape") onPreview(null);
      }}
    >
      <label className="block text-xs">
        Colour hue
        <input
          aria-label="Colour hue"
          type="range"
          min="0"
          max="359"
          value={hue}
          disabled={disabled}
          className="w-full"
          onChange={(e) => setHue(Number(e.target.value))}
        />
      </label>
      <button
        type="button"
        disabled={disabled}
        aria-label={`Preview colour picker; apply ${candidate}`}
        className="block h-28 w-full border border-mg-bd/30"
        style={{
          background: `linear-gradient(to top, #000, transparent),linear-gradient(to right, #fff, hsl(${hue} 100% 50%))`,
        }}
        onPointerMove={(e) => {
          if (e.pointerType === "touch") return;
          const next = pick(e);
          setCandidate(next);
          onPreview(next);
        }}
        onPointerDown={(e) => {
          const next = pick(e);
          setCandidate(next);
        }}
        onClick={() => {
          onPreview(null);
          onChange(candidate);
        }}
        onBlur={() => onPreview(null)}
      />
      <p className="text-xs text-mg-fg/70">Hover to preview · Click to apply · Leave to cancel</p>
    </div>
  );
}
