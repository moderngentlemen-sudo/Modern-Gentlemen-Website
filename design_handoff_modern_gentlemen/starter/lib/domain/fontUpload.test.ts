import { describe, expect, it } from "vitest";
import {
  MAX_FONT_UPLOAD_BYTES,
  fontUploadFileError,
  fontUploadLabel,
  validateFontUpload,
} from "./fontUpload";

function sfnt(signature = 0x00010000) {
  const bytes = new ArrayBuffer(32);
  const view = new DataView(bytes);
  view.setUint32(0, signature);
  view.setUint16(4, 1);
  view.setUint32(20, 28);
  view.setUint32(24, 4);
  return bytes;
}
function woff(version: 1 | 2) {
  const bytes = new ArrayBuffer(version === 1 ? 68 : 56);
  const view = new DataView(bytes);
  view.setUint32(0, version === 1 ? 0x774f4646 : 0x774f4632);
  view.setUint32(4, 0x00010000);
  view.setUint32(8, bytes.byteLength);
  view.setUint16(12, 1);
  if (version === 1) {
    view.setUint32(48, 64);
    view.setUint32(52, 4);
    view.setUint32(56, 4);
  } else view.setUint32(20, 4);
  return bytes;
}

describe("font upload containers", () => {
  it.each([
    ["brand.TTF", sfnt(), "font/ttf"],
    ["brand.otf", sfnt(0x4f54544f), "font/otf"],
    ["brand.woff", woff(1), "font/woff"],
    ["brand.woff2", woff(2), "font/woff2"],
  ])("accepts %s and determines its MIME type from validated bytes", (name, bytes, mime) => {
    expect(validateFontUpload(name as string, bytes as ArrayBuffer).contentType).toBe(mime);
  });

  it("rejects renamed files, mismatched formats, truncation and invalid table bounds", () => {
    for (const bytes of [
      new ArrayBuffer(3),
      new TextEncoder().encode("<html>not a font</html>").buffer,
      woff(1),
    ]) {
      expect(() => validateFontUpload("bad.ttf", bytes)).toThrow("not a valid font");
    }
    const bytes = sfnt();
    new DataView(bytes).setUint32(24, 400);
    expect(() => validateFontUpload("bad.ttf", bytes)).toThrow("not a valid font");
    const compressed = woff(1);
    new DataView(compressed).setUint32(8, 100);
    expect(() => validateFontUpload("bad.woff", compressed)).toThrow("not a valid font");
    expect(() => validateFontUpload("bad.otf", sfnt())).toThrow("not a valid font");
  });

  it("bounds file size and rejects non-font extensions", () => {
    expect(fontUploadFileError("brand.woff2", MAX_FONT_UPLOAD_BYTES)).toBeNull();
    expect(fontUploadFileError("brand.woff2", MAX_FONT_UPLOAD_BYTES + 1)).toContain("5 MiB");
    expect(fontUploadFileError("brand.ttf", 0)).toContain("not empty");
    expect(fontUploadFileError("font.exe", 123)).toContain("WOFF");
  });
  it("derives a bounded editable display name", () => {
    expect(fontUploadLabel("Brand_Sans-Bold.woff2")).toBe("Brand Sans Bold");
    expect(fontUploadLabel("x".repeat(80) + ".ttf")).toHaveLength(60);
    expect(fontUploadLabel(".ttf")).toBe("Custom font");
  });
});
