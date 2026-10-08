import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { SharePreviews, lengthVerdict, truncateForDisplay } from "./SharePreviews";

afterEach(cleanup);

describe("length guides", () => {
  it("grades a length against its range", () => {
    expect(lengthVerdict(0, 30, 60)).toBe("empty");
    expect(lengthVerdict(12, 30, 60)).toBe("short");
    expect(lengthVerdict(45, 30, 60)).toBe("good");
    expect(lengthVerdict(75, 30, 60)).toBe("long");
  });

  it("truncates at a word boundary with an ellipsis", () => {
    expect(truncateForDisplay("Short title", 60)).toBe("Short title");
    const cut = truncateForDisplay(
      "The considered wardrobe for an autumn of long weekends away",
      30
    );
    expect(cut).toBe("The considered wardrobe for…");
  });
});

describe("SharePreviews", () => {
  const base = {
    title: "Autumn Edit — Modern Gentlemen",
    description: "",
    socialTitle: "Autumn Edit",
    socialDescription: "",
    socialImage: "",
    path: "/autumn-edit",
    noIndex: false,
  };

  it("shows a result with the path as breadcrumbs and flags a missing description", () => {
    render(<SharePreviews {...base} />);
    const search = screen.getByRole("region", { name: "Search preview" });
    expect(search.textContent).toMatch(/› autumn-edit/);
    expect(search.textContent).toMatch(/No meta description/);
    expect(search.querySelector('[data-length-meter="Description"]')?.textContent).toMatch(
      /Missing/
    );
  });

  it("warns when the page is not indexed", () => {
    render(<SharePreviews {...base} noIndex />);
    expect(screen.getByText(/not to index/)).toBeTruthy();
  });

  it("switches the social card between large and compact", () => {
    const { container } = render(<SharePreviews {...base} socialImage="/media/a.jpg" />);
    const social = screen.getByRole("region", { name: "Social preview" });
    expect(container.querySelector('[data-social-card="large"] img')).toBeTruthy();
    fireEvent.click(within(social).getByRole("button", { name: "Compact" }));
    expect(container.querySelector('[data-social-card="compact"]')).toBeTruthy();
  });
});
