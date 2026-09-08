import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DesignStudioShell } from "./DesignStudioShell";

describe("Studio host bridge", () => {
  it("ignores unrelated messages and saves only the matching frame's requested snapshot", async () => {
    const actions = {
      save: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          id: "saved",
          title: "Invitation",
          slug: "invitation",
          updatedAt: "now",
          issues: [],
        },
      }),
      load: vi.fn(),
      preview: vi.fn(),
      publish: vi.fn(),
    };
    render(<DesignStudioShell initial={null} actions={actions} canPublish canPreview />);
    const frame = screen.getByTitle("Modern Gentlemen Design Studio") as HTMLIFrameElement;
    const post = vi.spyOn(frame.contentWindow!, "postMessage").mockImplementation(() => {});
    const message = (
      data: unknown,
      origin = location.origin,
      source: Window | null = frame.contentWindow
    ) =>
      act(() => {
        window.dispatchEvent(new MessageEvent("message", { data, origin, source }));
      });
    fireEvent.change(screen.getByLabelText("Page title"), { target: { value: "Invitation" } });
    fireEvent.change(screen.getByLabelText("URL /"), { target: { value: "invitation" } });
    message({ type: "mg-studio-ready" }, "https://unrelated.example");
    expect(screen.getByText("Save to site")).toBeDisabled();
    message({ type: "mg-studio-ready" });
    fireEvent.click(screen.getByText("Save to site"));
    const sent = post.mock.calls.at(-1)![0];
    message(
      { type: "mg-studio-snapshot", requestId: sent.requestId, document: {} },
      location.origin,
      window
    );
    expect(actions.save).not.toHaveBeenCalled();
    message({ type: "mg-studio-snapshot", requestId: "other", document: {} });
    expect(actions.save).not.toHaveBeenCalled();
    message({
      type: "mg-studio-snapshot",
      requestId: sent.requestId,
      document: { source: "captured" },
    });
    await waitFor(() =>
      expect(actions.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Invitation",
          slug: "invitation",
          document: { source: "captured" },
        })
      )
    );
    await waitFor(() => expect(screen.getByText("Create site preview")).toBeEnabled());
    expect(screen.getByText("Publish page")).toBeDisabled();
    message({ type: "mg-studio-changed" });
    expect(screen.getByText("Create site preview")).toBeDisabled();
  });
});
