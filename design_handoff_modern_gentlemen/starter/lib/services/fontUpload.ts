import { createClient } from "@/lib/db/server";
import { FONT_BUCKET, fontUploadLabel, validateFontUpload } from "@/lib/domain/fontUpload";
import type { ThemeWebfont } from "@/lib/domain/theme";
import { requirePermission } from "./auth";

/** Immutable font objects remain available to published themes and old revisions. */
export async function uploadThemeFont(input: {
  fileName: string;
  bytes: ArrayBuffer;
}): Promise<ThemeWebfont> {
  await requirePermission("theme.write");
  const { extension, contentType } = validateFontUpload(input.fileName, input.bytes);
  const db = await createClient();
  const id = `custom-${crypto.randomUUID().replaceAll("-", "")}`;
  const path = `${id}.${extension}`;
  const bucket = db.storage.from(FONT_BUCKET);
  const { error } = await bucket.upload(path, input.bytes, {
    contentType,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    console.error("[font upload]", error);
    throw new Error(
      "The font could not be uploaded. Please try again or contact your site administrator."
    );
  }
  return {
    id,
    label: fontUploadLabel(input.fileName),
    // A CSS alias works independently of the font's embedded family name.
    family: `MG Upload ${id.slice(7)}`,
    source: "file",
    url: bucket.getPublicUrl(path).data.publicUrl,
    fallback: "sans",
    weight: "400",
    style: "normal",
  };
}
