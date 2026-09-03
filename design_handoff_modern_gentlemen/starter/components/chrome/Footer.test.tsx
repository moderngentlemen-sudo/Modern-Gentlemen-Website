import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_THEME_FOOTER } from "@/lib/domain/theme";
import { Footer } from "./Footer";

afterEach(cleanup);

describe("Footer settings", () => {
  it("preserves the original footer content by default", () => {
    render(<Footer />);

    expect(screen.getByText(DEFAULT_THEME_FOOTER.tagline)).toBeInTheDocument();
    expect(screen.getByText(DEFAULT_THEME_FOOTER.followLabel)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Instagram" })).toHaveAttribute(
      "href",
      "https://instagram.com"
    );
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });

  it("supports custom copy, destinations and centered composition", () => {
    const { container } = render(
      <Footer
        settings={{
          ...DEFAULT_THEME_FOOTER,
          layout: "centered",
          tagline: "Made with intention.",
          followLabel: "Find us",
          instagramHref: "https://example.com/instagram",
          xHref: "",
        }}
      />
    );

    expect(screen.getByText("Made with intention.")).toBeInTheDocument();
    expect(screen.getByText("Find us")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Instagram" })).toHaveAttribute(
      "href",
      "https://example.com/instagram"
    );
    expect(screen.queryByRole("link", { name: "X" })).toBeNull();
    expect(container.querySelector("footer .text-center")).toBeInTheDocument();
  });

  it("can hide optional footer content without removing menu or legal regions", () => {
    render(
      <Footer
        nav={[{ id: "style", label: "Style", href: "/style", children: [] }]}
        legal={[{ id: "privacy", label: "Privacy", href: "/privacy", children: [] }]}
        settings={{ ...DEFAULT_THEME_FOOTER, showTagline: false, showSocials: false }}
      />
    );

    expect(screen.queryByText(DEFAULT_THEME_FOOTER.tagline)).toBeNull();
    expect(screen.queryByText(DEFAULT_THEME_FOOTER.followLabel)).toBeNull();
    expect(screen.getByRole("link", { name: "Style" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy" })).toBeInTheDocument();
  });
});
