import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ArticleGrid } from "./ArticleGrid";

const item = {
  tag: "Culture · No. 1",
  title: "A story",
  read: "5 MIN",
  image: "/images/hero-cover.jpg",
  href: "/article/a-story",
};

describe("ArticleGrid", () => {
  it("makes the existing load-more treatment a discoverability link", () => {
    render(<ArticleGrid label="More stories" items={[item]} />);
    expect(screen.getByRole("link", { name: "LOAD MORE STORIES" })).toHaveAttribute(
      "href",
      "/articles"
    );
  });

  it("can omit the archive link when it is already rendering the archive", () => {
    render(<ArticleGrid label="All stories" items={[item]} loadMoreHref={null} />);
    expect(screen.queryByRole("link", { name: "LOAD MORE STORIES" })).toBeNull();
  });
});
