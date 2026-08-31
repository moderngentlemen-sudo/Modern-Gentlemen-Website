import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ArticleFeaturedMedia } from "./ArticleFeaturedMedia";

describe("ArticleFeaturedMedia", () => {
  it("renders an ordered gallery", () => {
    render(
      <ArticleFeaturedMedia
        media={{
          kind: "gallery",
          gallery: [
            { kind: "image", url: "/one.jpg", alt: "One" },
            { kind: "gif", url: "/two.gif", alt: "Two" },
          ],
        }}
      />
    );

    expect(screen.getByRole("region", { name: "Featured gallery" })).toBeInTheDocument();
    expect(screen.getAllByRole("img").map((image) => image.getAttribute("alt"))).toEqual([
      "One",
      "Two",
    ]);
  });

  it("embeds only a supported provider", () => {
    const { rerender } = render(
      <ArticleFeaturedMedia media={{ kind: "embed", embedUrl: "https://youtu.be/abc" }} />
    );
    expect(screen.getByTitle("Featured video")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/abc"
    );

    rerender(
      <ArticleFeaturedMedia media={{ kind: "embed", embedUrl: "https://example.com/abc" }} />
    );
    expect(screen.queryByTitle("Featured video")).toBeNull();
  });

  it("renders library or direct video with the cover as poster", () => {
    render(
      <ArticleFeaturedMedia
        media={{
          kind: "video",
          video: { kind: "video", url: "/film.mp4" },
          cover: { kind: "image", url: "/poster.jpg" },
        }}
      />
    );

    expect(document.querySelector("video")).toHaveAttribute("src", "/film.mp4");
    expect(document.querySelector("video")).toHaveAttribute("poster", "/poster.jpg");
  });
});
