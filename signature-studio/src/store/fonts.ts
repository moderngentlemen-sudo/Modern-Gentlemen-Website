/**
 * Brand fonts: font files the user uploads. They are kept on this device (in
 * the asset store), registered with the page so the editor and the publish
 * step can draw with them, and listed on the signature as `customFonts`.
 */
import type { CustomFont } from "../core/types";
import { sha256Hex } from "../lib/hash";
import { assetStore } from "../storage/db";
import { UploadError } from "./assets";

export const FONT_ACCEPT = ".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf";
const MAX_FONT_BYTES = 3 * 1024 * 1024;

/** Recognise a font file by its first bytes, whatever its name or type says. */
export function fontKind(head: Uint8Array): "woff2" | "woff" | "ttf" | "otf" | null {
  const tag = String.fromCharCode(...head.slice(0, 4));
  if (tag === "wOF2") return "woff2";
  if (tag === "wOFF") return "woff";
  if (tag === "OTTO") return "otf";
  if (head[0] === 0 && head[1] === 1 && head[2] === 0 && head[3] === 0) return "ttf";
  if (tag === "true") return "ttf";
  return null;
}

/** A readable family name from a file name: "Acme-Sans_Bold.woff2" → "Acme Sans Bold". */
export function familyFromFile(name: string): string {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .replace(/["'\;<>]/g, "")
      .trim()
      .slice(0, 40) || "Brand font"
  );
}

const registered = new Set<string>();

async function register(f: CustomFont, blob: Blob): Promise<void> {
  if (registered.has(f.family)) return;
  const face = new FontFace(f.family, await blob.arrayBuffer());
  await face.load();
  document.fonts.add(face);
  registered.add(f.family);
}

/** Validate, store and register an uploaded font. */
export async function addFontFile(file: File): Promise<CustomFont> {
  if (file.size > MAX_FONT_BYTES) throw new UploadError("That font file is larger than 3 MB.");
  const kind = fontKind(new Uint8Array(await file.slice(0, 4).arrayBuffer()));
  if (!kind) throw new UploadError("That doesn't look like a font file. Use WOFF2, WOFF, TTF or OTF.");
  const key = `font:${await sha256Hex(file)}`;
  await assetStore.put(key, file);
  const font: CustomFont = { family: familyFromFile(file.name), key, bytes: file.size };
  try {
    await register(font, file);
  } catch {
    throw new UploadError("This font file couldn't be read.");
  }
  return font;
}

/** Register a signature's brand fonts with the page (after opening it). Returns those missing from this device. */
export async function loadFonts(list: CustomFont[] | undefined): Promise<string[]> {
  const missing: string[] = [];
  for (const f of list ?? []) {
    if (registered.has(f.family)) continue;
    const blob = await assetStore.get(f.key);
    if (!blob) missing.push(f.family);
    else await register(f, blob).catch(() => missing.push(f.family));
  }
  return missing;
}
