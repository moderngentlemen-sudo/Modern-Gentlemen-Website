import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AFTER_HOURS_DEFAULTS, countdownParts } from "@/lib/blocks/afterHours";
import { comingSoonSections } from "@/lib/blocks/comingSoon";
import { comingSoonStudio } from "@/lib/blocks/manifests/comingSoonStudio";
import { ComingSoonStudio } from "./ComingSoonStudio";
import { AfterHoursLanding } from "./AfterHoursLanding";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});
describe("After Hours countdown", () => {
  it("uses explicit timezones and rejects invalid or timezone-free dates", () => {
    const now = Date.parse("2027-01-01T00:00:00Z");
    expect(countdownParts("2027-01-02T02:03:04Z", now)).toEqual([1, 2, 3, 4]);
    expect(countdownParts("2027-01-01T19:00:00-05:00", now)).toEqual([1, 0, 0, 0]);
    for (const target of ["", "tomorrow", "2027-01-02T00:00:00", "2027-02-30T00:00:00Z"])
      expect(countdownParts(target, now)).toBeNull();
    expect(countdownParts("2026-01-01T00:00:00Z", now)).toEqual([0, 0, 0, 0]);
  });
  it("hydrates without a fake date, ticks and shows configured expiry copy", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-01T00:00:00Z"));
    const config = {
      countdown: {
        target: "2027-01-01T00:00:02Z",
        expired: "message",
        message: "The next chapter is here.",
      },
    };
    expect(renderToStaticMarkup(<AfterHoursLanding config={config} />)).not.toContain(
      'role="timer"'
    );
    render(<AfterHoursLanding config={config} />);
    expect(screen.getByRole("timer").textContent).toContain("02Seconds");
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("timer").textContent).toContain("01Seconds");
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("The next chapter is here.");
  });
  it("hides unconfigured timers and obeys visibility and seconds controls", () => {
    const { rerender } = render(<AfterHoursLanding />);
    expect(screen.queryByRole("timer")).toBeNull();
    rerender(
      <AfterHoursLanding
        config={{ countdown: { target: "2099-01-01T00:00:00Z", seconds: false } }}
      />
    );
    expect(screen.getByRole("timer")).toBeTruthy();
    expect(screen.queryByText("Seconds")).toBeNull();
    rerender(
      <AfterHoursLanding config={{ countdown: { show: false, target: "2099-01-01T00:00:00Z" } }} />
    );
    expect(screen.queryByRole("timer")).toBeNull();
  });
});
it("persists a valid selectable starter with no invented launch date or social destination", () => {
  const starter = comingSoonSections("21")[0];
  expect(comingSoonStudio.strictSchema.safeParse(starter.settings).success).toBe(true);
  expect(
    comingSoonStudio.strictSchema.safeParse({
      ...starter.settings,
      afterHours: { signup: { opacity: 150 } },
    }).success
  ).toBe(false);
  expect(AFTER_HOURS_DEFAULTS.countdown.target).toBe("");
  expect(starter.settings?.socialLinks).toBeUndefined();
  render(<ComingSoonStudio {...starter.settings} />);
  expect(screen.getByRole("heading", { level: 1, name: "Coming soon" })).toBeTruthy();
  expect(screen.getByAltText("A man walking along a wet city street at night")).toBeTruthy();
});
it("keeps all legacy studio markup identical when new controls are present", () => {
  for (let n = 1; n <= 20; n++) {
    const props = {
      variant: String(n).padStart(2, "0"),
      title: "Preserve me",
      image: "/images/style-mono.jpg",
    };
    expect(renderToStaticMarkup(<ComingSoonStudio {...props} />)).toBe(
      renderToStaticMarkup(
        <ComingSoonStudio
          {...props}
          afterHours={{ layout: { standalone: true }, type: { headingSize: 120 } }}
          socialLinks={[{ network: "instagram", label: "Profile", href: "https://example.com" }]}
        />
      )
    );
  }
});
it("rejects unsafe social and logo destinations and applies scoped design settings", () => {
  const { container } = render(
    <AfterHoursLanding
      config={{
        logo: { href: "javascript:alert(1)" },
        type: { color: "red;display:none" },
        layout: { standalone: false, align: "left" },
        signup: { opacity: 25, thickness: 0.5 },
      }}
      socialLinks={[
        { network: "instagram", label: "Instagram", href: "javascript:alert(1)" },
        { network: "linkedin", label: "LinkedIn", href: "https://linkedin.com/company/example" },
      ]}
    />
  );
  expect(screen.queryByRole("link", { name: "Instagram" })).toBeNull();
  expect(screen.getByRole("link", { name: "LinkedIn" })).toHaveAttribute(
    "href",
    "https://linkedin.com/company/example"
  );
  expect(container.querySelector("section")).toHaveAttribute(
    "data-after-hours-standalone",
    "false"
  );
  expect(container.querySelector("section")?.style.getPropertyValue("--ah-color")).toBe("#f4f4f4");
  expect(container.querySelector("section")?.style.getPropertyValue("--ah-line")).toBe("0.5px");
});
it("opens and closes the native accessible About dialog", () => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    },
  });
  render(<AfterHoursLanding />);
  fireEvent.click(screen.getByRole("button", { name: "About" }));
  expect(screen.getByRole("dialog")).toHaveAttribute("open");
  fireEvent.click(screen.getByRole("button", { name: "Close about" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("button", { name: "About" })).toHaveAttribute("aria-expanded", "false");
});
it("uses the real newsletter endpoint, reports failure and accepts retry without claiming confirmation", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({ ok: false, status: 429 })
    .mockResolvedValueOnce({ ok: true });
  vi.stubGlobal("fetch", fetch);
  render(<AfterHoursLanding showSignup />);
  fireEvent.change(screen.getByRole("textbox", { name: "Email address" }), {
    target: { value: "reader@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent("we've got your address")
  );
  expect(fetch).toHaveBeenCalledWith(
    "/api/newsletter",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ email: "reader@example.com", source: "newsletter" }),
    })
  );
});
