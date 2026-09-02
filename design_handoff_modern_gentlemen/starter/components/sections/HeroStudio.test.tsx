import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HERO_STUDIO_VARIANTS, HeroStudio, type HeroStudioVariant } from "./HeroStudio";

const moduleNumber: Record<HeroStudioVariant, string> = {
  editorialSplit: "01",
  fullBleedCover: "69",
  typeMasthead: "70",
  triptych: "71",
};

afterEach(cleanup);

describe("HeroStudio", () => {
  it.each(HERO_STUDIO_VARIANTS)("renders the %s library preset", (variant) => {
    const { container } = render(
      <HeroStudio
        variant={variant}
        eyebrow="The cover story"
        headline="Speed, Considered"
        accent="Again"
        body="A measured approach."
        image="/images/hero-cover.jpg"
        imageAlt="A vintage car"
        images={[
          { image: "/images/hero-cover.jpg", alt: "A vintage car" },
          { image: "/images/style-mono.jpg", alt: "Tailoring" },
          { image: "/images/watch-gear.jpg", alt: "A watch" },
        ]}
        primaryCta={{ label: "Read the story", href: "/story" }}
        secondaryCta={{ label: "Explore the issue", href: "/issue" }}
      />
    );

    const section = container.querySelector("[data-hero-studio]");
    expect(section).toHaveAttribute("data-hero-studio", variant);
    expect(section).toHaveAttribute("data-library-module", moduleNumber[variant]);
    expect(screen.getByRole("heading", { name: "Speed, Considered Again" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Read the story" })).toHaveAttribute("href", "/story");
    expect(screen.getByRole("link", { name: "Explore the issue" })).toHaveAttribute(
      "href",
      "/issue"
    );
  });

  it("keeps the split composition and its media position independently configurable", () => {
    const { container } = render(
      <HeroStudio
        headline="The split"
        image="/images/hero-cover.jpg"
        imageAlt="Hero image"
        imagePosition="left"
        tone="light"
      />
    );

    expect(container.querySelector("section")).not.toHaveAttribute("data-darkband");
    expect(container.querySelector("img")).toHaveAttribute("alt", "Hero image");
    expect(container.querySelector("img")?.parentElement).toHaveClass("min-[821px]:order-1");
  });

  it("limits a triptych to three independently described images", () => {
    render(
      <HeroStudio
        variant="triptych"
        headline="Three perspectives"
        images={[
          { image: "/images/hero-cover.jpg", alt: "First" },
          { image: "/images/style-mono.jpg", alt: "Second" },
          { image: "/images/watch-gear.jpg", alt: "Third" },
          { image: "/images/interiors.jpg", alt: "Fourth" },
        ]}
      />
    );

    expect(screen.getAllByRole("img")).toHaveLength(3);
    expect(screen.getByAltText("First")).toBeInTheDocument();
    expect(screen.getByAltText("Third")).toBeInTheDocument();
    expect(screen.queryByAltText("Fourth")).toBeNull();
  });
});
