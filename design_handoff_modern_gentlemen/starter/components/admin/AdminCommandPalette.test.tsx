import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { AdminCommandPalette } from "./AdminCommandPalette";

const commands = [
  { href: "/admin/pages", label: "Pages", keywords: ["website", "builder"] },
  { href: "/admin/media", label: "Media", keywords: ["images", "assets"] },
];

describe("AdminCommandPalette", () => {
  it("opens with the global shortcut, searches aliases and routes the active result", () => {
    render(<AdminCommandPalette commands={commands} />);

    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    const search = screen.getByRole("searchbox", { name: "Search admin commands" });
    fireEvent.change(search, { target: { value: "images" } });

    expect(screen.queryByRole("option", { name: /Pages/ })).toBeNull();
    fireEvent.keyDown(search, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/admin/media");
    expect(screen.queryByRole("dialog", { name: "Search admin" })).toBeNull();
  });

  it("supports arrow navigation and only exposes supplied commands", () => {
    render(<AdminCommandPalette commands={commands.slice(0, 1)} />);
    fireEvent.click(screen.getByRole("button", { name: /Search admin/ }));

    expect(screen.getByRole("option", { name: /Pages/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Media/ })).toBeNull();
  });
});
