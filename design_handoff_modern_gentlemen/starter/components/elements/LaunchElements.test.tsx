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

  it("knockout letters are a mask, not a blend, so Safari cuts them out over video", () => {
    const { container } = render(<LaunchKnockout text="SOON" panel="light" />);
    const box = container.querySelector<HTMLElement>("[data-knockout]")!;
    expect(box.dataset.knockout).toBe("mask");
    // The real text stays for layout and screen readers, drawn transparent.
    expect(box.querySelector("p")?.textContent).toBe("SOON");
    expect(box.style.getPropertyValue("--ko-ink")).toBe("transparent");
    // The panel is a masked rect; the letters are black (cut) in the mask.
    const svg = box.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    const maskId = svg.querySelector("mask")!.id;
    expect(svg.querySelector(`rect[mask="url(#${maskId})"]`)?.getAttribute("fill")).toBe("#f4f4f4");
    expect(svg.querySelector("mask text")?.getAttribute("fill")).toBe("#000");
    expect(svg.querySelector("mask text")?.textContent).toBe("SOON");
    // Nothing on the stage blends any more.
    expect(container.innerHTML).not.toMatch(/screen|multiply/);
  });

  it("knockout headlines keep their explicit line breaks in the mask", () => {
    const { container } = render(<LaunchKnockout text={"COMING\nSOON"} />);
    const lines = [...container.querySelectorAll("mask text")].map((t) => [
      t.textContent,
      t.getAttribute("y"),
    ]);
    expect(lines).toEqual([
      ["COMING", "25%"],
      ["SOON", "75%"],
    ]);
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

  it("knockout panels take any colour exactly, and any opacity", () => {
    const box = (props: Parameters<typeof LaunchKnockout>[0]) =>
      render(<LaunchKnockout {...props} />).container.querySelector<HTMLElement>(
        "[data-knockout]"
      )!;
    const dark = box({ panel: "dark" });
    expect(dark.style.getPropertyValue("--ko-panel")).toBe("#0d0d0d");
    const pale = box({ panelColor: "#f2e6d0", panelOpacity: 80 });
    expect(pale.style.getPropertyValue("--ko-panel")).toBe("#f2e6d0");
    expect(pale.querySelector("rect[mask]")?.getAttribute("fill")).toBe("#f2e6d0");
    expect(pale.style.opacity).toBe("0.8");
    const mid = box({ panelColor: "#7a1020" });
    expect(mid.querySelector("rect[mask]")?.getAttribute("fill")).toBe("#7a1020");
    expect(mid.style.opacity).toBe("");
    expect(box({ panelColor: "red;x" }).style.getPropertyValue("--ko-panel")).toBe("#f4f4f4");
  });

  it("countdown numbers roll the old value out as the new one arrives", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-14T18:00:00Z"));
    const { container, rerender } = render(<LaunchCountdown target="2027-01-16T18:00:00Z" />);
    expect(container.querySelector("[data-tick]")).toBeNull();
    rerender(<LaunchCountdown target="2027-01-16T18:00:00Z" tick="rise" tickSpeed="slow" />);
    act(() => void vi.advanceTimersByTime(1000));
    const timer = container.querySelector<HTMLElement>('[data-tick="rise"]')!;
    expect(timer.style.getPropertyValue("--cd-tick-ms")).toBe("900ms");
    // The clock has gone from 00 to 59 seconds: 00 rolls out as 59 rolls in.
    const outgoing = () =>
      [...timer.querySelectorAll("[class*=tickOut]")].map((n) => n.textContent);
    expect(outgoing()).toContain("00");
    expect([...timer.querySelectorAll("[data-moving]")].map((n) => n.textContent)).toContain("59");
    // Gone once the transition has run, leaving one number per unit.
    act(() => void vi.advanceTimersByTime(950));
    expect(outgoing()).toEqual([]);
  });

  it("scramble shuffles the digits, then settles on the real value", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-14T18:00:00Z"));
    const { container } = render(
      <LaunchCountdown target="2027-01-16T18:00:00Z" tick="scramble" tickSpeed="quick" />
    );
    act(() => void vi.advanceTimersByTime(2000));
    act(() => void vi.advanceTimersByTime(400));
    const nums = container.querySelectorAll("[role=timer] [class*=num]");
    expect(nums[3].textContent).toBe("58");
    expect(container.querySelector("[data-tick]")).toBeNull();
  });

  it("knockout letters can be cut out, tinted, outlined or solid", () => {
    const box = (props: Parameters<typeof LaunchKnockout>[0]) =>
      render(<LaunchKnockout {...props} />).container.querySelector<HTMLElement>(
        "[data-knockout]"
      )!;
    const cutout = box({ panel: "dark" });
    expect(cutout.hasAttribute("data-letters")).toBe(false);
    // Tinted: the cut-out plus the letters again, in the colour, at the strength.
    const tinted = box({ letters: "tinted", letterColor: "#c8102e", letterStrength: 50 });
    const wash = tinted.querySelector("svg > text")!;
    expect(wash.getAttribute("fill")).toBe("#c8102e");
    expect(wash.getAttribute("opacity")).toBe("0.5");
    // Outline: the letters stay in the mask (white) and only their stroke is cut.
    const outline = box({ letters: "outline", outlineWidth: 5 });
    const edge = outline.querySelector("mask text")!;
    expect(edge.getAttribute("fill")).toBe("#fff");
    expect(edge.getAttribute("stroke")).toBe("#000");
    expect(edge.getAttribute("stroke-width")).toBe("5");
    // Solid: ordinary text on the panel, no mask at all.
    const solid = box({ panelColor: "#1b2a4a", letters: "solid", letterColor: "#d4af37" });
    expect(solid.dataset.knockout).toBe("none");
    expect(solid.querySelector("svg")).toBeNull();
    expect(solid.style.getPropertyValue("--ko-ink")).toBe("#d4af37");
    expect(solid.style.getPropertyValue("--ko-panel")).toBe("#1b2a4a");
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
