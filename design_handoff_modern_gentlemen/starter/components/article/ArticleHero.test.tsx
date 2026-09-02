import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ArticleHero } from "./ArticleHero";

const base = {
  variant: "cover" as const,
  kicker: "STYLE · NO. 040",
  title: "A permanent title",
  dek: "A useful subtitle",
  byline: "WORDS · MODERN GENTLEMEN",
  image: "/images/hero-cover.jpg",
};

afterEach(cleanup);

describe("ArticleHero presentation overrides", () => {
  it("preserves the template's original hero by default", () => {
    const { container } = render(<ArticleHero {...base} />);
    expect(container.querySelector("[data-darkband]")).toBeInTheDocument();
    expect(container.querySelector("[data-hero-media]")).toBeInTheDocument();
  });

  it.each([
    ["standard", true],
    ["large", false],
    ["largeMedia", true],
    ["full", true],
  ] as const)(
    "renders the %s header independently from the body template",
    (headerMode, hasMedia) => {
      const { container } = render(
        <ArticleHero {...base} presentation={{ headerMode, appearance: "template" }} />
      );
      expect(screen.getByRole("heading", { level: 1, name: base.title })).toBeInTheDocument();
      expect(Boolean(container.querySelector("[data-hero-media]"))).toBe(hasMedia);
    }
  );

  it("supports title-only and fully hidden headers", () => {
    const { container, rerender } = render(
      <ArticleHero {...base} presentation={{ headerMode: "titleOnly", appearance: "large" }} />
    );
    expect(screen.getByRole("heading", { name: base.title })).toBeInTheDocument();
    expect(screen.queryByText(base.kicker)).toBeNull();
    expect(container.querySelector('[data-article-appearance="large"]')).toBeInTheDocument();

    rerender(
      <ArticleHero {...base} presentation={{ headerMode: "none", appearance: "template" }} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("applies compact or large appearance without changing the chosen composition", () => {
    const { container } = render(
      <ArticleHero {...base} presentation={{ headerMode: "standard", appearance: "compact" }} />
    );
    expect(container.querySelector('[data-article-appearance="compact"]')).toBeInTheDocument();
    expect(container.querySelector("[data-hero-media]")).toBeInTheDocument();
  });
});
