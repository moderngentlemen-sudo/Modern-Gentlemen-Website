import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

import {
  LaunchCountdown,
  LaunchKnockout,
  LaunchLogo,
  LaunchShape,
  LaunchSignup,
  LaunchSocial,
} from "./LaunchElements";
import { StageCell, StageLayout } from "../sections/StageLayout";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("LaunchCountdown", () => {
  it("shows dashes with no valid launch date, never an invented one", () => {
    render(<LaunchCountdown target="" />);
    expect(screen.getByRole("timer").textContent).toMatch(/––/);
  });

  it("counts down once mounted, in each style", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-14T18:00:00Z"));
    for (const style of ["numerals", "inline", "grid", "dial", "clock", "single"] as const) {
      const { unmount } = render(
        <LaunchCountdown target="2027-01-16T18:00:00Z" style={style} unit="days" />
      );
      act(() => void vi.advanceTimersByTime(1000));
      expect(screen.getByRole("timer").textContent).toMatch(/01|23/);
      unmount();
    }
  });

  it("hides units that are switched off and shows the launch message at zero", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-15T18:00:00Z"));
    render(<LaunchCountdown target="2027-01-15T18:00:00Z" message="We are open." />);
    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.getByText("We are open.")).toBeTruthy();
    cleanup();
    render(<LaunchCountdown target="" units={{ seconds: false }} />);
    expect(screen.queryByText("Seconds")).toBeNull();
    expect(screen.getByText("Minutes")).toBeTruthy();
  });

  it("ignores colours that are not six-digit hex", () => {
    render(<LaunchCountdown color="red;background:url(x)" />);
    expect(screen.getByRole("timer").getAttribute("style")).not.toMatch(/url/);
  });
});

