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
});
