import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BlockDesignFrame } from "../BlockDesignFrame";
import { MediaImage } from "./MediaImage";
import { MediaVideo } from "./MediaVideo";
import { DEFAULT_MEDIA_OVERLAY } from "@/lib/domain/mediaOverlay";
import { validateBlock } from "@/lib/blocks/validate";
/* The image stub exposes DOM order; next/image optimization is covered separately. */
/* eslint-disable @next/next/no-img-element */
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
afterEach(cleanup);
it("adds overlays to section photos and videos without wrapping media or tinting editorial text", () => {
  const overlay = { ...DEFAULT_MEDIA_OVERLAY, mode: "linear" as const };
  const body = (
    <>
      <div>
        <MediaImage src="/image.jpg" alt="Story" slot="half" />
      </div>
      <div>
        <MediaVideo src="/video.mp4" controls />
      </div>
      <h2>Editorial title</h2>
    </>
  );
  const { container, rerender } = render(<BlockDesignFrame>{body}</BlockDesignFrame>);
  expect(container.querySelector("[data-media-overlay]")).toBeNull();
  rerender(<BlockDesignFrame design={{ mediaOverlay: overlay }}>{body}</BlockDesignFrame>);
  expect(container.querySelectorAll("[data-media-overlay]")).toHaveLength(2);
  expect(container.querySelector("img")?.parentElement?.tagName).toBe("DIV");
  expect(container.querySelector("h2")?.parentElement).toBe(container);
  expect(container.querySelector("video")).toHaveAttribute("controls");
  expect(
    validateBlock({
      _key: "media",
      _type: "nativeImage",
      design: { mediaOverlay: { ...overlay, opacity: 200 } },
    }).issues.some((i) => i.path === "design.mediaOverlay")
  ).toBe(true);
});
