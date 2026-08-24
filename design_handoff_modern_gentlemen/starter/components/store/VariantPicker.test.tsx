import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { VariantPicker } from "./VariantPicker";
import type { PublicVariant } from "@/lib/domain/variants";

const variants: PublicVariant[] = [
  { id: "a", title: "Small", sku: "MG-S", pricePence: null, availability: "out_of_stock" },
  { id: "b", title: "Medium", sku: "MG-M", pricePence: null, availability: "in_stock" },
  { id: "c", title: "Large", sku: "MG-L", pricePence: 15_999, availability: "preorder" },
];

describe("VariantPicker", () => {
  it("renders nothing at all for a product sold as one thing", () => {
    // The property the sixteen visual baselines depend on. Not "renders an
    // empty div" — nothing, so the PDP's markup is byte-identical to what was
    // screenshotted for every product the seed carries.
    const { container } = render(
      <VariantPicker variants={[]} selectedId={null} onSelect={() => {}} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("marks the selected option pressed and the others not", () => {
    render(<VariantPicker variants={variants} selectedId="b" onSelect={() => {}} />);

    expect(screen.getByRole("button", { name: "Medium" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Large" })).toHaveAttribute("aria-pressed", "false");
  });

  it("disables an unbuyable option and says why in its accessible name", () => {
    render(<VariantPicker variants={variants} selectedId="b" onSelect={() => {}} />);

    // The strike-through carries the meaning visually; the label is what a
    // screen reader gets, and without it "Small" reads as an ordinary choice.
    const small = screen.getByRole("button", { name: "Small — unavailable" });
    expect(small).toBeDisabled();
  });

  it("treats preorder as buyable", () => {
    render(<VariantPicker variants={variants} selectedId="b" onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: "Large" })).toBeEnabled();
  });

  it("reports the chosen option and cannot report a disabled one", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<VariantPicker variants={variants} selectedId="b" onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: "Large" }));
    expect(onSelect).toHaveBeenCalledWith("c");

    await user.click(screen.getByRole("button", { name: "Small — unavailable" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("labels the group, so the options are not a loose row of buttons", () => {
    render(<VariantPicker variants={variants} selectedId="b" onSelect={() => {}} />);
    expect(screen.getByRole("group", { name: "Options" })).toBeInTheDocument();
  });
});
