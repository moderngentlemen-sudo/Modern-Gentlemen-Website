import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RevealObserver } from "./RevealObserver";

class FakeIntersectionObserver {
  static latest: FakeIntersectionObserver | null = null;
  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();

  constructor(
    private readonly callback: IntersectionObserverCallback,
    _options?: IntersectionObserverInit
  ) {
    FakeIntersectionObserver.latest = this;
  }

  emit(target: Element, isIntersecting: boolean) {
    this.callback(
      [{ target, isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }
}

beforeEach(() => {
  FakeIntersectionObserver.latest = null;
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false }))
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("RevealObserver", () => {
  it("reveals a configured element and settles after its bounded timing", async () => {
    vi.useFakeTimers();
    const { container } = render(
      <>
        <div
          data-mg-reveal=""
          style={
            {
              "--mg-reveal": "rise",
              "--mg-reveal-delay": "100",
              "--mg-reveal-duration": "300",
              "--mg-reveal-repeat": "0",
            } as React.CSSProperties
          }
        />
        <RevealObserver />
      </>
    );
    const target = container.querySelector<HTMLElement>("[data-mg-reveal]")!;

    expect(target.dataset.mgRevealState).toBe("pending");
    const observer = FakeIntersectionObserver.latest!;
    act(() => observer.emit(target, true));
    expect(target.dataset.mgRevealState).toBe("visible");
    expect(observer.unobserve).toHaveBeenCalledWith(target);

    act(() => vi.advanceTimersByTime(400));
    expect(target.dataset.mgRevealState).toBe("settled");
  });

  it("resets a repeating reveal after it leaves the viewport", async () => {
    const { container } = render(
      <>
        <div
          data-mg-reveal=""
          style={
            {
              "--mg-reveal": "fade",
              "--mg-reveal-repeat": "1",
            } as React.CSSProperties
          }
        />
        <RevealObserver />
      </>
    );
    const target = container.querySelector<HTMLElement>("[data-mg-reveal]")!;

    await waitFor(() => expect(target.dataset.mgRevealState).toBe("pending"));
    const observer = FakeIntersectionObserver.latest!;
    act(() => observer.emit(target, true));
    expect(target.dataset.mgRevealState).toBe("visible");
    act(() => observer.emit(target, false));
    expect(target.dataset.mgRevealState).toBe("pending");
    expect(observer.unobserve).not.toHaveBeenCalled();
  });

  it("never hides content when reduced motion is requested", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true }))
    );
    const { container } = render(
      <>
        <div data-mg-reveal="" style={{ "--mg-reveal": "scale" } as React.CSSProperties} />
        <RevealObserver />
      </>
    );
    const target = container.querySelector<HTMLElement>("[data-mg-reveal]")!;

    await waitFor(() => expect(target.dataset.mgRevealState).toBe("settled"));
    expect(FakeIntersectionObserver.latest).toBeNull();
  });

  it("observes configured elements inserted after the initial page render", async () => {
    render(<RevealObserver />);
    const target = document.createElement("div");
    target.dataset.mgReveal = "";
    target.style.setProperty("--mg-reveal", "slide-left");
    document.body.append(target);

    await waitFor(() => expect(target.dataset.mgRevealState).toBe("pending"));
    expect(FakeIntersectionObserver.latest?.observe).toHaveBeenCalledWith(target);
    target.remove();
  });

  it("activates and removes a reveal when live builder styling changes", async () => {
    const { container } = render(
      <>
        <div data-mg-reveal="" />
        <RevealObserver />
      </>
    );
    const target = container.querySelector<HTMLElement>("[data-mg-reveal]")!;
    expect(target.dataset.mgRevealState).toBeUndefined();

    target.style.setProperty("--mg-reveal", "rise");
    await waitFor(() => expect(target.dataset.mgRevealState).toBe("pending"));
    expect(FakeIntersectionObserver.latest?.observe).toHaveBeenCalledWith(target);

    target.style.removeProperty("--mg-reveal");
    await waitFor(() => expect(target.dataset.mgRevealState).toBeUndefined());
    expect(FakeIntersectionObserver.latest?.unobserve).toHaveBeenCalledWith(target);
  });
});
