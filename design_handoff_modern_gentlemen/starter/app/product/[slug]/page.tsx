"use client";

import { use, useState } from "react";
import Link from "next/link";
import { getProduct, related, formatGBP } from "@/lib/catalog";
import { useCart } from "@/lib/cart/CartProvider";

export default function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const product = getProduct(slug);
  const cart = useCart();
  const [img, setImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  if (!product) return <div className="container-mg py-32 text-center font-mono">Product not found.</div>;

  const memberPrice = Math.round(product.price * (1 - cart.memberRate));

  return (
    <div className="container-mg py-10 md:py-14">
      <nav className="font-mono text-xs text-mg-fg/50 mb-8">
        <Link href="/shop">Shop</Link> / <Link href={`/shop?cat=${product.cat}`}>{product.catLabel}</Link> / {product.name}
      </nav>

      <div className="grid md:grid-cols-2 gap-10 lg:gap-16">
        {/* Gallery */}
        <div className="md:sticky md:top-24 self-start">
          <div className="aspect-square overflow-hidden bg-mg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={"/" + product.images[img]} alt={product.name} className="h-full w-full object-cover" />
          </div>
          <div className="flex gap-3 mt-3">
            {product.images.map((im, i) => (
              <button key={i} onClick={() => setImg(i)} className={`h-20 w-20 overflow-hidden border ${i === img ? "border-mg-accent" : "border-transparent"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={"/" + im} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Details */}
        <div>
          {product.tag && <span className="font-mono text-[10px] tracking-widest text-mg-accent">{product.tag}</span>}
          <h1 className="font-grotesk font-semibold text-3xl md:text-4xl mt-2">{product.name}</h1>
          <div className="mt-4 flex items-baseline gap-4">
            <span className="font-grotesk text-2xl">{formatGBP(product.price)}</span>
            <span className="font-mono text-xs text-mg-fg/50">Members {formatGBP(memberPrice)}</span>
          </div>
          <p className="mt-5 text-mg-fg/70 text-pretty">{product.blurb}</p>
          <p className="mt-2 font-mono text-xs text-mg-fg/50">{product.material}</p>

          {/* Qty + add */}
          <div className="flex items-stretch gap-3 mt-8">
            <div className="flex items-center border border-mg-bd/30">
              <button className="px-4 text-lg" onClick={() => setQty((q) => Math.max(1, q - 1))}>–</button>
              <span className="px-4 font-mono">{qty}</span>
              <button className="px-4 text-lg" onClick={() => setQty((q) => q + 1)}>+</button>
            </div>
            <button
              onClick={() => { cart.add(product.slug, qty); setAdded(true); }}
              className="flex-1 bg-mg-accent text-white font-mono text-xs uppercase tracking-[0.2em] hover:bg-mg-fg hover:text-mg-bg"
            >
              {added ? "Added ✓" : "Add to bag"}
            </button>
          </div>

          {/* Story */}
          <div className="mt-12">
            <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-mg-accent mb-3">The Story</h2>
            {product.story.split("\n\n").map((para, i) => (
              <p key={i} className="text-mg-fg/80 leading-relaxed mb-4 text-pretty">{para}</p>
            ))}
          </div>

          {/* Specs */}
          <div className="mt-8">
            <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-mg-accent mb-3">Specifications</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
              {product.specs.map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-mg-bd/10 py-2 text-sm">
                  <dt className="text-mg-fg/50">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* Related */}
      <div className="mt-20">
        <h2 className="font-grotesk text-2xl mb-6">You might also like</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {related(product.slug, 4).map((p) => (
            <Link key={p.slug} href={`/product/${p.slug}`} className="group">
              <div className="aspect-[4/5] overflow-hidden bg-mg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={"/" + p.images[0]} alt={p.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </div>
              <p className="font-grotesk text-sm mt-2">{p.name}</p>
              <p className="font-mono text-xs text-mg-fg/50">{formatGBP(p.price)}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