describe("Launch elements", () => {
  it("signup labels its field and uses the button wording", () => {
    render(<LaunchSignup buttonLabel="Register to bid" accessibleLabel="Your email" />);
    expect(screen.getByLabelText("Your email")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Register to bid/ })).toBeTruthy();
  });

  it("social links drop unsafe destinations and name each link", () => {
    render(
      <LaunchSocial
        links={[
          { network: "instagram", label: "Instagram", href: "https://instagram.com/mg" },
          { network: "x", label: "X", href: "javascript:alert(1)" },
        ]}
      />
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("aria-label")).toBe("Instagram");
  });

  it("logo has an accessible name in every style", () => {
    for (const variant of ["wordmark", "monogram", "seal"] as const) {
      const { unmount } = render(<LaunchLogo variant={variant} label="Modern Gentlemen" />);
      expect(screen.getByRole("img", { name: "Modern Gentlemen" })).toBeTruthy();
      unmount();
    }
  });

  it("knockout text marks the blend the stage applies, light or dark", () => {
    const { container, rerender } = render(<LaunchKnockout text="SOON" panel="light" />);
    expect(container.querySelector('[data-knockout="screen"]')?.textContent).toBe("SOON");
    rerender(<LaunchKnockout text="MG" panel="dark" />);
    expect(container.querySelector('[data-knockout="multiply"]')).toBeTruthy();
  });

  it("every text-bearing element takes an installed font through the theme variable", () => {
    const font = "webfont:brand-serif";
    const stack = "var(--mg-webfont-brand-serif,var(--font-body))";
    const target = "2027-01-15T18:00:00Z";
    const roots = [
      render(<LaunchSignup font={font} />).container,
      render(
        <LaunchSocial
          font={font}
          links={[{ network: "x", label: "X", href: "https://x.com/mg" }]}
        />
      ).container,
      render(<LaunchLogo variant="seal" font={font} />).container,
    ];
    for (const root of roots)
      expect((root.firstElementChild as HTMLElement).style.getPropertyValue("--el-font")).toBe(
        stack
      );
    const cd = render(<LaunchCountdown target={target} font={font} labelFont={font} />).container;
    expect((cd.firstElementChild as HTMLElement).style.getPropertyValue("--cd-font")).toBe(stack);
    const ko = render(<LaunchKnockout font={font} />).container;
    expect(ko.innerHTML).toContain("--mg-webfont-brand-serif");
  });

  it("panels take colour, gradient, outline, shadow, blend and frosted settings", () => {
    const el = (node: React.ReactElement) =>
      render(node).container.firstElementChild as HTMLElement;
    const plain = el(<LaunchShape />);
    expect(plain.style.getPropertyValue("--sh-bg")).toBe("#c8102e");
    for (const attr of ["data-blur", "data-blend", "data-sheen"])
      expect(plain.hasAttribute(attr)).toBe(false);
    expect(plain.style.getPropertyValue("--sh-border")).toBe("");

    const panel = el(
      <LaunchShape
        fill="#0d0d0d"
        fillOpacity={55}
        fill2="#c8102e"
        fill2Opacity={0}
        gradientAngle={90}
        borderColor="#ffffff"
        stroke={1}
        shadow="soft"
        blend="multiply"
        saturation={160}
        sheen
      />
    );
    expect(panel.style.getPropertyValue("--sh-bg")).toBe(
      "linear-gradient(90deg, rgba(13, 13, 13, 0.55), rgba(200, 16, 46, 0))"
    );
    expect(panel.style.getPropertyValue("--sh-border")).toBe("1px solid #ffffff");
    expect(panel.style.getPropertyValue("--sh-shadow")).toContain("rgba(0, 0, 0");
    expect(panel.style.getPropertyValue("--sh-saturate")).toBe("160%");
    expect(panel.dataset).toMatchObject({ blur: "true", blend: "multiply", sheen: "true" });

    // Unsafe values never reach the style.
    const bad = el(
      <LaunchShape fill2="red;x" borderColor="url(x)" blend={"luminosity" as "normal"} />
    );
    expect(bad.getAttribute("style")).not.toMatch(/url|red;/);
    expect(bad.hasAttribute("data-blend")).toBe(false);
  });

  it("knockout panels take any colour and opacity, and pick the blend that keeps the letters cut out", () => {
    const panel = (props: Parameters<typeof LaunchKnockout>[0]) =>
      render(<LaunchKnockout {...props} />).container.querySelector<HTMLElement>(
        "[data-knockout]"
      )!;
    expect(panel({ panel: "dark" }).dataset.knockout).toBe("multiply");
    const pale = panel({ panelColor: "#f2e6d0", panelOpacity: 80 });
    expect(pale.dataset.knockout).toBe("screen");
    expect(pale.style.getPropertyValue("--ko-panel")).toBe("#f2e6d0");
    expect(pale.style.opacity).toBe("0.8");
    const deep = panel({ panel: "light", panelColor: "#3a0710" });
    expect(deep.dataset.knockout).toBe("multiply");
    expect(deep.style.opacity).toBe("");
  });

  it("countdown numbers animate on change only when asked", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-14T18:00:00Z"));
    const { container, rerender } = render(<LaunchCountdown target="2027-01-16T18:00:00Z" />);
    expect(container.querySelector("[data-tick]")).toBeNull();
    rerender(<LaunchCountdown target="2027-01-16T18:00:00Z" tick="flip" />);
    act(() => void vi.advanceTimersByTime(1000));
    const seconds = () => container.querySelectorAll("[role=timer] [class*=num]")[3];
    const before = seconds();
    expect(container.querySelector('[data-tick="flip"]')).toBeTruthy();
    act(() => void vi.advanceTimersByTime(1000));
    // Keyed on its value: a new second is a new node, which replays the animation.
    expect(seconds()).not.toBe(before);
  });

  it("shapes are decorative", () => {
    const { container } = render(<LaunchShape shape="ring" />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("StageLayout", () => {
  it("places each element from its stored percentages", () => {
    const { container } = render(
      <StageLayout video="" image="" standalone>
        <StageCell index={0} stage={{ desktop: { x: 10, y: 20, w: 30, scale: 2, z: 4 } }}>
          <p>Hello</p>
        </StageCell>
      </StageLayout>
    );
    const cell = container.querySelector<HTMLElement>("[data-stage-cell]")!;
    expect(cell.style.getPropertyValue("--sd-x")).toBe("10%");
    expect(cell.style.getPropertyValue("--sd-w")).toBe("60%");
    expect(container.querySelector('[data-coming-soon-standalone="true"]')).toBeTruthy();
  });

  it("adds no effect markup until an effect is chosen", () => {
    const { container } = render(<StageLayout image="/x.jpg" />);
    const stage = container.querySelector<HTMLElement>("[data-stage-layout]")!;
    expect(stage.hasAttribute("data-zoom")).toBe(false);
    expect(stage.hasAttribute("data-bars")).toBe(false);
    expect(stage.querySelector("[data-grain]")).toBeNull();
    expect(stage.querySelector("[data-intro]")).toBeNull();
    expect(stage.style.getPropertyValue("--stage-glow")).toBe("");
    expect(stage.style.getPropertyValue("--stage-scrim-rgb")).toBe("");
  });

  it("applies the overlay colour and every premium effect", () => {
    const { container } = render(
      <StageLayout
        image="/x.jpg"
        scrimColor="#1a0a2e"
        grain="subtle"
        zoom="in"
        glowStrength={40}
        glowColor="#d4af37"
        glowPosition="top"
        bars={8}
        intro="blur"
        introPace="slow"
      >
        <StageCell index={2}>
          <p>Hi</p>
        </StageCell>
      </StageLayout>
    );
    const stage = container.querySelector<HTMLElement>("[data-stage-layout]")!;
    expect(stage.style.getPropertyValue("--stage-scrim-rgb")).toBe("26 10 46");
    expect(stage.style.getPropertyValue("--stage-glow-rgb")).toBe("212 175 55");
    expect(stage.style.getPropertyValue("--stage-glow")).toBe("0.4");
    expect(stage.style.getPropertyValue("--stage-bars")).toBe("8%");
    expect(stage.style.getPropertyValue("--stage-intro-step")).toBe("280ms");
    expect(stage.dataset).toMatchObject({ zoom: "in", bars: "" });
    expect(stage.querySelector('[data-grain="subtle"]')?.getAttribute("aria-hidden")).toBe("true");
    expect(stage.querySelector('[data-intro="blur"]')).toBeTruthy();
    expect(
      container.querySelector<HTMLElement>("[data-stage-cell]")!.style.getPropertyValue("--cell-i")
    ).toBe("2");
  });
});
