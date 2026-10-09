import { describe, expect, it } from "vitest";
import { gifStillReason, GIF_MAX_BYTES } from "./gif";
import { gifIssue } from "./checks";
import type { AssetMeta } from "./types";

const gif = (o: Partial<AssetMeta> = {}): AssetMeta => ({
  id: "g",
  name: "b.gif",
  mime: "image/gif",
  width: 600,
  height: 150,
  bytes: 200_000,
  hash: "h",
  ...o,
});
const full = { sx: 0, sy: 0, sw: 600, sh: 150 };

describe("animated GIFs", () => {
  it("keep their animation when nothing is baked in", () => {
    expect(gifStillReason(gif(), { rect: full, shape: "square" })).toBeNull();
    expect(gifIssue(gif())).toBeNull();
  });

  it("become stills when rounded, cropped or too large — and say why", () => {
    expect(gifStillReason(gif(), { rect: full, shape: "rounded" })).toBe("shaped");
    expect(gifStillReason(gif(), { rect: { sx: 50, sy: 0, sw: 500, sh: 150 }, shape: "square" })).toBe("cropped");
    expect(gifStillReason(gif({ bytes: GIF_MAX_BYTES + 1 }), { rect: full, shape: "square" })).toBe("too-big");
    expect(gifIssue(gif(), undefined, { x: 0, y: 0, zoom: 1.5 })).toMatch(/Cropping/);
    expect(gifIssue(gif(), undefined, undefined, "rounded")).toMatch(/Rounded corners/);
  });

  it("ignores other image types", () => {
    expect(gifStillReason(gif({ mime: "image/png" }), { rect: full, shape: "circle" })).toBeNull();
  });
});
