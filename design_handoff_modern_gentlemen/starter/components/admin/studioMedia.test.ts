import { describe, expect, it, vi } from "vitest";
import { studioSourceSchema, type StudioSource } from "@/lib/blocks/studioPublishing";
import { MAX_MEDIA_UPLOAD_BYTES } from "@/lib/domain/media";
import { hostStudioMedia } from "./studioMedia";

const hosted = "https://example.test/storage/v1/object/public/media/studio.png";

describe("Studio media hosting before save", () => {
  it("reduces a rejected document below 8 MB by uploading a shared original only once", async () => {
    const src = `data:image/png;base64,${btoa("x".repeat(1_600_000))}`;
    const page = {
      page: "#ffffff",
      layoutDevice: "desktop" as const,
      sections: [{ uid: "one", height: 600 }],
      nodes: [
        { id: 1, kind: "media", x: 0, y: 0, w: 300, h: 200, src, alt: "Keep this description" },
      ],
    };
    const document: StudioSource = {
      version: 1,
      source: page,
      views: { desktop: page, tablet: page, mobile: page },
    };
    expect(studioSourceSchema.safeParse(document).success).toBe(false);
    const upload = vi.fn().mockResolvedValue({ ok: true, data: { url: hosted } });
    const progress = vi.fn();
    const result = await hostStudioMedia(document, upload, new Map(), progress);
    expect(upload).toHaveBeenCalledTimes(1);
    const file = upload.mock.calls[0][0].get("file") as File;
    expect(file.size).toBe(1_600_000);
    expect(file.type).toBe("image/png");
    expect(progress).toHaveBeenCalledWith(1, 1);
    expect(studioSourceSchema.safeParse(result).success).toBe(true);
    expect(JSON.stringify(result).length).toBeLessThan(3000);
    for (const view of [result.source, ...Object.values(result.views)]) {
      expect(view.nodes[0]).toMatchObject({
        src: hosted,
        alt: "Keep this description",
        w: 300,
        h: 200,
      });
    }
    expect(document.source.nodes[0].src).toBe(src);
  });

  it("handles nested section and legacy media while leaving hosted URLs and authored text alone", async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><text>É</text></svg>`;
    const image = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    const document = {
      sections: [{ backgroundMedia: { src: image } }],
      nodes: [{ legacyProps: { image } }],
      src: hosted,
      text: "An example data:image/png URL",
    };
    const upload = vi.fn().mockResolvedValue({ ok: true, data: { url: hosted } });
    const result = await hostStudioMedia(document, upload, new Map(), vi.fn());
    expect(upload).toHaveBeenCalledTimes(1);
    const file = upload.mock.calls[0][0].get("file") as File;
    expect(file.type).toBe("image/svg+xml");
    expect(file.name).toBe("studio-media-1.svg");
    expect(file.size).toBe(new TextEncoder().encode(svg).length);
    expect(result).toEqual({
      sections: [{ backgroundMedia: { src: hosted } }],
      nodes: [{ legacyProps: { image: hosted } }],
      src: hosted,
      text: document.text,
    });
    upload.mockClear();
    await hostStudioMedia(result, upload, new Map(), vi.fn());
    expect(upload).not.toHaveBeenCalled();
  });

  it("retains the draft on upload failure and reuses successful uploads when retrying", async () => {
    const document = { image: "data:image/png;base64,YQ==", video: "data:video/mp4;base64,Yg==" };
    const original = structuredClone(document);
    const cache = new Map<string, string>();
    const upload = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, data: { url: hosted } })
      .mockResolvedValueOnce({ ok: false, error: "Storage is unavailable." })
      .mockResolvedValueOnce({ ok: true, data: { url: `${hosted}.mp4` } });
    await expect(hostStudioMedia(document, upload, cache, vi.fn())).rejects.toThrow(
      "Media 2 of 2: Storage is unavailable. Your browser draft is still available."
    );
    expect(document).toEqual(original);
    expect(await hostStudioMedia(document, upload, cache, vi.fn())).toEqual({
      image: hosted,
      video: `${hosted}.mp4`,
    });
    expect(upload).toHaveBeenCalledTimes(3);
    expect((upload.mock.calls[2][0].get("file") as File).type).toBe("video/mp4");
  });

  it.each([
    ["data:image/png;base64,???", "could not be read"],
    ["data:image/png;base64,", "file is empty"],
    [
      `data:image/png;base64,${"A".repeat(4 * Math.ceil((MAX_MEDIA_UPLOAD_BYTES + 1) / 3))}`,
      "no larger than 20 MiB",
    ],
  ])("rejects unreadable or oversized media before uploading (case %#)", async (src, message) => {
    const upload = vi.fn();
    await expect(hostStudioMedia({ src }, upload, new Map(), vi.fn())).rejects.toThrow(message);
    expect(upload).not.toHaveBeenCalled();
  });
});
