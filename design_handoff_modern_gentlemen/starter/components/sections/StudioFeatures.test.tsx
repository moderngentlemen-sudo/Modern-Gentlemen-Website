import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudioMegaMenu } from "./StudioMegaMenu";
import { StudioVideo } from "./StudioVideo";

beforeEach(() => {
  vi.mocked(HTMLMediaElement.prototype.play).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("published Studio interactions", () => {
  it("switches stories with roving keyboard tabs and only links cards with a destination", () => {
    const animate = vi.fn(() => ({ cancel: vi.fn() }));
    Object.defineProperty(HTMLElement.prototype, "animate", { value: animate, configurable: true });
    render(
      <StudioMegaMenu
        width={760}
        config={{
          categories: [
            { label: "Style", stories: [{ title: "Wardrobe", description: "Keep what lasts." }] },
            { label: "Culture", stories: [{ title: "Curiosity", url: "/stories" }] },
          ],
          storyAnimation: "slide",
          animationDuration: 300,
        }}
      />
    );
    expect(screen.queryByRole("link", { name: "Wardrobe" })).not.toBeInTheDocument();
    expect(screen.queryByText("Read story")).not.toBeInTheDocument();
    const first = screen.getByRole("tab", { name: "Style" });
    fireEvent.keyDown(first, { key: "ArrowDown" });
    const second = screen.getByRole("tab", { name: "Culture" });
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute("aria-selected", "true");
    expect(first).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Culture");
    expect(screen.getByRole("link", { name: "Curiosity" })).toHaveAttribute("href", "/stories");
    expect(animate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ transform: "translateX(18px)" })]),
      expect.objectContaining({ duration: 300 })
    );
    fireEvent.keyDown(second, { key: "Home" });
    expect(first).toHaveFocus();
  });
  it("respects reduced motion and the configured corner play/pause control", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);
    let intersect: (entries: { isIntersecting: boolean }[]) => void = () => {};
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: typeof intersect) {
          intersect = callback;
        }
        observe() {}
        disconnect() {}
      }
    );
    const { container } = render(
      <StudioVideo
        src="/clip.webm"
        poster="/poster.jpg"
        label="Feature film"
        options={{ autoplay: true, controls: false, repeat: true, showToggle: true }}
        mediaStyle={{ objectFit: "contain" }}
      />
    );
    const player = container.querySelector("video")!;
    act(() => intersect([{ isIntersecting: true }]));
    expect(player.play).not.toHaveBeenCalled();
    expect(player).toHaveAttribute("playsinline");
    expect(player).toHaveAttribute("loop");
    expect(player).not.toHaveAttribute("autoplay");
    expect(player).not.toHaveAttribute("controls");
    fireEvent.click(screen.getByRole("button", { name: "Play video" }));
    expect(player.play).toHaveBeenCalledTimes(1);
    fireEvent.play(player);
    expect(screen.getByRole("button", { name: "Pause video" })).toBeVisible();
    fireEvent.pause(player);
    expect(screen.getByRole("button", { name: "Play video" })).toBeVisible();
    fireEvent.error(player);
    expect(screen.getByRole("status")).toHaveTextContent("Video could not load.");
  });
  it("pauses hidden responsive videos and does not autoplay until visible", () => {
    let intersect: (entries: { isIntersecting: boolean }[]) => void = () => {};
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: typeof intersect) {
          intersect = callback;
        }
        observe() {}
        disconnect() {}
      }
    );
    const { container } = render(
      <StudioVideo src="/clip.webm" label="Film" options={{ autoplay: true }} mediaStyle={{}} />
    );
    const player = container.querySelector("video")!;
    expect(player.play).not.toHaveBeenCalled();
    act(() => intersect([{ isIntersecting: true }]));
    expect(player.play).toHaveBeenCalledTimes(1);
    act(() => intersect([{ isIntersecting: false }]));
    expect(player.pause).toHaveBeenCalled();
    expect(player).toHaveAttribute("controls");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
