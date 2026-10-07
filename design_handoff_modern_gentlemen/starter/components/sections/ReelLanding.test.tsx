import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { comingSoonSections } from "@/lib/blocks/comingSoon";
import {
  REEL_DESIGNS,
  REEL_POSTER,
  REEL_STARTERS,
  REEL_VIDEO,
  isReelDesign,
} from "@/lib/blocks/comingSoonReel";
import { validateBlock } from "@/lib/blocks/validate";
import { ComingSoonStudio, type ComingSoonProps } from "./ComingSoonStudio";

const NOW = Date.parse("2026-10-07T09:00:00Z");
const TARGET = "2026-12-01T09:00:00Z"; // 55 days, 0:00:00 later

function matchMedia(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query.includes("reduce"),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  matchMedia(false);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function starter(variant: string): ComingSoonProps {
  return comingSoonSections(variant as never)[0].settings as unknown as ComingSoonProps;
}

describe("Sizzle-reel coming-soon designs (CS22–CS35)", () => {
  it.each(REEL_DESIGNS)("CS%s (%s) renders its starter page in full", (variant, _name, tone) => {
    const props = starter(variant);
    const { container } = render(
      <ComingSoonStudio {...props} reel={{ countdown: { target: TARGET } }} />
    );
    act(() => void vi.advanceTimersByTime(0));
    const section = container.querySelector("section")!;
    expect(section.dataset).toMatchObject({ comingSoon: variant, tone });
    expect(section.hasAttribute("data-darkband")).toBe(tone !== "light");
    expect(section.dataset.comingSoonStandalone).toBe("true");

    // The headline is the editor's title, whichever way the design sets it.
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toContain(REEL_STARTERS[variant].title.split(" ")[0]);

    const video = container.querySelector("video")!;
    expect(video.getAttribute("src")).toBe(REEL_VIDEO);
    expect(video.getAttribute("aria-hidden")).toBe("true");
    expect(video.muted).toBe(true);

    expect(screen.getByRole("textbox", { name: "Email address" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: new RegExp(REEL_STARTERS[variant].buttonLabel) })
    ).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Social media" })).toBeTruthy();
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("aria-label"))).toEqual([
      "Instagram",
      "X",
      "YouTube",
      "LinkedIn",
    ]);
    expect(screen.getByRole("timer").textContent).toContain("55");
  });

  it("seeds only valid settings and no launch date", () => {
    for (const [variant] of REEL_DESIGNS) {
      const [node] = comingSoonSections(variant);
      expect(validateBlock(node).issues).toEqual([]);
      expect(JSON.stringify(node.settings)).not.toContain("countdown");
      expect(JSON.stringify(node.settings)).not.toContain("target");
    }
    expect(isReelDesign("21")).toBe(false);
    expect(isReelDesign("22")).toBe(true);
  });

  it("shows dashes rather than an invented date until the launch is set", () => {
    render(<ComingSoonStudio {...starter("22")} />);
    act(() => void vi.advanceTimersByTime(0));
    expect(screen.getByRole("timer").textContent).toContain("––Days");
    expect(screen.getByRole("timer").textContent).not.toMatch(/\d/);
  });

  it("counts down every second and shows the launch message when it arrives", () => {
    render(
      <ComingSoonStudio
        {...starter("26")}
        reel={{ countdown: { target: "2026-10-07T09:00:03Z", message: "Doors open." } }}
      />
    );
    act(() => void vi.advanceTimersByTime(0));
    expect(screen.getByRole("timer").textContent).toContain("03 Seconds");
    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.getByRole("timer").textContent).toContain("02 Seconds");
    act(() => void vi.advanceTimersByTime(3000));
    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Doors open.");
  });

  it("uses the editor's video, still, labels, caption and standalone choice", () => {
    const { container } = render(
      <ComingSoonStudio
        {...starter("27")}
        reel={{
          video: "/media/launch.mp4",
          poster: "/images/hero-cover.jpg",
          standalone: false,
          caption: "Now showing",
          countdown: { target: TARGET, days: "Jours" },
        }}
      />
    );
    act(() => void vi.advanceTimersByTime(0));
    const video = container.querySelector("video")!;
    expect(video.getAttribute("src")).toBe("/media/launch.mp4");
    expect(video.getAttribute("poster")).toContain("hero-cover");
    expect(container.querySelector("section")!.dataset.comingSoonStandalone).toBe("false");
    expect(screen.getByText("Now showing")).toBeTruthy();
    expect(screen.getByRole("timer").textContent).toContain("Jours");
  });

  it("falls back to the bundled reel and still image", () => {
    const { container } = render(<ComingSoonStudio variant="23" />);
    const video = container.querySelector("video")!;
    expect(video.getAttribute("src")).toBe(REEL_VIDEO);
    expect(video.getAttribute("poster")).toContain(REEL_POSTER.split("/").pop());
  });

  it("never starts the reel for visitors who prefer reduced motion", () => {
    matchMedia(true);
    const play = vi.spyOn(HTMLMediaElement.prototype, "play");
    render(<ComingSoonStudio {...starter("30")} />);
    expect(play).not.toHaveBeenCalled();
  });

  it("drops unsafe social destinations and supports TikTok", () => {
    render(
      <ComingSoonStudio
        {...starter("32")}
        socialLinks={[
          { network: "tiktok", label: "TikTok", href: "https://tiktok.com/@moderngentlemen" },
          { network: "x", label: "X", href: "javascript:alert(1)" },
        ]}
      />
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("aria-label")).toBe("TikTok");
    expect(links[0].querySelector("svg")).toBeTruthy();
  });

  it("submits the signup to the newsletter service", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetch);
    render(<ComingSoonStudio {...starter("29")} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Email address" }), {
      target: { value: "reader@example.com" },
    });
    await act(async () => {
      fireEvent.submit(screen.getByRole("textbox", { name: "Email address" }).closest("form")!);
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/newsletter",
      expect.objectContaining({ method: "POST" })
    );
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      email: "reader@example.com",
      source: "newsletter",
    });
  });

  it("Clock Hands shows London time and the launch hour from the set date", () => {
    const { container } = render(
      <ComingSoonStudio {...starter("34")} reel={{ countdown: { target: TARGET } }} />
    );
    act(() => void vi.advanceTimersByTime(0));
    expect(screen.getByText("09:00 GMT, 1 December")).toBeTruthy();
    // 10:00 BST on 7 October: the hour hand sits at 10 o'clock (300° from twelve).
    const hour = container.querySelector("[aria-hidden='true'] > span") as HTMLElement;
    expect(hour.style.transform).toBe("rotate(210deg)");
  });

  it("The Auction lists its catalogue details", () => {
    render(<ComingSoonStudio {...starter("35")} />);
    expect(screen.getByText("Estimate")).toBeTruthy();
    expect(screen.getByText("Beyond reasonable")).toBeTruthy();
    expect(screen.getByText("Modern Gentlemen (British, est. 2026)")).toBeTruthy();
  });
});
