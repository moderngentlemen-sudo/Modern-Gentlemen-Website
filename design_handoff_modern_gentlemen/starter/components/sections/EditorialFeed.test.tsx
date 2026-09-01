import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  it("paginates stories with an accessible numbered control", () => {
    render(<EditorialFeed items={stories} pagination="pages" pageSize={1} />);

    expect(screen.getByText("The first story")).toBeInTheDocument();
    expect(screen.queryByText("The second story")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(screen.queryByText("The first story")).toBeNull();
    expect(screen.getByText("The second story")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2" })).toHaveAttribute("aria-current", "page");
  });

  it("progressively reveals stories with a separately configurable button label", () => {
    render(
      <EditorialFeed
        items={stories}
        pagination="loadMore"
        pageSize={1}
        paginationButtonLabel="Reveal another"
        loadMoreLabel="All stories"
        loadMoreHref="/editorial"
      />
    );

    expect(screen.queryByText("The second story")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reveal another" }));
    expect(screen.getByText("The second story")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All stories" })).toHaveAttribute("href", "/editorial");
  });

  it("keeps a manual fallback available for infinite reveal", () => {
    render(
      <EditorialFeed
        items={stories}
        pagination="infinite"
        pageSize={1}
        infiniteFallbackLabel="Reveal next stories"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Reveal next stories" }));
    expect(screen.getByText("The second story")).toBeInTheDocument();
  });

  it("renders responsive layout variables, read-more text, and an authored empty state", () => {
    const { container, rerender } = render(
      <EditorialFeed
        items={stories}
        columnsMobile="2"
        columnsTablet="3"
        columnsDesktop="4"
        rowGap="16"
        columnGap="48"
        readMoreLabel="Continue"
      />
    );
    const grid = container.querySelector<HTMLElement>("[style]");
    expect(grid?.style.getPropertyValue("--feed-cols-mobile")).toBe("2");
    expect(grid?.style.getPropertyValue("--feed-cols-tablet")).toBe("3");
    expect(grid?.style.getPropertyValue("--feed-cols-desktop")).toBe("4");
    expect(grid?.style.getPropertyValue("--feed-row-gap")).toBe("16px");
    expect(grid?.style.getPropertyValue("--feed-column-gap")).toBe("48px");
    expect(screen.getAllByText(/Continue/)).toHaveLength(2);

    rerender(<EditorialFeed items={[]} emptyMessage="Nothing published here." />);
    expect(screen.getByText("Nothing published here.")).toBeInTheDocument();
  });
});
