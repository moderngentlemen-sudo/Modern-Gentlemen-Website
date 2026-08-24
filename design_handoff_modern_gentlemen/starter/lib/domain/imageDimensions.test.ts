import { describe, expect, it } from "vitest";

import { readImageDimensions } from "./imageDimensions";

/**
 * Every fixture below is a **real** image, encoded by an image library at
 * 37 x 19 and base64'd into this file.
 *
 * Hand-written header bytes were the obvious alternative and are worth much
 * less: a fixture assembled from the same reading of the same spec as the
 * parser can be wrong in the same direction, and the two would agree with each
 * other while disagreeing with every real file. These came out of an encoder
 * that knows the formats, so a parser that misreads one fails here.
 *
 * 37 x 19 rather than a round number on purpose - two different primes, so a
 * transposed width and height cannot pass, and neither can a value read one
 * field along.
 */
const IMAGES: Record<string, string> = {
  png:
    "iVBORw0KGgoAAAANSUhEUgAAACUAAAATCAIAAACY31PkAAAAJElEQVR4nGM8IaDHQEfARE/LRu0btW/UvlH7Ru0b" +
    "tW/UProAACc1ASzvQ9bfAAAAAElFTkSuQmCC",
  jpeg:
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIs" +
    "IxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy" +
    "MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAATACUDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAA" +
    "AAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAk" +
    "M2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKT" +
    "lJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QA" +
    "HwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdh" +
    "cRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hp" +
    "anN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk" +
    "5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDiaKKK4T9QCiiigAooooAKKKKACiiigAooooA//9k=",
  jpeg_progressive:
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIs" +
    "IxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy" +
    "MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wgARCAATACUDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAA" +
    "AAX/xAAWAQEBAQAAAAAAAAAAAAAAAAAAAwb/2gAMAwEAAhADEAAAAYghqAAAAAP/xAAUEAEAAAAAAAAAAAAAAAAA" +
    "AAAw/9oACAEBAAEFAn//xAAUEQEAAAAAAAAAAAAAAAAAAAAg/9oACAEDAQE/AV//xAAUEQEAAAAAAAAAAAAAAAAA" +
    "AAAg/9oACAECAQE/AV//xAAUEAEAAAAAAAAAAAAAAAAAAAAw/9oACAEBAAY/An//xAAUEAEAAAAAAAAAAAAAAAAA" +
    "AAAw/9oACAEBAAE/IX//2gAMAwEAAgADAAAAEAAAAAAP/8QAFBEBAAAAAAAAAAAAAAAAAAAAIP/aAAgBAwEBPxBf" +
    "/8QAFBEBAAAAAAAAAAAAAAAAAAAAIP/aAAgBAgEBPxBf/8QAFBABAAAAAAAAAAAAAAAAAAAAMP/aAAgBAQABPxB/" +
    "/9k=",
  gif:
    "R0lGODdhJQATAIEAAMgQLgAAAAAAAAAAACwAAAAAJQATAEAILAABCBxIsKDBgwgTKlzIsKHDhxAjSpxIsaLFixgz" +
    "atzIsaPHjyBDihxJsmRAADs=",
  webp_lossy:
    "UklGRkoAAABXRUJQVlA4ID4AAAAwAwCdASolABMAPm02l0ikIyIhJWgAgA2JZwB2AABX8FvAAP7wxAv/Daqytv//" +
    "tof/sHH/YOP18TlMOCAAAA==",
  webp_lossless: "UklGRh4AAABXRUJQVlA4TBEAAAAvJIAEAAdQiCLXpf+BiOh/AAA=",
  webp_extended:
    "UklGRroAAABXRUJQVlA4WAoAAAACAAAAJAAAEgAAQU5JTQYAAAAAAAAAAABBTk1GRAAAAAAAAAAAACQAABIAAGQA" +
    "AAJWUDggLAAAANACAJ0BKiUAEwAuTTabTaEkJCQEAExLSAASF5TSKDgA/v03Lf+1dv/2rCAAQU5NRkIAAAAAAAAA" +
    "AAAkAAASAABkAAAAVlA4ICoAAAB0AgCdASolABMALk02m02AAATEtIABIXlNIoOAAP789Pf/m3d/82sAAAA=",
};

const bytesOf = (name: string) => Uint8Array.from(atob(IMAGES[name]), (char) => char.charCodeAt(0));

describe("readImageDimensions", () => {
  it.each(Object.keys(IMAGES))("reads %s", (name) => {
    expect(readImageDimensions(bytesOf(name))).toEqual({ width: 37, height: 19 });
  });

  it("accepts an ArrayBuffer as well as a view, since that is what an upload holds", () => {
    const bytes = bytesOf("png");
    // `UploadInput.bytes` is an ArrayBuffer, so this is the shape the service
    // actually passes; a parser that only handled Uint8Array would typecheck
    // and return null for every real upload.
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    expect(readImageDimensions(buffer as ArrayBuffer)).toEqual({ width: 37, height: 19 });
  });

  it("reads a JPEG whose frame header is not the first segment", () => {
    // A JFIF APP0 segment precedes SOF0 in both JPEG fixtures, which is why
    // this walks rather than reading a fixed offset - and a progressive JPEG
    // uses SOF2, a different marker in the same run.
    expect(readImageDimensions(bytesOf("jpeg_progressive"))).toEqual({ width: 37, height: 19 });
  });

  it("covers all three WebP containers, not just the lossy one", () => {
    // A parser that handles only `VP8 ` returns null for most modern WebP
    // files - it "works" on a hand-made fixture and populates nothing in
    // production.
    for (const name of ["webp_lossy", "webp_lossless", "webp_extended"]) {
      expect(readImageDimensions(bytesOf(name)), name).toEqual({ width: 37, height: 19 });
    }
  });
});

describe("what it refuses to guess at", () => {
  it("returns null for a truncated file rather than a number from past the end", () => {
    expect(readImageDimensions(bytesOf("png").slice(0, 18))).toBeNull();
  });

  it("returns null for something that is not an image", () => {
    expect(
      readImageDimensions(new TextEncoder().encode("<!doctype html><html></html>"))
    ).toBeNull();
  });

  it("returns null for a format it does not parse, rather than a wrong answer", () => {
    // SVG has no intrinsic pixel size to read, and a stored guess would be
    // worse than the null the column has always held - `next/image` sizes
    // against these.
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="37"/>');
    expect(readImageDimensions(svg)).toBeNull();
  });

  it("returns null for an empty or tiny buffer", () => {
    expect(readImageDimensions(new Uint8Array(0))).toBeNull();
    expect(readImageDimensions(new Uint8Array(8))).toBeNull();
  });

  it("returns null for a PNG-signed file whose first chunk is not IHDR", () => {
    // A fixed-offset read would happily return whatever sat at bytes 16-23.
    const png = bytesOf("png");
    png.set(new TextEncoder().encode("acTL"), 12);
    expect(readImageDimensions(png)).toBeNull();
  });
});
