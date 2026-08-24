import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CartProvider, useCart, formatGBP } from "./CartProvider";
import { CatalogProvider } from "@/lib/catalog/CatalogProvider";
import { allProducts } from "@/lib/demo/catalog";
import { cartLineKey } from "@/lib/domain/variants";
import type { Product } from "./types";

/**
 * The cart, once a product is sold in more than one size.
 *
 * Kept apart from `CartProvider.test.tsx` because that file's fixture is the
 * demo catalogue, and **no product in it has a variant** — which is the fact
 * that lets the picker be additive to sixteen verified screenshots. Testing
 * variants there would have meant editing the fixture the seed and the
 * integration suite both depend on. So the fixture here is local and explicit.
 *
 * The three things worth proving: two sizes are two lines at two prices, a bag
 * written before variants existed still prices exactly as it did, and the
 * totals are computed in pence rather than in pounds.
 */

const SMALL = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MEDIUM = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LARGE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

/**
 * £145 product; the small is sold out, the medium inherits the product's price
 * (`pricePence: null`) and the large costs £159.99.
 *
 * The odd price is the point of the large: 159.99 as a float multiplied by 3 is
 * 479.96999999999997, so a line total computed in pounds renders £479.97 only
 * by luck of `toLocaleString`, and the subtotal it feeds is wrong by a fraction
 * of a penny that compounds. Every price in the demo catalogue is a whole
 * number of pounds, which is why nothing caught this before variants existed.
 */
const VARIED: Product = {
  slug: "zz-varied-roll",
  cat: "Watches",
  catLabel: "WATCHES",
  name: "Varied Watch Roll",
  price: 145,
  tag: "",
  material: "Waxed canvas",
  blurb: "",
  story: "",
  specs: [],
  images: ["/images/x.jpg"],
  variants: [
    {
      id: SMALL,
      title: "Small",
      sku: "MG-S",
      pricePence: null,
      availability: "out_of_stock",
    },
    { id: MEDIUM, title: "Medium", sku: "MG-M", pricePence: null, availability: "in_stock" },
    { id: LARGE, title: "Large", sku: "MG-L", pricePence: 15_999, availability: "in_stock" },
  ],
};

const products = [...allProducts(), VARIED];

