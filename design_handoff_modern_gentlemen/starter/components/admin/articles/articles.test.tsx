/**
 * The KEEP READING picker.
 *
 * The contract worth protecting is that this control is an **ordered** list, not
 * a set. Tags on the same screen toggle and their order is meaningless;
 * `article_relations.position` exists precisely because these three have a
 * sequence, and every assertion below is about that difference surviving.
 *
 * The two constraints the table enforces — no self-reference, no duplicate —
 * are asserted as *unreachable from the UI* rather than as errors, which is the
 * claim `normalizeRelatedIds` is the backstop for.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { KEEP_READING_COUNT } from "@/lib/domain/articles";

import { RelatedArticles, type RelatedCandidate } from "./RelatedArticles";

const CANDIDATES: RelatedCandidate[] = [
  { id: "id-a", title: "Speed, Considered", status: "published" },
  { id: "id-b", title: "The Coachbuilder's Floor", status: "published" },
  { id: "id-c", title: "A Wardrobe of Ten Things", status: "published" },
  { id: "id-d", title: "Notes on a Draft", status: "draft" },
];

function setup(chosen: string[] = []) {
  const onChange = vi.fn();
  render(<RelatedArticles chosen={chosen} candidates={CANDIDATES} onChange={onChange} />);
  return { onChange };
}

describe("RelatedArticles", () => {
  it("says what an empty list means, rather than showing nothing", () => {
    setup();
    // The fallback is real behaviour, not an error state — an editor needs to
    // know the rail is populated either way.
    expect(screen.getByText(/falls back to the newest stories/i)).toBeTruthy();
  });

  it("adds to the end, keeping the order the editor built", async () => {
    const { onChange } = setup(["id-a"]);

    await userEvent.selectOptions(screen.getByLabelText("Add an article"), "id-c");

    expect(onChange).toHaveBeenCalledWith(["id-a", "id-c"]);
  });

  it("never offers the articles already chosen — a duplicate is a primary-key violation", () => {
    setup(["id-a", "id-b"]);

    const options = [...screen.getByLabelText("Add an article").querySelectorAll("option")].map(
      (option) => option.getAttribute("value")
    );

    expect(options).not.toContain("id-a");
    expect(options).not.toContain("id-b");
    expect(options).toContain("id-c");
  });

  it("reorders without losing anyone", async () => {
    const { onChange } = setup(["id-a", "id-b", "id-c"]);

    await userEvent.click(screen.getByLabelText("Move The Coachbuilder's Floor up"));

    expect(onChange).toHaveBeenCalledWith(["id-b", "id-a", "id-c"]);
  });

  it("cannot move the first up or the last down", () => {
    setup(["id-a", "id-b"]);

    expect(screen.getByLabelText("Move Speed, Considered up")).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Move The Coachbuilder's Floor down")).toHaveProperty(
      "disabled",
      true
    );
  });

  it("removes the one asked for and no other", async () => {
    const { onChange } = setup(["id-a", "id-b", "id-c"]);

    await userEvent.click(screen.getByLabelText("Remove The Coachbuilder's Floor"));

    expect(onChange).toHaveBeenCalledWith(["id-a", "id-c"]);
  });

  it("stops offering more once the grid is full", () => {
    setup(["id-a", "id-b", "id-c"]);

    expect(CANDIDATES.length).toBeGreaterThan(KEEP_READING_COUNT); // a 4th exists to offer
    expect(screen.queryByLabelText("Add an article")).toBeNull();
    expect(
      screen.getByText(new RegExp(`${KEEP_READING_COUNT} is what the grid renders`))
    ).toBeTruthy();
  });

  it("marks a chosen draft, because RLS will hide it from the public page", () => {
    setup(["id-d"]);
    expect(screen.getByText("draft")).toBeTruthy();
  });

  it("offers nothing at all when read-only", () => {
    const onChange = vi.fn();
    render(
      <RelatedArticles chosen={["id-a"]} candidates={CANDIDATES} onChange={onChange} disabled />
    );

    expect(screen.queryByLabelText("Add an article")).toBeNull();
    expect(screen.getByLabelText("Remove Speed, Considered")).toHaveProperty("disabled", true);
  });
});
