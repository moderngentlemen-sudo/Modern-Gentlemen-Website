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
}

export interface CartLine {
  slug: string;
  qty: number;
}

export interface EnrichedLine extends CartLine {
  product: Product;
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
  add: (slug: string, qty?: number) => void;
  setQty: (slug: string, qty: number) => void; // 0 removes
  remove: (slug: string) => void;
  clear: () => void;
  setMember: (v: boolean) => void;
  has: (slug: string) => boolean;
  /** Present only on the Shopify/Stripe adapter. */
  checkoutUrl?: () => Promise<string>;
}
