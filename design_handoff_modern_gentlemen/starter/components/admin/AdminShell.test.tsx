/**
 * Where the account links live in the rail, asserted because a spec guessed
 * wrong and CI paid for it.
 *
 * `password.spec.ts` originally reached for the Password link with
 * `getByRole("navigation").getByRole("link", …)` and found nothing: the link
 * sits in the rail's **account footer**, beside Light/Dark and Sign out, which
 * is outside the `<nav>` holding the section links. That is deliberate — it is
 * not a section of the site and needs no permission — so the test encodes it
 * rather than the layout being changed to match a spec's assumption.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));
vi.mock("@/lib/theme", () => ({ useTheme: () => ({ theme: "light", toggle: vi.fn() }) }));

import { AdminShell } from "./AdminShell";
import type { Permission } from "@/lib/domain/permissions";

function renderShell(permissions: Permission[] = ["page.read", "integration.read"]) {
  render(
    <AdminShell
      email="welcome@moderngentlemen.co"
      fullName="Modern Gentlemen"
      roles={["admin"]}
      permissions={permissions}
    >
      <div />
    </AdminShell>
  );
}

describe("the account footer", () => {
  it("offers exactly one link named Password", () => {
    renderShell();

    // Exactly one, because the E2E spec locates it unscoped. The page it opens
    // has a "Password" heading and two labels containing the word, which is why
    // the spec pins the name with Playwright's `exact` — an option Testing
    // Library has no equivalent of here, since a `name` string is already a
    // full match. (`typecheck` caught `exact` being passed to this query; the
    // tests still passed, which is precisely why it needed catching.)
    expect(screen.getAllByRole("link", { name: "Password" })).toHaveLength(1);
  });

  it("⚠️ keeps it OUTSIDE the nav, which is what the first spec got wrong", () => {
    renderShell();

    const nav = screen.getByRole("navigation");
    expect(within(nav).queryByRole("link", { name: "Password" })).toBeNull();

    // …and the section links really are in there, so the nav locator is not
    // simply broken.
    expect(within(nav).getByRole("link", { name: "Overview" })).toBeInTheDocument();
  });

  it("still hides section links the permissions do not allow", () => {
    renderShell();

    const nav = screen.getByRole("navigation");
    expect(within(nav).getByRole("link", { name: "Pages" })).toBeInTheDocument();
    // `media.read` was not granted above.
    expect(within(nav).queryByRole("link", { name: "Media" })).toBeNull();
  });
});

/**
 * ⚠️ **A nav entry is a promise that a screen exists.**
 *
 * Both Templates and Patterns sat in `NAV` from Phase 4 with neither route
 * built, so every seeded admin — who holds `template.read` and `pattern.read` —
 * got a 404 straight from the sidebar. Both were removed, and each came back
 * only on the commit that built its screen: patterns first, then templates once
 * the builder learned to open a document whose payload holds named areas.
 *
 * This pins the second half of that rule. It is not a strong test on its own —
 * it cannot see whether `/admin/templates` resolves — but it fails loudly if
 * anyone removes the entry again, and it is the place the reasoning is written
 * down next to an assertion rather than only in a comment.
 */
describe("the Templates entry", () => {
  it("appears for a reader, now that the route it points at exists", () => {
    renderShell(["template.read"]);

    const nav = screen.getByRole("navigation");
    const link = within(nav).getByRole("link", { name: "Templates" });
    expect(link).toHaveAttribute("href", "/admin/templates");
  });

  it("is hidden without template.read, like every other section", () => {
    renderShell(["page.read"]);

    const nav = screen.getByRole("navigation");
    expect(within(nav).queryByRole("link", { name: "Templates" })).toBeNull();
  });
});
