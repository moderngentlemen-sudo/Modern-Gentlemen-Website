/** Upload rules shared by the picker and the authorized storage service. */
export const FONT_BUCKET = "fonts";
export const MAX_FONT_UPLOAD_BYTES = 5 * 1024 * 1024;
export const FONT_UPLOAD_ACCEPT = ".woff,.woff2,.ttf,.otf";
export const FONT_UPLOAD_SIZE_MESSAGE = "Choose a font no larger than 5 MiB.";

const MIME_TYPES = {
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
} as const;
export type FontExtension = keyof typeof MIME_TYPES;

export function fontUploadExtension(name: string): FontExtension | null {
  const extension = name.split(".").pop()?.toLowerCase();
  return extension && Object.hasOwn(MIME_TYPES, extension) ? (extension as FontExtension) : null;
}

export function fontUploadFileError(name: string, size: number): string | null {
  if (!fontUploadExtension(name)) return "Choose a WOFF, WOFF2, TTF or OTF font file.";
  if (size <= 0) return "Choose a font file that is not empty.";
  if (size > MAX_FONT_UPLOAD_BYTES) return FONT_UPLOAD_SIZE_MESSAGE;
  return null;
}

/** Check the container, declared length and table bounds, never the browser MIME. */
export function validateFontUpload(
  name: string,
  bytes: ArrayBuffer
): {
  extension: FontExtension;
  contentType: string;
} {
  const error = fontUploadFileError(name, bytes.byteLength);
  if (error) throw new Error(error);
  const extension = fontUploadExtension(name)!;
  const view = new DataView(bytes);
  const invalid = () => {
    throw new Error(
      "This file is not a valid font in the selected format. Choose another font file."
    );
  };
  if (bytes.byteLength < 12) invalid();
  const signature = view.getUint32(0);
  const sfnt = (value: number) => value === 0x00010000 || value === 0x4f54544f;
  if (extension === "woff" || extension === "woff2") {
    const headerSize = extension === "woff" ? 44 : 48;
    if (
      bytes.byteLength < headerSize ||
      signature !== (extension === "woff" ? 0x774f4646 : 0x774f4632) ||
      !sfnt(view.getUint32(4)) ||
      view.getUint32(8) !== bytes.byteLength ||
      view.getUint16(12) === 0 ||
      view.getUint16(14) !== 0
    )
      invalid();
    const tables = view.getUint16(12);
    if (extension === "woff") {
      if (44 + tables * 20 > bytes.byteLength) invalid();
      for (let i = 0; i < tables; i++) {
        const entry = 44 + i * 20;
        const offset = view.getUint32(entry + 4);
        const length = view.getUint32(entry + 8);
        if (
          offset < 44 + tables * 20 ||
          length === 0 ||
          length > view.getUint32(entry + 12) ||
          offset + length > bytes.byteLength
        )
          invalid();
      }
    } else if (view.getUint32(20) === 0 || 48 + tables * 2 + view.getUint32(20) > bytes.byteLength)
      invalid();
  } else {
    if (signature !== (extension === "otf" ? 0x4f54544f : 0x00010000)) invalid();
    const tables = view.getUint16(4);
    if (tables === 0 || 12 + tables * 16 > bytes.byteLength) invalid();
    for (let i = 0; i < tables; i++) {
      const entry = 12 + i * 16;
      const offset = view.getUint32(entry + 8);
      const length = view.getUint32(entry + 12);
      if (offset < 12 + tables * 16 || length === 0 || offset + length > bytes.byteLength)
        invalid();
    }
  }
  return { extension, contentType: MIME_TYPES[extension] };
}

export function fontUploadLabel(name: string): string {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .trim()
      .slice(0, 60) || "Custom font"
  );
}
