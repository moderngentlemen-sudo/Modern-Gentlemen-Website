"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FONT_LIBRARY,
  installedFontId,
  isFontValue,
  libraryFont,
  libraryFontStack,
} from "@/lib/domain/fontLibrary";
import { TextInput } from "@/components/admin/ui/Input";
import { Select } from "@/components/admin/ui/Select";
import { FontStylesheet } from "@/components/ui/FontStylesheet";
import { useInstalledFonts } from "./InstalledFonts";

const INSTALLED = "Installed on this site";

const FAVOURITES_KEY = "mg-builder-font-favourites";
export function FontPicker({
  label,
  value,
  onChange,
  disabled,
  error,
  help,
  sample,
  onPreview,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  help?: string;
  sample?: string;
  onPreview?: (value: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [favourites, setFavourites] = useState<string[]>([]);
  const [onlyFavourites, setOnlyFavourites] = useState(false);
  const installed = useInstalledFonts();
  // Installed fonts lead the list: they are the brand's own, already loaded on
  // every page, and the reason an editor opens this picker most of the time.
  const library = useMemo(
    () => [
      ...installed.map((font) => ({
        value: `webfont:${font.id}`,
        label: font.label || font.family,
        category: INSTALLED,
        variants: "",
        source: "installed",
      })),
      ...FONT_LIBRARY,
    ],
    [installed]
  );
  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(FAVOURITES_KEY) ?? "[]");
      if (Array.isArray(stored))
        setFavourites(
          stored.filter((v): v is string => typeof v === "string" && isFontValue(v)).slice(0, 200)
        );
    } catch {
      /* Device storage is optional. */
    }
  }, []);
  const removedId = installedFontId(value);
  const selected =
    library.find((font) => font.value === value) ??
    libraryFont(value) ??
    // A font removed from the theme still shows, so the field never looks empty
    // while the page quietly falls back to the body font.
    (removedId
      ? {
          value: value,
          label: installed.length
            ? `Removed font (${removedId}) — uses the body font`
            : `Site font (${removedId})`,
          category: INSTALLED,
          variants: "",
          source: "installed",
        }
      : undefined);
  const matches = useMemo(
    () =>
      library.filter(
        (font) =>
          (!category || font.category === category) &&
          (!onlyFavourites || favourites.includes(font.value)) &&
          font.label.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [library, query, category, onlyFavourites, favourites]
  );
  // Keep the current choice visible when a filter excludes it, without changing it.
  const choices = selected && !matches.includes(selected) ? [selected, ...matches] : matches;
  function toggleFavourite() {
    if (!selected) return;
    const next = favourites.includes(value)
      ? favourites.filter((f) => f !== value)
      : [...favourites, value].slice(-200);
    setFavourites(next);
    try {
      localStorage.setItem(FAVOURITES_KEY, JSON.stringify(next));
    } catch {
      /* Keep session state. */
    }
  }
  return (
    <div className="space-y-3">
      <TextInput
        label="Search fonts"
        value={query}
        onChange={setQuery}
        disabled={disabled}
        placeholder="Search by family name"
      />
      <Select
        label="Font category"
        value={category}
        onChange={setCategory}
        disabled={disabled}
        placeholder="All categories"
        options={[...new Set(library.map((f) => f.category))].map((c) => ({
          value: c,
          label: c,
        }))}
      />
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={onlyFavourites}
          disabled={disabled}
          onChange={(e) => setOnlyFavourites(e.target.checked)}
        />{" "}
        Favourites on this device
      </label>
      <Select
        label={label}
        value={value}
        onChange={onChange}
        options={choices}
        disabled={disabled}
        error={error}
        help={help}
        placeholder="Use existing style / font role"
      />
      {onPreview && (
        <div
          className="max-h-48 overflow-auto border border-mg-bd/20"
          aria-label="Live font choices"
          onPointerLeave={() => onPreview(null)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) onPreview(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onPreview(null);
          }}
        >
          {matches.slice(0, 40).map((font) => (
            <button
              key={font.value}
              type="button"
              disabled={disabled}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-mg-fg/5"
              onPointerEnter={(e) => {
                if (e.pointerType !== "touch") onPreview(font.value);
              }}
              onFocus={() => onPreview(font.value)}
              onClick={() => {
                onPreview(null);
                onChange(font.value);
              }}
            >
              {font.label}
            </button>
          ))}
        </div>
      )}
      <p className="text-xs text-mg-fg/70">
        {matches.length} matching fonts · {library.length} available
      </p>
      <button
        type="button"
        disabled={disabled || !selected}
        onClick={toggleFavourite}
        aria-pressed={favourites.includes(value)}
        className="text-sm underline disabled:opacity-50"
      >
        {favourites.includes(value) ? "Remove favourite font" : "Favourite this font"}
      </button>
      <FontStylesheet font={value} />
      <p
        aria-label="Font preview"
        className="break-words border border-mg-bd/20 p-3 text-2xl"
        style={{ fontFamily: libraryFontStack(value) }}
      >
        {sample?.slice(0, 180) || "The considered life — Modern Gentlemen"}
      </p>
      {selected?.source === "google" && (
        <p className="text-xs text-mg-fg/70">
          Available styles: {selected.variants.replaceAll("i", " italic").replaceAll(",", ", ")}.
          Loaded from Google Fonts when used.
        </p>
      )}
    </div>
  );
}
