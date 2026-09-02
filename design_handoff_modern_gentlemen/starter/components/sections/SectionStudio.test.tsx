import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SECTION_STUDIO_PRESETS } from "@/lib/blocks/sectionStudioPresets";
import { SectionStudio } from "./SectionStudio";

afterEach(cleanup);

describe("SectionStudio", () => {
  it.each(SECTION_STUDIO_PRESETS)(
    "renders library module %s",
    (variant, module, _label, layout) => {
      const { container } = render(<SectionStudio variant={variant} title="A considered view" />);
      const section = container.querySelector("[data-section-studio]");

      expect(section).toHaveAttribute("data-section-studio", variant);
      expect(section).toHaveAttribute("data-library-module", module);
      expect(section).toHaveAttribute("data-section-layout", layout);
      expect(screen.getByText("A considered view")).toBeInTheDocument();
    }
  );

  it("keeps every non-hero library number unique and selectable", () => {
    expect(SECTION_STUDIO_PRESETS).toHaveLength(87);
    expect(new Set(SECTION_STUDIO_PRESETS.map(([value]) => value))).toHaveProperty("size", 87);
    expect(new Set(SECTION_STUDIO_PRESETS.map(([, module]) => module))).toHaveProperty("size", 87);
    expect(SECTION_STUDIO_PRESETS.map(([, module]) => module)).toEqual([
      ...Array.from({ length: 67 }, (_, index) => String(index + 2).padStart(3, "0")),
      ...Array.from({ length: 20 }, (_, index) => String(index + 126)),
    ]);
  });

  it("renders the interactive presets with native accessible controls", () => {
    const { rerender } = render(<SectionStudio variant="theVote" title="Choose one" />);
    expect(screen.getAllByRole("button", { name: "Vote" })).toHaveLength(4);

    rerender(<SectionStudio variant="searchResults" title="Find a story" />);
    expect(screen.getByRole("searchbox", { name: "Search the archive" })).toBeInTheDocument();

    rerender(<SectionStudio variant="categoryPillBar" title="Browse topics" />);
    expect(screen.getByRole("navigation", { name: "Browse topics" })).toBeInTheDocument();
  });

  it("keeps layout, content and color treatment independently configurable", () => {
    const { container } = render(
      <SectionStudio
        variant="latestNewsThreeUp"
        title="Current stories"
        tone="dark"
        columns="2"
        imageRatio="portrait"
        showNumbers={false}
        items={[{ title: "One authored story", image: "/images/style-mono.jpg", alt: "Suit" }]}
      />
    );

    expect(container.querySelector("section")).toHaveAttribute("data-darkband", "true");
    expect(screen.getByText("One authored story")).toBeInTheDocument();
    expect(screen.getByAltText("Suit").parentElement).toHaveClass("aspect-[3/4]");
  });
});
