import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EDITORIAL_FEED_VARIANTS, EditorialFeed, type EditorialFeedVariant } from "./EditorialFeed";

const stories = [
  {
    tag: "STYLE · 040",
    title: "The first story",
    dek: "First excerpt",
    author: "Ada Editor",
    read: "6 MIN",
    image: "/images/style-mono.jpg",
    href: "/article/first",
  },
  {
    tag: "WATCHES · 039",
    title: "The second story",
    dek: "Second excerpt",
    author: "Max Writer",
    read: "5 MIN",
    image: "/images/watch-gear.jpg",
    href: "/article/second",
  },
];

afterEach(cleanup);

describe("EditorialFeed", () => {
  it.each(EDITORIAL_FEED_VARIANTS)(
    "renders the %s preset without changing its content",
    (variant) => {
      const { container } = render(
        <EditorialFeed variant={variant as EditorialFeedVariant} items={stories} />
      );

      expect(
        container.querySelector("[data-editorial-feed]")?.getAttribute("data-editorial-feed")
      ).toBe(variant);
      expect(screen.getByRole("link", { name: /The first story/i })).toHaveAttribute(
        "href",
        "/article/first"
      );
      expect(screen.getByRole("link", { name: /The second story/i })).toHaveAttribute(
        "href",
        "/article/second"
      );
    }
  );

  it("honours the independent metadata and image toggles", () => {
    const { container } = render(
      <EditorialFeed
        items={stories}
        showImages={false}
        showTags={false}
        showExcerpts={false}
        showAuthors={false}
        showReadingTime={false}
      />
    );

    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByText("STYLE · 040")).toBeNull();
    expect(screen.queryByText("First excerpt")).toBeNull();
    expect(screen.queryByText("Ada Editor")).toBeNull();
    expect(screen.queryByText("6 MIN")).toBeNull();
    expect(screen.getByText("The first story")).toBeInTheDocument();
  });

  it("shows the more-stories action only when its label and destination are complete", () => {
    const { rerender } = render(<EditorialFeed items={stories} loadMoreLabel="More stories" />);
    expect(screen.queryByRole("link", { name: "More stories" })).toBeNull();

    rerender(
      <EditorialFeed items={stories} loadMoreLabel="More stories" loadMoreHref="/editorial" />
    );
    expect(screen.getByRole("link", { name: "More stories" })).toHaveAttribute(
      "href",
      "/editorial"
    );
  });
});
