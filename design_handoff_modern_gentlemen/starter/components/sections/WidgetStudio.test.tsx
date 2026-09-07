import { afterEach, describe, it, expect, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { WidgetStudio } from "./WidgetStudio";
import { SectionRenderer } from "../SectionRenderer";
import { newBlockNode } from "../admin/builder/node";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("widget studio", () => {
  it("styles countdown numbers and labels independently and retains styles while ticking", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-06T12:00:00Z"));
    render(
      <WidgetStudio
        target="2026-09-07T12:00:00Z"
        typography={{
          display: { fontSize: 56, textColor: "#123456", fontFamily: "systemSerif" },
          labels: {
            fontSize: 14,
            textColor: "#654321",
            letterSpacing: 0.12,
            textTransform: "uppercase",
          },
        }}
      />
    );
    expect(screen.getByText("Days")).toHaveStyle({
      fontSize: "14px",
      color: "#654321",
      letterSpacing: "0.12em",
    });
    expect(screen.getByText("01")).toHaveStyle({ fontSize: "56px", color: "#123456" });
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText("23")).toHaveStyle({ fontSize: "56px", color: "#123456" });
  });
  it("keeps absent typography identical and applies panel text without changing tab behavior", () => {
    const props = { variant: "stat", value: "42" };
    expect(renderToStaticMarkup(<WidgetStudio {...props} />)).toBe(
      renderToStaticMarkup(<WidgetStudio {...props} typography={{}} />)
    );
    render(
      <WidgetStudio
        variant="tabs"
        items={[{ title: "One", text: "Content" }]}
        typography={{ controls: { fontSize: 22 }, body: { fontSize: 18 } }}
      />
    );
    expect(screen.getByRole("tab")).toHaveStyle({ fontSize: "22px" });
    expect(screen.getByRole("tabpanel")).toHaveStyle({ fontSize: "18px" });
  });
  it("ticks a timezone-qualified timer, hides seconds and replaces expiry without going negative", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-06T12:00:00Z"));
    render(
      <WidgetStudio
        variant="countdown"
        target="2026-09-06T12:00:02Z"
        seconds={false}
        expired="Ready"
      />
    );
    expect(screen.getByRole("timer")).toHaveTextContent("Days");
    expect(screen.queryByText("Seconds")).toBeNull();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.getByText("Ready")).toBeTruthy();
  });
  it("does not fabricate a launch date or unsafe social destinations", () => {
    const { rerender } = render(<WidgetStudio />);
    expect(screen.queryByRole("timer")).toBeNull();
    rerender(
      <WidgetStudio
        variant="social"
        items={[
          { title: "Bad", href: "javascript:alert(1)" },
          { title: "Instagram", network: "instagram", href: "https://instagram.com/example" },
        ]}
      />
    );
    expect(screen.queryByRole("link", { name: "Bad" })).toBeNull();
    expect(screen.getByRole("link", { name: "Instagram" }).querySelector("svg")).toBeTruthy();
  });
  it("supports arrow/Home/End navigation with tab focus and matching panels", () => {
    render(
      <WidgetStudio
        variant="tabs"
        items={[
          { title: "One", text: "First panel" },
          { title: "Two", text: "Second panel" },
        ]}
      />
    );
    const one = screen.getByRole("tab", { name: "One" }),
      two = screen.getByRole("tab", { name: "Two" });
    fireEvent.keyDown(one, { key: "ArrowRight" });
    expect(two).toHaveFocus();
    expect(two).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Second panel");
    fireEvent.keyDown(two, { key: "Home" });
    expect(one).toHaveFocus();
  });
  it("uses native details for accordion and labeled bounded progress", () => {
    const { rerender } = render(
      <WidgetStudio variant="accordion" items={[{ title: "Question", text: "Answer" }]} />
    );
    expect(screen.getByText("Question").tagName).toBe("SUMMARY");
    rerender(<WidgetStudio variant="progress" title="Preparation" progress={120} />);
    expect(screen.getByRole("progressbar", { name: "Preparation" })).toHaveAttribute(
      "value",
      "100"
    );
  });
  it("captures email via the existing endpoint and reports truthful success", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetcher);
    render(<WidgetStudio variant="newsletter" />);
    fireEvent.change(screen.getByRole("textbox", { name: "Email address" }), {
      target: { value: "reader@example.com" },
    });
    await act(async () => fireEvent.submit(screen.getByRole("textbox").closest("form")!));
    expect(fetcher).toHaveBeenCalledWith(
      "/api/newsletter",
      expect.objectContaining({
        body: JSON.stringify({ email: "reader@example.com", source: "newsletter" }),
      })
    );
    expect(screen.getByRole("status")).toHaveTextContent("got your address");
  });
});
describe("grid public rendering", () => {
  it("keeps grid metadata inert outside a grid and applies it to the outer cell inside", () => {
    const node = newBlockNode("nativeText");
    const before = renderToStaticMarkup(<SectionRenderer sections={[node]} />);
    node.visual = { grid: { desktop: { column: 4, row: 2, span: 6, rows: 2 } } };
    expect(renderToStaticMarkup(<SectionRenderer sections={[node]} />)).toBe(before);
    const grid = newBlockNode("gridLayout");
    grid.children = [node];
    const html = renderToStaticMarkup(<SectionRenderer sections={[grid]} />);
    expect(html).toContain("--grid-desktop-column:4 / span 6");
    expect(html).toContain("--grid-mobile-column:auto / span 12");
    node.visibility = { hidden: true };
    expect(renderToStaticMarkup(<SectionRenderer sections={[grid]} />)).not.toContain(
      "--grid-desktop-column:4"
    );
  });
});
