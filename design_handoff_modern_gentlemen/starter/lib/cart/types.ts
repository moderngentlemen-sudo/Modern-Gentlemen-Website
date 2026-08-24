import type { PublicVariant } from "@/lib/domain/variants";

export type Tag = "NEW" | "BESTSELLER" | "LIMITED" | "";

export interface Product {
  slug: string;
  cat: string;
  catLabel: string;
  name: string;
  price: number; // GBP integer
  tag: Tag;
  material: string;
  blurb: string;
  story: string; // \n\n-split paragraphs
  specs: [string, string][];
  images: string[]; // 3 image paths/urls
  /**
   * The sizes/finishes this product is sold in, in `position` order.
   *
   * **Optional, and absent rather than empty** when a product is sold as one
   * thing — which is every product the demo catalogue and the seed carry.
   * `tests/integration/publicCatalog.test.ts` deep-compares the database read
   * against that catalogue, so an always-present `[]` would fail it on a
   * difference that is not one.
   */
  variants?: PublicVariant[];
}

export interface CartLine {
  slug: string;
  qty: number;
  /**
   * Which variation this line is, or absent for a product sold as one thing.
   *
   * Optional because a bag persists in `localStorage`: every bag written before
   * variants existed holds `{ slug, qty }`, and those must keep parsing and
   * pricing exactly as they did. See `cartLineKey` in `lib/domain/variants.ts`
   * for the identity rule this feeds.
   */
  variantId?: string | null;
}

export interface EnrichedLine extends CartLine {
  product: Product;
  /**
   * The line's identity — `cartLineKey(slug, variantId)`, which is the bare
   * slug when there is no variant. Two sizes of one product are two lines, so
   * `slug` is no longer unique across `lines` and is no longer a safe React key
   * or a safe argument to `setQty`/`remove`.
   */
  key: string;
  /** The resolved variant, or null when there is none *or* it has been deleted. */
  variant: PublicVariant | null;
  /** What one of this line costs, in pounds — the variant's price or the product's. */
  unitPrice: number;
  lineTotal: number;
}

export interface CartApi {
  lines: EnrichedLine[];
  count: number;
  subtotal: number;
  isMember: boolean;
  memberRate: number; // 0.15
  memberDiscount: number;
  shipping: number; // free >= 50 else 4.95
  total: number;
  /**
   * `variantId` is optional even for a product that has variants: a card's
   * quick-add has no picker to read one from, so the provider falls back to
   * `defaultVariant` rather than adding a line that names no size. That keeps
   * every existing `cart.add(p.slug)` call site correct without a change.
   */
  add: (slug: string, qty?: number, variantId?: string | null) => void;
  /** Keyed by `EnrichedLine.key`, not by slug — see the note on that field. */
  setQty: (key: string, qty: number) => void; // 0 removes
  remove: (key: string) => void;
  clear: () => void;
  setMember: (v: boolean) => void;
  /** Whether *any* variation of this product is in the bag. */
  has: (slug: string) => boolean;
  /** Present only on the Shopify/Stripe adapter. */
  checkoutUrl?: () => Promise<string>;
}
