import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudioElement } from "./StudioCanvas";
import { SIGNUP_MESSAGE } from "../ui/useNewsletterSignup";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("Studio public widgets", () => {
  it("ticks to the configured end message and stops its timer", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
    const view = render(
      <StudioElement
        kind="countdown"
        canvasWidth={390}
        w={350}
        countdown={{ target: "2030-01-01T00:00:02Z", endText: "We are open.", variant: "Divided" }}
      />
    );
    expect(screen.getByRole("timer")).toHaveTextContent("02");
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("We are open.");
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("submits an address to the existing endpoint and waits for a real success response", async () => {
    let finish!: (response: Response) => void;
    const request = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        })
    );
    vi.stubGlobal("fetch", request);
    render(
      <StudioElement
        kind="signup"
        text="Join the list"
        signup={{ variant: "Underline", successText: "Thank you for your interest." }}
      />
    );
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "reader@example.com" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Email signup" }));
    expect(request).toHaveBeenCalledWith(
      "/api/newsletter",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "reader@example.com", source: "newsletter" }),
      })
    );
    expect(screen.getByRole("button", { name: "Join the list" })).toBeDisabled();
    expect(screen.queryByText("Thank you for your interest.")).not.toBeInTheDocument();
    await act(async () => {
      finish(new Response(null, { status: 201 }));
    });
    expect(screen.getByRole("status")).toHaveTextContent("Thank you for your interest.");
  });
  it.each([
    [400, SIGNUP_MESSAGE.invalid],
    [429, SIGNUP_MESSAGE.throttled],
    [503, SIGNUP_MESSAGE.error],
  ])("reports a %s signup failure without claiming success", async (status, message) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: Number(status) }))
    );
    render(<StudioElement kind="signup" signup={{ variant: "Boxed" }} />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "reader@example.com" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Email signup" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(String(message)));
    expect(screen.getByLabelText("Email address")).toHaveValue("reader@example.com");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("renders named icon links with real destinations and safe new-tab behavior", () => {
    render(
      <StudioElement
        kind="social"
        social={{
          variant: "Icons",
          links: [
            {
              label: "MG on Instagram",
              platform: "Instagram",
              url: "https://instagram.com/modern.gentlemen",
            },
          ],
        }}
      />
    );
    const link = screen.getByRole("link", { name: "MG on Instagram (opens in a new tab)" });
    expect(link).toHaveAttribute("href", "https://instagram.com/modern.gentlemen");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
