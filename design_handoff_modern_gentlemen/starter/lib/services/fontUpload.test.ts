import { beforeEach, expect, it, vi } from "vitest";
import { ForbiddenError } from "@/lib/domain/permissions";
import {
  DEFAULT_THEME_TYPOGRAPHY,
  themeTypographySchema,
  themeWebfontFaceCssText,
  type ThemeTypography,
} from "@/lib/domain/theme";
import { uploadThemeFont } from "./fontUpload";

const { requirePermission, createClient, upload, from } = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createClient: vi.fn(),
  upload: vi.fn(),
  from: vi.fn(),
}));
vi.mock("./auth", () => ({ requirePermission }));
vi.mock("@/lib/db/server", () => ({ createClient }));

beforeEach(() => {
  vi.resetAllMocks();
  requirePermission.mockResolvedValue({ id: "writer" });
  upload.mockResolvedValue({ error: null });
  from.mockReturnValue({
    upload,
    getPublicUrl: (path: string) => ({
      data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/fonts/${path}` },
    }),
  });
  createClient.mockResolvedValue({ storage: { from } });
});

function fontBytes() {
  const bytes = new ArrayBuffer(32),
    view = new DataView(bytes);
  view.setUint32(0, 0x00010000);
  view.setUint16(4, 1);
  view.setUint32(20, 28);
  view.setUint32(24, 4);
  return bytes;
}

it("refuses a caller without theme.write before opening storage", async () => {
  requirePermission.mockRejectedValue(new ForbiddenError("theme.write"));
  await expect(uploadThemeFont({ fileName: "brand.ttf", bytes: fontBytes() })).rejects.toThrow();
  expect(requirePermission).toHaveBeenCalledWith("theme.write");
  expect(createClient).not.toHaveBeenCalled();
  expect(upload).not.toHaveBeenCalled();
});

it("returns a saveable font with a public URL and immutable upload path", async () => {
  const font = await uploadThemeFont({ fileName: "Brand_Bold.ttf", bytes: fontBytes() });
  expect(from).toHaveBeenCalledWith("fonts");
  expect(upload).toHaveBeenCalledWith(`${font.id}.ttf`, expect.any(ArrayBuffer), {
    contentType: "font/ttf",
    cacheControl: "31536000",
    upsert: false,
  });
  const typography: ThemeTypography = {
    ...DEFAULT_THEME_TYPOGRAPHY,
    heading: `webfont:${font.id}`,
    webfonts: [font],
  };
  expect(themeTypographySchema.safeParse(typography).success).toBe(true);
  expect(font.label).toBe("Brand Bold");
  expect(themeWebfontFaceCssText(typography)).toContain(font.url);
  expect(themeWebfontFaceCssText(typography)).toContain('format("truetype")');
});

it("rejects invalid bytes without uploading and does not return a font after storage fails", async () => {
  await expect(
    uploadThemeFont({ fileName: "renamed.ttf", bytes: new ArrayBuffer(20) })
  ).rejects.toThrow("not a valid font");
  expect(upload).not.toHaveBeenCalled();
  upload.mockResolvedValue({ error: { message: "internal storage detail" } });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  await expect(uploadThemeFont({ fileName: "font.ttf", bytes: fontBytes() })).rejects.toThrow(
    "could not be uploaded"
  );
  log.mockRestore();
});
