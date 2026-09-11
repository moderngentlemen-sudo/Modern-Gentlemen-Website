import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { YouTubeArticlePlayer } from "./YouTubeArticlePlayer";
import type { YouTubeApi, YouTubePlayer } from "./youtubeIframeApi";

const api = vi.hoisted(() => ({ load: vi.fn(), claim: vi.fn(), release: vi.fn() }));
vi.mock("./youtubeIframeApi", () => ({
  loadYouTubeApi: api.load,
  claimYouTubePlayback: api.claim,
  releaseYouTubePlayback: api.release,
}));
vi.mock("@/components/ui/MediaImage", () => ({ MediaImage: () => null }));

let intersection: IntersectionObserverCallback;
let events: ConstructorParameters<YouTubeApi["Player"]>[1]["events"];
let player: YouTubePlayer;
let reduce = false;
const props = {
  embed: "https://www.youtube-nocookie.com/embed/QXZ6znSpEh0",
  title: "A film trailer",
};

beforeEach(() => {
  vi.clearAllMocks();
  reduce = false;
  player = { mute: vi.fn(), playVideo: vi.fn(), pauseVideo: vi.fn(), destroy: vi.fn() };
  api.load.mockResolvedValue({
    Player: vi.fn(function (_iframe, options) {
      events = options.events;
      return player;
    }),
  });
  vi.spyOn(window, "matchMedia").mockImplementation(() => ({
    matches: reduce,
    media: "",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersection = callback;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
    }
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function view(ratio: number) {
  await act(async () => {
    intersection(
      [{ isIntersecting: ratio > 0, intersectionRatio: ratio } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );
  });
}

describe("YouTube article autoplay", () => {
  it("waits until more than half is visible, then mutes before playing and pauses offscreen", async () => {
    const { container, unmount } = render(<YouTubeArticlePlayer {...props} loop />);
    await view(0.5);
    expect(api.load).not.toHaveBeenCalled();
    expect(container.querySelector("iframe")).toBeNull();
    await view(0.75);
    expect(api.load).toHaveBeenCalledOnce();
    const iframe = screen.getByTitle(props.title);
    expect(iframe).toHaveAttribute("allow", expect.stringContaining("autoplay"));
    const url = new URL(iframe.getAttribute("src")!);
    expect(url.searchParams.get("origin")).toBe(location.origin);
    expect(url.searchParams.get("playlist")).toBe("QXZ6znSpEh0");
    expect(url.searchParams.get("controls")).toBe("1");
    act(() => events.onReady({ target: player }));
    expect(player.mute).toHaveBeenCalledOnce();
    expect(player.playVideo).toHaveBeenCalledOnce();
    expect(vi.mocked(player.mute).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(player.playVideo).mock.invocationCallOrder[0]
    );
    await view(0);
    expect(player.pauseVideo).toHaveBeenCalledOnce();
    await view(0.9);
    expect(player.playVideo).toHaveBeenCalledOnce();
    unmount();
    expect(player.destroy).toHaveBeenCalledOnce();
    expect(api.release).toHaveBeenCalledWith(player);
  });

  it("honors reduced motion while allowing explicit click-to-play", async () => {
    reduce = true;
    render(<YouTubeArticlePlayer {...props} />);
    await view(1);
    expect(api.load).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Play YouTube video" }));
    await waitFor(() => expect(api.load).toHaveBeenCalledOnce());
    act(() => events.onReady({ target: player }));
    expect(player.playVideo).toHaveBeenCalledOnce();
  });

  it("does not autoplay if the reader leaves while the API is loading", async () => {
    render(<YouTubeArticlePlayer {...props} />);
    await view(1);
    await view(0);
    act(() => events.onReady({ target: player }));
    expect(player.playVideo).not.toHaveBeenCalled();
    await view(1);
    expect(player.playVideo).toHaveBeenCalledOnce();
  });

  it("pauses when the tab is hidden and leaves native controls for blocked autoplay", async () => {
    render(<YouTubeArticlePlayer {...props} />);
    await view(1);
    act(() => events.onReady({ target: player }));
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(player.pauseVideo).toHaveBeenCalledOnce();
    act(() => events.onAutoplayBlocked({ target: player }));
    expect(screen.getByRole("status")).toHaveTextContent("Press play in the video to start.");
    expect(screen.getByTitle(props.title)).toBeInTheDocument();
  });

  it("keeps a normal iframe usable if the API script is blocked", async () => {
    api.load.mockRejectedValue(new Error("Blocked"));
    render(<YouTubeArticlePlayer {...props} />);
    await view(1);
    expect(screen.getByRole("status")).toHaveTextContent("Press play in the video to start.");
    expect(screen.getByTitle(props.title)).toBeInTheDocument();
  });
});
