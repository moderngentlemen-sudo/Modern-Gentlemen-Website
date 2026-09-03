import { describe, expect, it } from "vitest";
import type { NavLink, NavigationViewer } from "./domain/navigation";
import { filterVisibleNavigation } from "./useVisibleNavigation";

const viewer: NavigationViewer = {
  auth: "out",
  member: false,
  device: "mobile",
  now: Date.parse("2026-09-03T12:00:00.000Z"),
};

function link(id: string, overrides: Partial<NavLink> = {}): NavLink {
  return { id, label: id, href: `/${id}`, children: [], ...overrides };
}

describe("filterVisibleNavigation", () => {
  it("filters every tree level without mutating the source", () => {
    const links = [
      link("public", {
        children: [link("desktop", { visibility: { devices: ["desktop"] } }), link("mobile")],
      }),
      link("account", { visibility: { auth: "in" } }),
    ];

    const result = filterVisibleNavigation(links, viewer);
    expect(result.map((item) => item.id)).toEqual(["public"]);
    expect(result[0].children.map((item) => item.id)).toEqual(["mobile"]);
    expect(links[0].children).toHaveLength(2);
  });
});
