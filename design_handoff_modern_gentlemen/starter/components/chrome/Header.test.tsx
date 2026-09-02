import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_THEME_HEADER, type HeaderComposition } from "@/lib/domain/theme";
import { Header } from "./Header";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/lib/theme", () => ({ useTheme: () => ({ theme: "light", toggle: vi.fn() }) }));
vi.mock("@/lib/cart/CartProvider", () => ({ useCart: () => ({ count: 0 }) }));
vi.mock("./Drawer", () => ({ Drawer: () => null }));
vi.mock("./SearchOverlay", () => ({ SearchOverlay: () => null }));
vi.mock("./BagDrawer", () => ({ BagDrawer: () => null }));
vi.mock("./MegaMenu", () => ({ MegaMenu: () => null }));

const nav = [
  { id: "style", label: "Style", href: "/style", children: [] },
  { id: "culture", label: "Culture", href: "/culture", children: [] },
  { id: "watches", label: "Watches", href: "/watches", children: [] },
  { id: "film", label: "Film", href: "/film", children: [] },
];

afterEach(cleanup);

describe("Header compositions", () => {
  it.each(["balanced", "navigation-left"] as const)(
    "renders the complete primary menu in the %s composition",
    (composition) => {
      const { container } = renderHeader(composition);
      expect(container.querySelector("header")).toHaveAttribute(
        "data-header-composition",
        composition
      );
      expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
      expect(screen.getAllByRole("link", { name: "Style" })).toHaveLength(1);
      expect(screen.getByRole("link", { name: /Modern Gentlemen/ })).toBeInTheDocument();
    }
  );

  it("splits navigation around the logo in the centered composition", () => {
    const { container } = renderHeader("centered-logo");
    expect(container.querySelector("header")).toHaveAttribute(
      "data-header-composition",
      "centered-logo"
    );
    expect(
      screen.getByRole("navigation", { name: "Primary navigation, first group" })
    ).toHaveTextContent("StyleCulture");
    expect(
      screen.getByRole("navigation", { name: "Primary navigation, second group" })
    ).toHaveTextContent("WatchesFilm");
    expect(screen.getAllByRole("link", { name: /Modern Gentlemen/ })).toHaveLength(1);
  });

  it("renders the optional CTA only when its label and destination are complete", () => {
    const { rerender } = render(
      <Header
        nav={nav}
        settings={{ ...DEFAULT_THEME_HEADER, ctaLabel: "Subscribe", ctaHref: "" }}
      />
    );
    expect(screen.queryByRole("link", { name: "Subscribe" })).toBeNull();

    rerender(
      <Header
        nav={nav}
        settings={{ ...DEFAULT_THEME_HEADER, ctaLabel: "Subscribe", ctaHref: "/newsletter" }}
      />
    );
    expect(screen.getByRole("link", { name: "Subscribe" })).toHaveAttribute("href", "/newsletter");
  });
});

function renderHeader(composition: HeaderComposition) {
  return render(
    <Header nav={nav} settings={{ ...DEFAULT_THEME_HEADER, composition, showThemeToggle: false }} />
  );
}
