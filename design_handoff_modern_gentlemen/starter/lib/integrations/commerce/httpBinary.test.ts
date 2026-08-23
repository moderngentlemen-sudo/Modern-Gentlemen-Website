import { describe, expect, it } from "vitest";

import { fetchBinaryCapped, MAX_IMAGE_BYTES } from "./http";
import { AdapterError } from "./types";

/**
 * The binary half of the capped fetch, which exists because `fetchCapped`
 * decodes as UTF-8 and that destroys an image.
 *
 * `fetch` is injected, exactly as it is for the adapters, so every case here
 * runs with no network and no stubbing of globals.
 */

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

function respond(
  chunks: Uint8Array[],
  headers: Record<string, string> = {},
  init: { status?: number; statusText?: string } = {}
): typeof globalThis.fetch {
  return (async () =>
    new Response(streamOf(chunks), {
      status: init.status ?? 200,
      statusText: init.statusText ?? "OK",
      headers,
    })) as unknown as typeof globalThis.fetch;
}

const request = { subject: "The image", timeoutMs: 5_000 };

describe("fetchBinaryCapped", () => {
  it("returns the bytes intact and the content type without its parameters", async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const result = await fetchBinaryCapped(
      respond([bytes], { "content-type": "image/png; charset=binary" }),
      "https://cdn.example/a.png",
      request
    );

    expect(new Uint8Array(result.bytes)).toEqual(bytes);
    expect(result.contentType).toBe("image/png");
  });

  it("reassembles a multi-chunk body in order", async () => {
    // The merge is hand-rolled, so a chunk boundary is worth one test: an
    // off-by-one here corrupts every image larger than one packet.
    const result = await fetchBinaryCapped(
      respond([new Uint8Array([1, 2]), new Uint8Array([3]), new Uint8Array([4, 5])], {
        "content-type": "image/jpeg",
      }),
      "https://cdn.example/a.jpg",
      request
    );

    expect(new Uint8Array(result.bytes)).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
  });

  it("refuses a body that declares itself over the cap, before reading it", async () => {
    await expect(
      fetchBinaryCapped(
        respond([new Uint8Array([1])], { "content-length": String(MAX_IMAGE_BYTES + 1) }),
        "https://cdn.example/huge.jpg",
        request
      )
    ).rejects.toBeInstanceOf(AdapterError);
  });

  it("refuses a body that exceeds the cap while streaming, whatever it declared", async () => {
    // The check that matters: a lying `content-length` buys nothing, because the
    // running total is what enforces the limit.
    await expect(
      fetchBinaryCapped(
        respond([new Uint8Array(600), new Uint8Array(600)], { "content-length": "10" }),
        "https://cdn.example/liar.jpg",
        { ...request, maxBytes: 1000 }
      )
    ).rejects.toThrow(/exceeded the 1000-byte limit/);
  });

  it("names the subject and the status when the server refuses", async () => {
    await expect(
      fetchBinaryCapped(
        respond([], {}, { status: 404, statusText: "Not Found" }),
        "https://cdn.example/gone.jpg",
        request
      )
    ).rejects.toThrow(/The image answered 404 Not Found/);
  });

  it("reports a missing content-type as null rather than guessing", async () => {
    // The caller refuses anything that is not `image/*`; guessing here would
    // turn "the feed served an HTML error page" into a corrupt asset.
    const result = await fetchBinaryCapped(
      respond([new Uint8Array([1])]),
      "https://cdn.example/a",
      request
    );
    expect(result.contentType).toBeNull();
  });

  it("turns a timeout into a message naming the subject and the budget", async () => {
    const timingOut: typeof globalThis.fetch = async () => {
      const error = new Error("timed out");
      error.name = "TimeoutError";
      throw error;
    };

    await expect(
      fetchBinaryCapped(timingOut, "https://cdn.example/slow.jpg", request)
    ).rejects.toThrow(/The image did not respond within 5000ms/);
  });
});
