import { MAX_MEDIA_UPLOAD_BYTES, MEDIA_UPLOAD_SIZE_MESSAGE } from "@/lib/domain/media";

export type UploadStudioMedia = (
  form: FormData
) => Promise<{ ok: true; data: { url: string } } | { ok: false; error: string }>;

const embeddedMedia = /^data:(?:image|video|audio)\//i;

function mediaFile(url: string, index: number) {
  const comma = url.indexOf(",");
  const header = url.slice(0, comma);
  const mime = /^data:([^;,]+)/i.exec(header)?.[1].toLowerCase();
  if (comma < 0 || !mime)
    throw new Error("The embedded file could not be read. Replace it and retry.");
  const encoded = url.slice(comma + 1);
  let bytes: Uint8Array<ArrayBuffer>;
  if (/;base64$/i.test(header)) {
    // Bound allocation before decoding a potentially very large video.
    const size =
      Math.floor((encoded.length * 3) / 4) -
      (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
    if (size > MAX_MEDIA_UPLOAD_BYTES) throw new Error(MEDIA_UPLOAD_SIZE_MESSAGE);
    try {
      bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    } catch {
      throw new Error("The embedded file could not be read. Replace it and retry.");
    }
  } else {
    if (encoded.length > MAX_MEDIA_UPLOAD_BYTES * 3) throw new Error(MEDIA_UPLOAD_SIZE_MESSAGE);
    try {
      // Text media such as SVG can use percent-encoded UTF-8 instead of base64.
      bytes = new TextEncoder().encode(decodeURIComponent(encoded));
    } catch {
      throw new Error("The embedded file could not be read. Replace it and retry.");
    }
  }
  if (!bytes.length) throw new Error("The embedded file is empty. Replace it and retry.");
  if (bytes.length > MAX_MEDIA_UPLOAD_BYTES) throw new Error(MEDIA_UPLOAD_SIZE_MESSAGE);
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/svg+xml": "svg",
    "video/x-m4v": "m4v",
    "video/quicktime": "mov",
    "video/mpeg": "mpg",
    "audio/mpeg": "mp3",
  };
  const subtype = mime.split("/")[1];
  const extension = extensions[mime] || subtype.replace(/[^a-z0-9]/g, "") || "bin";
  return new File([bytes], `studio-media-${index}.${extension}`, { type: mime });
}

/** Replace shared embedded assets in the source and responsive snapshots before the page action. */
export async function hostStudioMedia<T>(
  document: T,
  upload: UploadStudioMedia,
  cache: Map<string, string>,
  onProgress: (current: number, total: number) => void
): Promise<T> {
  const urls = new Set<string>();
  function collect(value: unknown) {
    if (typeof value === "string" && embeddedMedia.test(value)) urls.add(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object") Object.values(value).forEach(collect);
  }
  collect(document);
  // Do not retain large media removed from the current draft for the whole session.
  for (const url of cache.keys()) if (!urls.has(url)) cache.delete(url);
  let index = 0;
  for (const url of urls) {
    index++;
    if (cache.has(url)) continue;
    onProgress(index, urls.size);
    try {
      const form = new FormData();
      form.set("file", mediaFile(url, index));
      const result = await upload(form);
      if (!result.ok) throw new Error(result.error);
      const hosted = new URL(result.data.url);
      if (!["https:", "http:"].includes(hosted.protocol))
        throw new Error("The upload did not return a hosted media URL.");
      cache.set(url, result.data.url);
    } catch (error) {
      throw new Error(
        `Save to site failed. Media ${index} of ${urls.size}: ${error instanceof Error ? error.message : "Upload failed. Try saving again."} Your browser draft is still available.`
      );
    }
  }
  function replace(value: unknown): unknown {
    if (typeof value === "string") return cache.get(value) ?? value;
    if (Array.isArray(value)) return value.map(replace);
    if (value && typeof value === "object")
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replace(item)]));
    return value;
  }
  // Leave the captured document and the iframe's browser draft untouched, even on failure.
  return replace(document) as T;
}
