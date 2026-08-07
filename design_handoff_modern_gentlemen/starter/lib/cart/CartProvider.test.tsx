import { describe, expect, it, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartProvider, useCart, formatGBP } from "./CartProvider";
import { CatalogProvider } from "@/lib/catalog/CatalogProvider";
import { allProducts } from "@/lib/demo/catalog";

/**
 * Wires the real provider to the real catalog. This is the test that proves the
 * cart UI and lib/domain/pricing agree — if the provider ever grows its own
 * copy of the money rules again, these numbers drift and this fails.
 *
 * `CartProvider` resolves slugs through `useCatalog()` since Phase 7b, so it
 * needs the catalogue around it. The demo module is the fixture here on
 * purpose: it is also what `scripts/seed.ts` seeds from, so these numbers are
 * the same ones the live store computes.
 */

const products = allProducts();
const cheap = products.find((p) => p.price < 50)!;
const dear = products.find((p) => p.price >= 50)!;

function Harness() {
  const cart = useCart();
  return (
    <div>
      <output data-testid="count">{cart.count}</output>
      <output data-testid="subtotal">{formatGBP(cart.subtotal)}</output>
      <output data-testid="discount">{formatGBP(cart.memberDiscount)}</output>
      <output data-testid="shipping">{formatGBP(cart.shipping)}</output>
      <output data-testid="total">{formatGBP(cart.total)}</output>
      <button onClick={() => cart.add(cheap.slug)}>add cheap</button>
      <button onClick={() => cart.add(dear.slug)}>add dear</button>
      <button onClick={() => cart.setQty(cheap.slug, 0)}>zero cheap</button>
      <button onClick={() => cart.setMember(true)}>become member</button>
    </div>
  );
}

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CatalogProvider products={products}>
      <CartProvider>{children}</CartProvider>
    </CatalogProvider>
  );
}

const renderCart = () => render(<Harness />, { wrapper: Providers });
const value = (id: string) => screen.getByTestId(id).textContent;

beforeEach(() => localStorage.clear());

describe("CartProvider", () => {
  it("starts empty with no shipping charge", async () => {
    renderCart();
    expect(value("count")).toBe("0");
    expect(value("total")).toBe("£0");
  });

  it("adds a line and charges shipping below the £50 threshold", async () => {
    const user = userEvent.setup();
    renderCart();
    await user.click(screen.getByText("add cheap"));

    expect(value("count")).toBe("1");
    expect(value("subtotal")).toBe(formatGBP(cheap.price));
    expect(value("shipping")).toBe("£4.95");
  });

  it("waives shipping once the cart clears £50", async () => {
    const user = userEvent.setup();
    renderCart();
    await user.click(screen.getByText("add dear"));

    expect(value("shipping")).toBe("£0");
    expect(value("total")).toBe(formatGBP(dear.price));
  });

  it("removes a line when quantity is set to zero", async () => {
    const user = userEvent.setup();
    renderCart();
    await user.click(screen.getByText("add cheap"));
    expect(value("count")).toBe("1");

    await user.click(screen.getByText("zero cheap"));
    expect(value("count")).toBe("0");
  });

  it("applies an exact 15% member discount, to the penny", async () => {
    const user = userEvent.setup();
    renderCart();
    await user.click(screen.getByText("add dear"));
    await user.click(screen.getByText("become member"));

    const expected = Math.round(dear.price * 0.15 * 100) / 100;
    expect(value("discount")).toBe(formatGBP(expected));
  });

  it("persists the bag to the mg-bag key and rehydrates from it", async () => {
    const user = userEvent.setup();
    const { unmount } = renderCart();
    await user.click(screen.getByText("add dear"));

    expect(JSON.parse(localStorage.getItem("mg-bag")!)).toEqual([{ slug: dear.slug, qty: 1 }]);

    unmount();
    renderCart();
    expect(value("count")).toBe("1");
  });

  it("never writes to localStorage keys it does not own", async () => {
    const user = userEvent.setup();
    localStorage.setItem("someone-elses-key", "keep me");
    renderCart();

    await user.click(screen.getByText("add dear"));
    await user.click(screen.getByText("become member"));

    expect(localStorage.getItem("someone-elses-key")).toBe("keep me");
    expect(Object.keys(localStorage).sort()).toEqual(["mg-bag", "mg-member", "someone-elses-key"]);
  });

  it("reacts to a cross-tab storage event", async () => {
    renderCart();
    localStorage.setItem("mg-bag", JSON.stringify([{ slug: dear.slug, qty: 2 }]));

    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key: "mg-bag" }));
    });

    expect(value("count")).toBe("2");
  });
});
