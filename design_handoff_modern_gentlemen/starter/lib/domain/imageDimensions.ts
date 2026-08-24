/**
 * Intrinsic pixel dimensions, read from an image's own header — pure, no I/O.
 *
 * `media_assets.width` and `.height` have existed since `0002_media.sql` and
 * `insertAsset` has accepted them since Phase 5a. **Nothing ever passed one**,
 * so every asset in the library has held null for both, and `AssetDetails`'
 * "Dimensions" row — which is guarded on `asset.width && asset.height` — has
 * never rendered for any asset. The gap was in the service, not the schema.
 *
 * **A header parser rather than an image library**, for three reasons. It adds
 * no dependency to a project that has none for this; it reads at most the first
 * few dozen bytes rather than decoding a 20 MB photograph to learn two numbers;
 * and it is pure, so it can live in `lib/domain` and be tested against byte
 * fixtures instead of against files.
 *
 * ⚠️ **No `node:` import here, deliberately.** This module is pure by the
 * layering rules, and `lib/domain` modules get imported by client components —
 * a `node:buffer` in one of them is an `UnhandledSchemeError` at build time
 * with every other gate green. `DataView` and `Uint8Array` are enough.
 *
 * Unknown or unsupported formats return `null` rather than throwing or
 * guessing. A null width is what the column has always held; a *wrong* one
 * would be worse than none, because `next/image` would size against it.
 */

export interface ImageDimensions {
  width: number;
  height: number;
}

/** Guards every read: a truncated file must return null, not a garbage number. */
function has(bytes: Uint8Array, offset: number, length: number): boolean {
  return offset >= 0 && offset + length <= bytes.length;
}

function startsWith(bytes: Uint8Array, ascii: string, offset = 0): boolean {
  if (!has(bytes, offset, ascii.length)) return false;
  for (let i = 0; i < ascii.length; i++) {
    if (bytes[offset + i] !== ascii.charCodeAt(i)) return false;
  }
  return true;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPng(bytes: Uint8Array): boolean {
  return has(bytes, 0, 8) && PNG_SIGNATURE.every((byte, i) => bytes[i] === byte);
}

/**
 * PNG — a fixed-position read.
 *
 * IHDR is required by the spec to be the first chunk, so width and height are
 * always at 16 and 20, big-endian. The chunk type is checked anyway: an APNG or
 * a file with a leading private chunk would otherwise yield two numbers read
 * out of whatever happened to be there.
 */
function pngDimensions(view: DataView, bytes: Uint8Array): ImageDimensions | null {
  if (!has(bytes, 12, 12) || !startsWith(bytes, "IHDR", 12)) return null;
  return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
}

/** GIF — `GIF87a`/`GIF89a`, then the logical screen size as two little-endian shorts. */
function gifDimensions(view: DataView, bytes: Uint8Array): ImageDimensions | null {
  if (!has(bytes, 6, 4)) return null;
  return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
}

/**
 * The JPEG start-of-frame markers, which are the only ones carrying a size.
 *
 * `0xc4`, `0xc8` and `0xcc` sit inside the `0xc0`–`0xcf` run and are **not**
 * frame headers — they are the Huffman table, a JPEG extension and the
 * arithmetic-coding table. Treating the range as contiguous is the classic bug
 * here: it reads a table's contents as a picture's dimensions.
 */
function isStartOfFrame(marker: number): boolean {
  if (marker < 0xc0 || marker > 0xcf) return false;
  return marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

/**
 * JPEG — a walk, because the frame header's position is not fixed.
 *
 * Segments carry their own length, so the scan hops rather than searching for a
 * byte pattern, which would find one inside compressed data soon enough. The
 * loop is bounded by the buffer and by a non-advancing length, so a malformed
 * file terminates rather than spinning.
 */
function jpegDimensions(view: DataView, bytes: Uint8Array): ImageDimensions | null {
  let offset = 2;

  while (has(bytes, offset, 4)) {
    if (bytes[offset] !== 0xff) return null;

    const marker = bytes[offset + 1];

    // Standalone markers: padding, restart markers and start-of-image carry no
    // length field, so skipping by a length that is not there would desync.
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }

    const length = view.getUint16(offset + 2, false);
    if (length < 2) return null;

    if (isStartOfFrame(marker)) {
      // Height precedes width in a SOF segment, which is the opposite of every
      // other format here and reliably gets transposed.
      if (!has(bytes, offset + 9, 0)) return null;
      return {
        width: view.getUint16(offset + 7, false),
        height: view.getUint16(offset + 5, false),
      };
    }

    offset += 2 + length;
  }

  return null;
}

/**
 * WebP — three container variants, and each stores its size differently.
 *
 * `VP8 ` is lossy, `VP8L` lossless and `VP8X` extended (animation, alpha). A
 * parser that handles only the first silently returns null for most modern
 * WebP files, which is how a format "works" in testing and populates nothing in
 * production.
 */
function webpDimensions(view: DataView, bytes: Uint8Array): ImageDimensions | null {
  if (!startsWith(bytes, "WEBP", 8)) return null;

  // Lossy: a 3-byte frame tag, then the 3-byte start code, then the size — each
  // 14 bits, the top two of each short being the scaling hint.
  if (startsWith(bytes, "VP8 ", 12) && has(bytes, 26, 4)) {
    return {
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff,
    };
  }

  // Lossless: 14 bits of (width - 1) then 14 of (height - 1), packed across
  // four little-endian bytes after the 0x2f signature.
  if (startsWith(bytes, "VP8L", 12) && has(bytes, 21, 4) && bytes[20] === 0x2f) {
    const packed = view.getUint32(21, true);
    return {
      width: (packed & 0x3fff) + 1,
      height: ((packed >> 14) & 0x3fff) + 1,
    };
  }

  // Extended: the canvas size as two 24-bit little-endian values, each stored
  // one less than the real dimension.
  if (startsWith(bytes, "VP8X", 12) && has(bytes, 24, 6)) {
    const read24 = (at: number) => bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16);
    return { width: read24(24) + 1, height: read24(27) + 1 };
  }

  return null;
}

/**
 * The dimensions of an image, or null if they cannot be read with certainty.
 *
 * Null covers a format this does not parse (SVG, AVIF, HEIC), a file truncated
 * before its header is complete, and anything that is not an image at all. The
 * caller stores null, which is exactly what the column held before.
 */
export function readImageDimensions(input: ArrayBuffer | Uint8Array): ImageDimensions | null {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 16) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const dimensions = isPng(bytes)
    ? pngDimensions(view, bytes)
    : startsWith(bytes, "GIF8")
      ? gifDimensions(view, bytes)
      : bytes[0] === 0xff && bytes[1] === 0xd8
        ? jpegDimensions(view, bytes)
        : startsWith(bytes, "RIFF")
          ? webpDimensions(view, bytes)
          : null;

  // A zero or negative dimension is not a dimension. Returning one would put a
  // 0 in the column, which reads as "known to be zero pixels wide" rather than
  // "not known" and would divide by zero in any aspect-ratio maths.
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) return null;
  return dimensions;
}
