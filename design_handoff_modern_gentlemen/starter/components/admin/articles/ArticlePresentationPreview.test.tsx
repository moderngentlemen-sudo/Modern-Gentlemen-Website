import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ArticlePresentationPreview } from "./ArticlePresentationPreview";

const copy = {
  title: "The Slow Car, Fast Philosophy",
  dek: "Why involvement matters.",
  category: "Motoring",
  issue: "041",
  author: "C. Vance",
  readingMinutes: 12,
};

describe("ArticlePresentationPreview", () => {
  it("uses the public template mapping for both hero and body", () => {
    const { container } = render(
      <ArticlePresentationPreview
        {...copy}
        template="The Big Read"
        presentation={{ headerMode: "template", appearance: "template" }}
      />
    );

    const preview = container.querySelector("[data-article-presentation-preview]");
    expect(preview).toHaveAttribute("data-preview-template", "The Big Read");
    expect(preview).toHaveAttribute("data-preview-hero", "wide");
    expect(preview).toHaveAttribute("data-preview-body", "essay");
    expect(container.querySelector("h1")).toHaveTextContent(copy.title);
  });

  it("renders header and appearance overrides through the real hero", () => {
    const { container } = render(
      <ArticlePresentationPreview
        {...copy}
        template="The Big Read"
        presentation={{ headerMode: "standard", appearance: "compact" }}
      />
    );

    const preview = container.querySelector("[data-article-presentation-preview]");
    expect(preview).toHaveAttribute("data-preview-header", "standard");
    expect(preview).toHaveAttribute("data-preview-appearance", "compact");
    expect(container.querySelector('[data-article-appearance="compact"]')).toBeInTheDocument();
    expect(container.querySelector("[data-title-lg]")).toBeInTheDocument();
  });

  it("shows the body without inventing a header when none is selected", () => {
    const { container } = render(
      <ArticlePresentationPreview
        {...copy}
        template="The Big Read"
        presentation={{ headerMode: "none", appearance: "large" }}
      />
    );

    expect(container.querySelector("h1")).toBeNull();
    expect(container.querySelector("article")).toBeInTheDocument();
  });
});
