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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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

  it("renders opt-in announcement, account and social controls", () => {
    render(
      <Header
        nav={nav}
        settings={{
          ...DEFAULT_THEME_HEADER,
          announcementText: "New issue available",
          announcementHref: "/latest",
          showAccount: true,
          showSocials: true,
          instagramHref: "https://instagram.com/modern.gentlemen",
          xHref: "https://x.com/moderngents",
        }}
      />
    );

    expect(screen.getByTestId("header-announcement")).toHaveTextContent("New issue available");
    expect(screen.getByRole("link", { name: "New issue available" })).toHaveAttribute(
      "href",
      "/latest"
    );
    expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("link", { name: "Instagram" })).toHaveAttribute(
      "href",
      "https://instagram.com/modern.gentlemen"
    );
    expect(screen.getByRole("link", { name: "X" })).toHaveAttribute(
      "href",
      "https://x.com/moderngents"
    );
  });

  it("applies independent mobile composition, announcement and action limits", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(max-width: 820px)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { container } = render(
      <Header
        nav={nav}
        settings={{
          ...DEFAULT_THEME_HEADER,
          composition: "navigation-left",
          announcementText: "Desktop only",
          showAccount: false,
          mobile: {
            ...DEFAULT_THEME_HEADER.mobile,
            enabled: true,
            composition: "brand-centered",
            showAnnouncement: false,
            showAccount: true,
            cartVisibility: "always",
            actionOrder: ["theme", "search", "bag", "account"],
            maxActions: 2,
          },
        }}
      />
    );

    expect(container.querySelector("header")).toHaveAttribute(
      "data-header-composition",
      "centered-logo"
    );
    expect(container.querySelector("header")).toHaveAttribute("data-mobile-customized", "true");
    expect(screen.queryByTestId("header-announcement")).toBeNull();
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bag" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Account" })).toBeNull();
  });
});

function renderHeader(composition: HeaderComposition) {
  return render(
    <Header nav={nav} settings={{ ...DEFAULT_THEME_HEADER, composition, showThemeToggle: false }} />
  );
}
