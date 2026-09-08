import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

describe("bundled Studio bridge", () => {
  it("captures all devices without changing the editor or exporting unrelated workspace drafts", () => {
    const html = readFileSync("studio-assets/index.html", "utf8");
    const start = html.indexOf("      // Authenticated host bridge:");
    const script = html.slice(start, html.indexOf("      const clockTimer=", start));
    expect(start).toBeGreaterThan(0);
    const postMessage = vi.fn();
    let handler: (event: { source: unknown; origin: string; data: unknown }) => void = () => {};
    const parent = { postMessage };
    const original = {
      layoutDevice: "tablet",
      title: "Page",
      page: "#ffffff",
      sections: [{ uid: "one" }],
      nodes: [{ id: 1, mediaId: "asset-1" }],
      workspace: { pages: [{ title: "Other draft" }] },
    };
    const context: Record<string, unknown> = {
      state: original,
      device: "tablet",
      views: ["desktop", "tablet", "mobile"],
      richEditing: false,
      window: {
        parent,
        addEventListener: (_type: string, callback: typeof handler) => {
          handler = callback;
        },
      },
      location: { origin: "https://example.test" },
      clone: structuredClone,
      queueRecovery: vi.fn(),
      pageDoc: () => {
        const copy = structuredClone(context.state) as Record<string, unknown>;
        delete copy.workspace;
        return copy;
      },
      sectionHeight: () => 480,
      mediaById: () => ({ original: "/images/hero-cover.jpg", src: "data:sample" }),
      setLayoutDevice: (view: string) => {
        (context.state as Record<string, unknown>).layoutDevice = view;
        context.device = view;
      },
      reflow: vi.fn(),
    };
    runInNewContext(script, context);
    postMessage.mockClear();
    handler({ source: {}, origin: "https://example.test", data: { type: "mg-studio-capture" } });
    expect(postMessage).not.toHaveBeenCalled();
    handler({
      source: parent,
      origin: "https://example.test",
      data: { type: "mg-studio-capture", requestId: "request" },
    });
    const captured = postMessage.mock.calls[0][0];
    expect(captured.error).toBeUndefined();
    expect(captured.document.source).not.toHaveProperty("workspace");
    expect(captured.document.source.nodes[0].src).toBe("/images/hero-cover.jpg");
    expect(captured.document.source.nodes[0]).not.toHaveProperty("mediaId");
    expect(captured.document.views.mobile.layoutDevice).toBe("mobile");
    expect(captured.document.views.desktop.sections[0].height).toBe(480);
    expect(context.state).toBe(original);
    expect(original.layoutDevice).toBe("tablet");
    expect(context.device).toBe("tablet");
  });
});
