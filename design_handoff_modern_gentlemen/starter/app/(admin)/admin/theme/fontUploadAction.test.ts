import { beforeEach, expect, it, vi } from "vitest";
import { MAX_FONT_UPLOAD_BYTES } from "@/lib/domain/fontUpload";
import { ForbiddenError, UnauthenticatedError } from "@/lib/domain/permissions";
import { uploadThemeFontAction } from "./actions";
const upload = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/services/fontUpload", () => ({ uploadThemeFont: upload }));
beforeEach(() => vi.resetAllMocks());

function form(size = 100) {
  const file = new File(["font"], "brand.ttf", { type: "application/octet-stream" });
  Object.defineProperty(file, "size", { value: size });
  const read = vi.fn().mockResolvedValue(new ArrayBuffer(100));
  Object.defineProperty(file, "arrayBuffer", { value: read });
  return { read, data: { get: () => file } as unknown as FormData };
}
it("bounds uploads before reading bytes and refuses missing files", async () => {
  const { data, read } = form(MAX_FONT_UPLOAD_BYTES + 1);
  expect(await uploadThemeFontAction(data)).toEqual({
    ok: false,
    error: "Choose a font no larger than 5 MiB.",
  });
  expect(read).not.toHaveBeenCalled();
  expect(upload).not.toHaveBeenCalled();
  expect((await uploadThemeFontAction(new FormData())).ok).toBe(false);
});
it("passes bytes to the authorized service without trusting the browser MIME type", async () => {
  const { data } = form();
  upload.mockResolvedValue({ id: "font" });
  expect(await uploadThemeFontAction(data)).toEqual({ ok: true, data: { id: "font" } });
  expect(upload).toHaveBeenCalledWith({ fileName: "brand.ttf", bytes: expect.any(ArrayBuffer) });
});
it.each([new UnauthenticatedError(), new ForbiddenError("theme.write")])(
  "returns a readable refusal for %s",
  async (error) => {
    upload.mockRejectedValue(error);
    expect(await uploadThemeFontAction(form().data)).toEqual({
      ok: false,
      error: expect.stringMatching(/session has expired|permission/),
    });
  }
);
