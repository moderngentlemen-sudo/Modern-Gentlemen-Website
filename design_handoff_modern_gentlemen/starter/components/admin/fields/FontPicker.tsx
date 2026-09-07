"use client";

import { useEffect, useMemo, useState } from "react";
import { FONT_LIBRARY, libraryFont, libraryFontStack } from "@/lib/domain/fontLibrary";
import { TextInput } from "@/components/admin/ui/Input";
import { Select } from "@/components/admin/ui/Select";
import { FontStylesheet } from "@/components/ui/FontStylesheet";

const FAVOURITES_KEY = "mg-builder-font-favourites";
export function FontPicker({
  label,
  value,
  onChange,
  disabled,
  error,
  help,
  sample,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  help?: string;
  sample?: string;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [favourites, setFavourites] = useState<string[]>([]);
  const [onlyFavourites, setOnlyFavourites] = useState(false);
  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(FAVOURITES_KEY) ?? "[]");
      if (Array.isArray(stored))
        setFavourites(
          stored.filter((v): v is string => typeof v === "string" && !!libraryFont(v)).slice(0, 200)
        );
    } catch {
      /* Device storage is optional. */
    }
  }, []);
  const selected = libraryFont(value);
  const matches = useMemo(
    () =>
      FONT_LIBRARY.filter(
        (font) =>
          (!category || font.category === category) &&
          (!onlyFavourites || favourites.includes(font.value)) &&
          font.label.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [query, category, onlyFavourites, favourites]
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
        options={[...new Set(FONT_LIBRARY.map((f) => f.category))].map((c) => ({
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
      <p className="text-xs text-mg-fg/70">
        {matches.length} matching fonts · {FONT_LIBRARY.length} available
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
