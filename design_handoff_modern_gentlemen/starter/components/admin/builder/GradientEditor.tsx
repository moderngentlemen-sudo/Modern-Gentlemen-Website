"use client";
import { useEffect, useState } from "react";
import { gradientCss, type Gradient } from "@/lib/domain/gradient";
import { LiveColourPicker } from "../fields/LiveColourPicker";
const INITIAL: Gradient = {
  angle: 180,
  stops: [
    { color: "#111111", position: 0 },
    { color: "#773344", position: 100 },
  ],
};
export function GradientEditor({
  value,
  onChange,
  onPreview,
  disabled = false,
}: {
  value?: Gradient;
  onChange: (value: Gradient | undefined) => void;
  onPreview: (value: Gradient | null) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<Gradient | null>(null);
  const signature = JSON.stringify(value);
  useEffect(() => setDraft(null), [signature]);
  const [active, setActive] = useState(0);
  const gradient = draft ?? value ?? INITIAL;
  const index = Math.min(active, gradient.stops.length - 1);
  const change = (next: Gradient) => {
    setDraft(null);
    onPreview(null);
    onChange(next);
  };
  const preview = (next: Gradient) => {
    setDraft(next);
    onPreview(next);
  };
  const cancel = () => {
    setDraft(null);
    onPreview(null);
  };
  const stop = (patch: Partial<Gradient["stops"][number]>) => ({
    ...gradient,
    stops: gradient.stops.map((s, i) => (i === index ? { ...s, ...patch } : s)),
  });
  return (
    <fieldset
      disabled={disabled}
      className="space-y-3 border-b border-mg-bd/20 p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape") cancel();
      }}
    >
      <legend className="text-sm">Gradient background</legend>
      <div
        className="h-12 border border-mg-bd/30"
        style={{ backgroundImage: gradientCss(gradient) }}
      />
      <label className="block text-xs">
        Direction · {gradient.angle}°
        <input
          aria-label="Gradient direction"
          className="w-full"
          type="range"
          min="0"
          max="360"
          value={gradient.angle}
          onChange={(e) => preview({ ...gradient, angle: Number(e.target.value) })}
          onPointerUp={() => {
            if (draft) change(draft);
          }}
          onKeyUp={(e) => {
            if (e.key !== "Escape" && draft) change(draft);
          }}
          onPointerCancel={cancel}
          onBlur={() => {
            if (draft) cancel();
          }}
        />
      </label>
      <div className="flex flex-wrap gap-2" aria-label="Gradient stops">
        {gradient.stops.map((s, i) => (
          <button
            key={i}
            type="button"
            draggable
            aria-pressed={i === index}
            aria-label={`Stop ${i + 1}`}
            className="border border-mg-bd/30 px-2 py-2 text-xs"
            onClick={() => setActive(i)}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", String(i));
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const from = Number(e.dataTransfer.getData("text/plain"));
              if (!Number.isInteger(from) || from < 0 || from >= gradient.stops.length) return;
              const stops = gradient.stops.map((s) => ({ ...s }));
              const colors = stops.map((s) => s.color);
              colors.splice(i, 0, colors.splice(from, 1)[0]);
              change({ ...gradient, stops: stops.map((s, j) => ({ ...s, color: colors[j] })) });
              setActive(i);
            }}
          >
            <span style={{ background: s.color }} className="mr-1 inline-block h-3 w-3" />
            {i + 1}
          </button>
        ))}
      </div>
      <label className="block text-xs">
        Stop position (%)
        <input
          aria-label="Stop position"
          className="w-full border border-mg-bd/30 bg-mg-bg p-2"
          type="number"
          min="0"
          max="100"
          value={gradient.stops[index].position}
          onChange={(e) => {
            const n = e.target.valueAsNumber;
            if (Number.isFinite(n)) change(stop({ position: Math.max(0, Math.min(100, n)) }));
          }}
        />
      </label>
      <LiveColourPicker
        disabled={disabled}
        onPreview={(color) => {
          if (color) preview(stop({ color }));
          else cancel();
        }}
        onChange={(color) => change(stop({ color }))}
      />
      <input
        aria-label="Stop colour hex"
        className="w-full border border-mg-bd/30 bg-mg-bg p-2"
        value={gradient.stops[index].color}
        onChange={(e) => {
          if (/^#[0-9a-f]{6}$/i.test(e.target.value)) change(stop({ color: e.target.value }));
        }}
      />
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          disabled={gradient.stops.length >= 12}
          onClick={() =>
            change({
              ...gradient,
              stops: [...gradient.stops, { color: gradient.stops[index].color, position: 50 }],
            })
          }
        >
          Add stop
        </button>
        <button
          type="button"
          disabled={gradient.stops.length <= 2}
          onClick={() => {
            change({ ...gradient, stops: gradient.stops.filter((_, i) => i !== index) });
            setActive(0);
          }}
        >
          Remove stop
        </button>
        <button
          type="button"
          disabled={index === 0}
          onClick={() => {
            const stops = gradient.stops.map((s) => ({ ...s }));
            [stops[index - 1].color, stops[index].color] = [
              stops[index].color,
              stops[index - 1].color,
            ];
            change({ ...gradient, stops });
            setActive(index - 1);
          }}
        >
          Move earlier
        </button>
        <button
          type="button"
          onClick={() => {
            cancel();
            onChange(undefined);
          }}
        >
          Clear gradient
        </button>
      </div>
    </fieldset>
  );
}
