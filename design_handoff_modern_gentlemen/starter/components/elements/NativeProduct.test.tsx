import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CatalogProvider } from "@/lib/catalog/CatalogProvider";
import { CartProvider } from "@/lib/cart/CartProvider";
import { products } from "@/lib/demo/catalog";

import { NativeProduct } from "./NativeProduct";

function renderProduct(props: Partial<React.ComponentProps<typeof NativeProduct>> = {}) {
  return render(
    <CatalogProvider products={products}>
      <CartProvider>
        <NativeProduct slug="travel-watch-roll" {...props} />
      </CartProvider>
    </CatalogProvider>
  );
}

describe("NativeProduct", () => {
  beforeEach(() => localStorage.clear());

  it("resolves a current product rather than copying catalog facts into the block", () => {
    renderProduct({ layout: "compact" });
    expect(
      screen
        .getAllByRole("link", { name: /Travel Watch Roll/ })
        .every((link) => link.getAttribute("href") === "/product/travel-watch-roll")
    ).toBe(true);
    expect(screen.getByText("£145")).toBeInTheDocument();
  });

  it("adds the resolved product to the shared bag", async () => {
    renderProduct({ layout: "compact" });
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("button", { name: /Added/ })).toBeInTheDocument();
  });

  it("exposes semantic theme hooks in the shared product card", () => {
    const { container } = renderProduct();
    expect(container.querySelector("article")).toHaveClass("mg-card");
    expect(container.querySelector("img")).toHaveClass("mg-card-media");
    expect(screen.getByRole("button", { name: /Add/ })).toHaveClass("mg-button");
  });

  it("renders nothing for a retired or misspelled slug", () => {
    const { container } = renderProduct({ slug: "not-in-the-catalog" });
    expect(container).toBeEmptyDOMElement();
  });
});
