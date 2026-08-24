import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CatalogProvider } from "@/lib/catalog/CatalogProvider";
import { CartProvider } from "@/lib/cart/CartProvider";
import { allProducts } from "@/lib/demo/catalog";
import type { Product } from "@/lib/cart/types";

import { ProductView } from "./ProductView";

/**
 * The PDP with variants — the wiring the other tests cannot reach.
 *
 * `variants.test.ts` proves the rules, `variantCart.test.tsx` proves the cart
 * and `VariantPicker.test.tsx` proves the control. What none of them proves is
 * that the page puts them together: that picking a size changes the **price**,
 * that a sold-out size disables **add to bag**, and — the one that matters most
 * — that a product with no variants renders exactly the page that sixteen
 * baseline screenshots were taken of.
 */

const SMALL = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MEDIUM = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LARGE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const plain = allProducts()[0];

const VARIED: Product = {
  ...plain,
  slug: "zz-varied-roll",
  name: "Varied Watch Roll",
  price: 145,
  variants: [
    { id: SMALL, title: "Small", sku: "MG-S", pricePence: null, availability: "out_of_stock" },
    { id: MEDIUM, title: "Medium", sku: "MG-M", pricePence: null, availability: "in_stock" },
    { id: LARGE, title: "Large", sku: "MG-L", pricePence: 15_999, availability: "in_stock" },
  ],
};

/**
 * The detail column, scoped.
 *
 * "£145" is not unique on this page — the related-products grid at the bottom
 * carries prices too, and one of them is the same. An unscoped `getByText` for
 * a price passes or fails on which products the catalogue happens to hold
 * nearby, which is not what any of these tests is about.
 */
function details() {
  return within(screen.getByRole("heading", { level: 1 }).parentElement!);
}

function renderPdp(slug: string) {
  return render(
    <CatalogProvider products={[...allProducts(), VARIED]}>
      <CartProvider>
        <ProductView slug={slug} />
      </CartProvider>
    </CatalogProvider>
  );
}

beforeEach(() => localStorage.clear());

describe("a product sold as one thing", () => {
  it("renders no picker at all", () => {
    // The property the sixteen baselines depend on: every seeded product has
    // zero variant rows, so the PDP's markup is what it was before this
    // existed. If this fails, the screenshots need re-recording.
    renderPdp(plain.slug);

    expect(screen.queryByRole("group", { name: "Options" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to bag" })).toBeEnabled();
  });
});

describe("a product sold in sizes", () => {
  it("opens on the first buyable option, not the first one", () => {
    renderPdp(VARIED.slug);

    // Small is sold out, so the page opens on Medium — a shopper should not
    // land on a disabled button and a greyed price.
    expect(screen.getByRole("button", { name: "Medium" })).toHaveAttribute("aria-pressed", "true");
    expect(details().getByText("£145")).toBeInTheDocument();
    expect(details().getByText("SKU MG-M")).toBeInTheDocument();
  });

  it("changes the price when a differently-priced size is chosen", async () => {
    const user = userEvent.setup();
    renderPdp(VARIED.slug);

    await user.click(screen.getByRole("button", { name: "Large" }));

    // The gap this whole slice closes: a merchant enters three sizes at two
    // prices and the shopper used to see one price and no picker.
    expect(details().getByText("£159.99")).toBeInTheDocument();
    expect(details().getByText("SKU MG-L")).toBeInTheDocument();
  });

  it("adds the chosen size to the bag, and says so", async () => {
    const user = userEvent.setup();
    renderPdp(VARIED.slug);

    await user.click(screen.getByRole("button", { name: "Large" }));
    await user.click(screen.getByRole("button", { name: "Add to bag" }));

    expect(screen.getByRole("button", { name: "Added to bag ✓" })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("mg-bag")!)).toEqual([
      { slug: VARIED.slug, qty: 1, variantId: LARGE },
    ]);
  });

  it("clears the confirmation when the size changes underneath it", async () => {
    const user = userEvent.setup();
    renderPdp(VARIED.slug);

    await user.click(screen.getByRole("button", { name: "Add to bag" }));
    expect(screen.getByRole("button", { name: "Added to bag ✓" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Large" }));

    // "Added to bag ✓" above a size that is not in the bag is a lie the shopper
    // acts on.
    expect(screen.getByRole("button", { name: "Add to bag" })).toBeInTheDocument();
  });

  it("shows a sold-out size's price but refuses to sell it", async () => {
    const user = userEvent.setup();
    renderPdp(VARIED.slug);

    const small = screen.getByRole("button", { name: "Small — unavailable" });
    expect(small).toBeDisabled();

    // It cannot be selected, so the add button stays live for the size that is
    // showing. The disabled state below is the one a fully-sold-out product
    // would land in.
    await user.click(small);
    expect(screen.getByRole("button", { name: "Add to bag" })).toBeEnabled();
  });

  it("disables add to bag when nothing is buyable", () => {
    render(
      <CatalogProvider
        products={[
          {
            ...VARIED,
            slug: "zz-all-gone",
            variants: [
              {
                id: SMALL,
                title: "Small",
                sku: null,
                pricePence: null,
                availability: "out_of_stock",
              },
            ],
          },
        ]}
      >
        <CartProvider>
          <ProductView slug="zz-all-gone" />
        </CartProvider>
      </CatalogProvider>
    );

    // Still shows the price — "£145, unavailable" tells a shopper more than a
    // blank — but the control says no.
    expect(details().getByText("£145")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unavailable" })).toBeDisabled();
  });
});