function Harness() {
  const cart = useCart();
  return (
    <div>
      <output data-testid="count">{cart.count}</output>
      <output data-testid="lines">{cart.lines.length}</output>
      <output data-testid="subtotal">{formatGBP(cart.subtotal)}</output>
      <output data-testid="keys">{cart.lines.map((l) => l.key).join("|")}</output>
      <output data-testid="titles">
        {cart.lines.map((l) => l.variant?.title ?? "—").join("|")}
      </output>
      <output data-testid="units">{cart.lines.map((l) => formatGBP(l.unitPrice)).join("|")}</output>
      <output data-testid="totals">
        {cart.lines.map((l) => formatGBP(l.lineTotal)).join("|")}
      </output>
      {/* The raw number, not the formatted one: `toLocaleString` rounds to
          three decimals, so £479.96999999999997 *prints* as "£479.97" and a
          test on the string would pass over the very error it is here for. */}
      <output data-testid="raw">{cart.lines.map((l) => l.lineTotal).join("|")}</output>
      <output data-testid="has">{String(cart.has(VARIED.slug))}</output>
      <button onClick={() => cart.add(VARIED.slug, 1, MEDIUM)}>add medium</button>
      <button onClick={() => cart.add(VARIED.slug, 3, LARGE)}>add three large</button>
      <button onClick={() => cart.add(VARIED.slug)}>quick add</button>
      <button onClick={() => cart.remove(cartLineKey(VARIED.slug, MEDIUM))}>remove medium</button>
      <button onClick={() => cart.setQty(cartLineKey(VARIED.slug, LARGE), 0)}>zero large</button>
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

describe("a cart holding variants", () => {
  it("keeps two sizes of one product as two lines at two prices", async () => {
    const user = userEvent.setup();
    renderCart();

    await user.click(screen.getByText("add medium"));
    await user.click(screen.getByText("add three large"));

    expect(value("lines")).toBe("2");
    expect(value("count")).toBe("4");
    expect(value("titles")).toBe("Medium|Large");
    // The medium inherits £145; the large carries its own £159.99.
    expect(value("units")).toBe("£145|£159.99");
  });

  it("computes a line total in pence, not in pounds", async () => {
    const user = userEvent.setup();
    renderCart();

    await user.click(screen.getByText("add three large"));

    // 15999 * 3 = 47997 pence. In pounds this is 159.99 * 3 =
    // 479.96999999999997, and the subtotal it feeds carries that error into the
    // member discount and the free-shipping threshold.
    expect(value("totals")).toBe("£479.97");
    expect(value("subtotal")).toBe("£479.97");
    // The assertion that bites: pounds arithmetic gives 479.96999999999997
    // here, and only the string above would have hidden it.
    expect(value("raw")).toBe("479.97");
  });

  it("merges a repeat of the same variant into one line", async () => {
    const user = userEvent.setup();
    renderCart();

    await user.click(screen.getByText("add medium"));
    await user.click(screen.getByText("add medium"));

    expect(value("lines")).toBe("1");
    expect(value("count")).toBe("2");
  });

  it("gives a quick-add from a card the first sellable variant", async () => {
    const user = userEvent.setup();
    renderCart();

    // A product card has no picker to read a variant from, so `cart.add(slug)`
    // passes none. The small is sold out, so the default is the medium — the
    // line must not enter the bag unnamed and unpriced.
    await user.click(screen.getByText("quick add"));

    expect(value("titles")).toBe("Medium");
    expect(value("keys")).toBe(cartLineKey(VARIED.slug, MEDIUM));
  });

  it("removes and re-quantifies one variant without touching the other", async () => {
    const user = userEvent.setup();
    renderCart();

    await user.click(screen.getByText("add medium"));
    await user.click(screen.getByText("add three large"));
    await user.click(screen.getByText("zero large"));

    expect(value("lines")).toBe("1");
    expect(value("titles")).toBe("Medium");

    await user.click(screen.getByText("remove medium"));
    expect(value("lines")).toBe("0");
  });

  it("reports the product as in the bag whatever the variation", async () => {
    const user = userEvent.setup();
    renderCart();

    expect(value("has")).toBe("false");
    await user.click(screen.getByText("add three large"));
    // Drives the cards' "Added ✓": a shopper holding the large holds this
    // product, and a card has no way to say which size it means.
    expect(value("has")).toBe("true");
  });

  it("persists the variant and rehydrates it", async () => {
    const user = userEvent.setup();
    const { unmount } = renderCart();

    await user.click(screen.getByText("add three large"));
    expect(JSON.parse(localStorage.getItem("mg-bag")!)).toEqual([
      { slug: VARIED.slug, qty: 3, variantId: LARGE },
    ]);

    unmount();
    renderCart();
    expect(value("titles")).toBe("Large");
    expect(value("units")).toBe("£159.99");
  });
});

describe("a bag written before variants existed", () => {
  it("prices exactly as it did, with no variant named", () => {
    // The compatibility case. `{ slug, qty }` is what every bag in a shopper's
    // browser holds today; it must keep parsing, keep its identity (the key is
    // the bare slug) and keep the product's own price.
    localStorage.setItem("mg-bag", JSON.stringify([{ slug: VARIED.slug, qty: 2 }]));
    renderCart();

    expect(value("lines")).toBe("1");
    expect(value("keys")).toBe(VARIED.slug);
    expect(value("titles")).toBe("—");
    expect(value("units")).toBe("£145");
    expect(value("totals")).toBe("£290");
  });

  it("survives the merchant deleting the variant a line names", () => {
    // A bag outlives an admin edit. The line falls back to the product's price
    // rather than rendering NaN or vanishing without explanation.
    localStorage.setItem(
      "mg-bag",
      JSON.stringify([{ slug: VARIED.slug, qty: 1, variantId: "deleted-long-ago" }])
    );
    renderCart();

    expect(value("lines")).toBe("1");
    expect(value("titles")).toBe("—");
    expect(value("units")).toBe("£145");
  });
});

describe("a bag somebody has hand-edited", () => {
  it.each([
    ["a zero quantity", [{ slug: "zz-varied-roll", qty: 0 }]],
    ["a negative quantity", [{ slug: "zz-varied-roll", qty: -2 }]],
    ["a non-string slug", [{ slug: 7, qty: 1 }]],
    ["a non-object entry", ["zz-varied-roll"]],
    ["an object where an array belongs", { slug: "zz-varied-roll", qty: 1 }],
  ])("drops %s rather than rendering it", (_label, stored) => {
    // `localStorage` is user-writable and `readBag` used to trust whatever
    // parsed. A fractional qty was merely wrong while line totals were computed
    // in pounds; in integer pence `penceToPounds` asserts its argument, so it
    // would throw during render. Rendering at all is half the assertion here.
    localStorage.setItem("mg-bag", JSON.stringify(stored));
    renderCart();

    expect(value("lines")).toBe("0");
    expect(value("count")).toBe("0");
  });

  it("floors a fractional quantity rather than discarding a usable line", () => {
    localStorage.setItem("mg-bag", JSON.stringify([{ slug: VARIED.slug, qty: 2.7 }]));
    renderCart();

    // `normaliseQty` floors, which is the rule `setQty` already applies — so a
    // salvageable line is salvaged rather than silently emptied. The integer is
    // the part that matters: 2.7 reaching the pence multiplication is what
    // would throw.
    expect(value("count")).toBe("2");
    expect(value("raw")).toBe("290");
  });

  it("ignores a variantId that is not a string", () => {
    localStorage.setItem("mg-bag", JSON.stringify([{ slug: VARIED.slug, qty: 1, variantId: 42 }]));
    renderCart();

    expect(value("keys")).toBe(VARIED.slug);
    expect(value("units")).toBe("£145");
  });
});
