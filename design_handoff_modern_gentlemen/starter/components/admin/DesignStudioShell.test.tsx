import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DesignStudioShell } from "./DesignStudioShell";

describe("Studio host bridge", () => {
  it("ignores unrelated messages and saves only the matching frame's requested snapshot", async () => {
    const actions = {
      upload: vi
        .fn()
        .mockResolvedValue({ ok: true, data: { url: "https://example.test/media.png" } }),
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
    expect(screen.getByText("Create site preview")).toHaveAccessibleDescription(
      /Enter a page title and URL, then click Save to site/
    );
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
    // Mobile keyboards can capitalize the first character even for a URL slug.
    fireEvent.change(screen.getByLabelText("URL /"), { target: { value: "Invitation" } });
    expect(screen.getByLabelText("URL /")).toHaveValue("invitation");
    expect(screen.getByLabelText("URL /")).toHaveAttribute("autocapitalize", "none");
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
      document: { source: "captured", src: "data:image/png;base64,YQ==" },
    });
    await waitFor(() =>
      expect(actions.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Invitation",
          slug: "invitation",
          document: { source: "captured", src: "https://example.test/media.png" },
        })
      )
    );
    expect(actions.upload).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText("Create site preview")).toBeEnabled());
    expect(screen.getByText("Publish page")).toBeDisabled();
    expect(screen.getByText("Publish page")).toHaveAccessibleDescription(
      /Create a site preview first/
    );
    message({ type: "mg-studio-changed" });
    expect(screen.getByText("Create site preview")).toBeDisabled();
    expect(screen.getByText("Create site preview")).toHaveAccessibleDescription(
      /save your latest changes/
    );
  });

  it("explains invalid URLs beside the input and allows saving after correction", () => {
    const actions = {
      upload: vi.fn(),
      save: vi.fn(),
      load: vi.fn(),
      preview: vi.fn(),
      publish: vi.fn(),
    };
    render(<DesignStudioShell initial={null} actions={actions} canPublish canPreview />);
    const frame = screen.getByTitle("Modern Gentlemen Design Studio") as HTMLIFrameElement;
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "mg-studio-ready" },
          origin: location.origin,
          source: frame.contentWindow,
        })
      );
    });
    fireEvent.change(screen.getByLabelText("Page title"), { target: { value: "Test" } });
    fireEvent.change(screen.getByLabelText("URL /"), { target: { value: "test--page" } });
    expect(screen.getByLabelText("URL /")).toBeInvalid();
    expect(screen.getByLabelText("URL /")).toHaveAccessibleDescription(/single hyphens/);
    expect(screen.getByText("Save to site")).toBeDisabled();
    expect(actions.save).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("URL /"), { target: { value: "Test-Page" } });
    expect(screen.getByLabelText("URL /")).toHaveValue("test-page");
    expect(screen.getByLabelText("URL /")).toBeValid();
    expect(screen.getByText("Save to site")).toBeEnabled();
  });

  it("keeps preview disabled and saving retryable when a media upload fails", async () => {
    const actions = {
      upload: vi.fn().mockResolvedValue({
        ok: false,
        error: "Your session has expired. Sign in again to continue.",
      }),
      save: vi.fn(),
      load: vi.fn(),
      preview: vi.fn(),
      publish: vi.fn(),
    };
    render(<DesignStudioShell initial={null} actions={actions} canPublish canPreview />);
    const frame = screen.getByTitle("Modern Gentlemen Design Studio") as HTMLIFrameElement;
    const post = vi.spyOn(frame.contentWindow!, "postMessage").mockImplementation(() => {});
    const message = (data: unknown) =>
      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            data,
            origin: location.origin,
            source: frame.contentWindow,
          })
        );
      });
    message({ type: "mg-studio-ready" });
    fireEvent.change(screen.getByLabelText("Page title"), { target: { value: "Upload" } });
    fireEvent.change(screen.getByLabelText("URL /"), { target: { value: "upload" } });
    fireEvent.click(screen.getByText("Save to site"));
    message({
      type: "mg-studio-snapshot",
      requestId: post.mock.calls.at(-1)![0].requestId,
      document: { src: "data:image/png;base64,YQ==" },
    });
    await waitFor(() =>
      expect(screen.getByText(/Media 1 of 1: Your session has expired/)).toBeVisible()
    );
    expect(actions.save).not.toHaveBeenCalled();
    expect(screen.getByText("Create site preview")).toBeDisabled();
    expect(screen.getByText("Create site preview")).toHaveAccessibleDescription(
      /Save to site must succeed/
    );
    expect(screen.getByText("Save to site")).toBeEnabled();
    expect(post.mock.calls.filter(([data]) => data.type === "mg-studio-load")).toHaveLength(0);
  });

  it("shows unsupported-content blockers without requiring a disabled button or collapsed disclosure", () => {
    const actions = {
      upload: vi.fn(),
      save: vi.fn(),
      load: vi.fn(),
      preview: vi.fn(),
      publish: vi.fn(),
    };
    const page = {
      page: "Invitation",
      layoutDevice: "desktop" as const,
      sections: [{ uid: "one", height: 600 }],
      nodes: [],
    };
    render(
      <DesignStudioShell
        initial={{
          id: "saved",
          title: "Invitation",
          slug: "invitation",
          updatedAt: "now",
          document: {
            version: 1,
            source: page,
            views: { desktop: page, tablet: page, mobile: page },
          },
          issues: [{ path: "sections.0", message: "Mega menu publishing is not supported yet." }],
        }}
        actions={actions}
        canPublish
        canPreview
      />
    );
    expect(screen.getByText(/sections.0: Mega menu publishing/)).toBeVisible();
    expect(screen.getByText("Create site preview")).toBeDisabled();
    expect(screen.getByText("Publish page")).toBeDisabled();
    expect(screen.getByText("Publish page")).toHaveAccessibleDescription(
      /publishing checks listed below/
    );
    expect(actions.preview).not.toHaveBeenCalled();
    expect(actions.publish).not.toHaveBeenCalled();
  });
});
