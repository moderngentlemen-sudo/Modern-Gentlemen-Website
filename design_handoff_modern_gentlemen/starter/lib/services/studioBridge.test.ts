import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

describe("bundled Studio bridge", () => {
  it("adapts old horizontal layouts once, retaining typography, vertical geometry and mobile layouts", () => {
    const html = readFileSync("studio-assets/index.html", "utf8");
    const start = html.indexOf("      // Studio page sizing:");
    expect(start).toBeGreaterThan(0);
    const script = html.slice(start, html.indexOf("      // End Studio page sizing.", start));
    const doc = {
      layoutDevice: "desktop",
      sections: [
        { uid: "first", height: 480 },
        { uid: "second", height: 600 },
      ],
      nodes: [
        {
          id: 1,
          x: 76,
          y: 520,
          w: 380,
          h: 80,
          size: 24,
          tracking: -0.5,
          layouts: {
            desktop: { x: 76, offset: 40, w: 380, h: 80, size: 24 },
            tablet: { x: 68, offset: 50, w: 340, h: 80, size: 22 },
            mobile: { x: 24, offset: 30, w: 342, h: 100, size: 18 },
          },
        },
      ],
    };
    const mobile = structuredClone(doc.nodes[0].layouts.mobile);
    const context = { doc };
    runInNewContext(script + "\nupgradePageSizing(doc);", context);
    expect(doc.nodes[0]).toMatchObject({
      x: 141.6,
      y: 520,
      w: 708,
      h: 80,
      size: 24,
      tracking: -0.5,
    });
    expect(doc.nodes[0].layouts.tablet).toMatchObject({ x: 83.4, w: 417, offset: 50, size: 22 });
    expect(doc.nodes[0].layouts.mobile).toEqual(mobile);
    const upgraded = JSON.stringify(doc);
    runInNewContext(script + "\nupgradePageSizing(doc);", context);
    expect(JSON.stringify(doc)).toBe(upgraded);
    const custom = {
      ...context,
      window: { parent: { document: { documentElement: {} } } },
      getComputedStyle: () => ({
        getPropertyValue: (name: string) => (name === "--layout-content-width" ? "1440px" : "32px"),
      }),
    };
    runInNewContext(script + "\nupgradePageSizing(doc);", custom);
    expect(doc.nodes[0].w).toBe(752);
    expect(doc.nodes[0].size).toBe(24);
    expect(doc.nodes[0].layouts.mobile).toEqual(mobile);
  });
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
