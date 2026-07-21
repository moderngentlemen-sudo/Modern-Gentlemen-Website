"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart, formatGBP } from "@/lib/cart/CartProvider";

const STEPS = ["Contact", "Shipping", "Payment", "Review"] as const;

/**
 * Multi-step checkout. Payment here is a DEMO (no card is charged).
 * PRODUCTION: replace step 3 with Stripe Elements, OR keep steps 1–3 as data
 * capture and redirect to a Shopify/Stripe hosted checkout via cart.checkoutUrl().
 * See 03_PAGES_AND_COMPONENTS.md §Checkout.
 */
export default function CheckoutPage() {
  const cart = useCart();
  const [step, setStep] = useState(0);
  const [orderId, setOrderId] = useState<string | null>(null);

  if (orderId) {
    return (
      <div className="container-mg py-32 text-center">
        <p className="font-serif italic text-mg-accentSerif text-2xl">Thank you.</p>
        <h1 className="font-grotesk font-semibold text-4xl mt-3">Order {orderId} confirmed.</h1>
        <p className="mt-4 text-mg-fg/60">A confirmation email is on its way. (Demo — no card was charged.)</p>
        <Link href="/shop" className="inline-block mt-8 font-mono text-xs uppercase tracking-[0.2em] text-mg-accent">Continue shopping →</Link>
      </div>
    );
  }

  const placeOrder = () => {
    const id = "MG-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    cart.clear();
    setOrderId(id);
  };

  return (
    <div className="container-mg py-12 md:py-16 grid lg:grid-cols-[1fr_340px] gap-12 min-h-[70vh]">
      <div>
        {/* Step indicator */}
        <ol className="flex gap-2 mb-10 font-mono text-xs uppercase tracking-[0.15em]">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <button
                disabled={i > step}
                onClick={() => i < step && setStep(i)}
                className={`${i === step ? "text-mg-accent" : i < step ? "text-mg-fg/60" : "text-mg-fg/30"}`}
              >
                {i + 1}. {s}
              </button>
              {i < STEPS.length - 1 && <span className="text-mg-fg/20">—</span>}
            </li>
          ))}
        </ol>

        <h1 className="font-grotesk font-semibold text-3xl mb-6">{STEPS[step]}</h1>

        {/* Minimal per-step fields — add real validation per 03 spec */}
        <div className="grid gap-4 max-w-md">
          {step === 0 && <Field label="Email" type="email" />}
          {step === 1 && (
            <>
              <Field label="Full name" />
              <Field label="Address" />
              <Field label="City" />
              <Field label="Postcode" />
            </>
          )}
          {step === 2 && (
            <>
              <Field label="Card number" placeholder="4242 4242 4242 4242" />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Expiry" placeholder="MM/YY" />
                <Field label="CVC" />
              </div>
              <p className="font-mono text-[10px] text-mg-fg/40">Demo only — integrate Stripe before launch.</p>
            </>
          )}
          {step === 3 && (
            <p className="text-mg-fg/70 text-sm">Review your details, then place the order.</p>
          )}
        </div>

        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <button onClick={() => setStep((s) => s - 1)} className="border border-mg-bd/30 px-6 py-3 font-mono text-xs uppercase tracking-[0.15em]">Back</button>
          )}
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep((s) => s + 1)} className="bg-mg-accent text-white px-6 py-3 font-mono text-xs uppercase tracking-[0.15em]">Continue</button>
          ) : (
            <button onClick={placeOrder} className="bg-mg-accent text-white px-6 py-3 font-mono text-xs uppercase tracking-[0.15em]">Place order</button>
          )}
        </div>
      </div>

      {/* Summary rail */}
      <aside className="lg:sticky lg:top-24 self-start border border-mg-bd/15 p-6">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-mg-accent mb-4">Summary</h2>
        {cart.lines.map((l) => (
          <div key={l.slug} className="flex justify-between text-sm py-1">
            <span className="text-mg-fg/70">{l.product.name} × {l.qty}</span>
            <span className="font-mono">{formatGBP(l.lineTotal)}</span>
          </div>
        ))}
        <div className="border-t border-mg-bd/15 mt-3 pt-3 flex justify-between font-grotesk text-lg">
          <span>Total</span><span className="font-mono">{formatGBP(cart.total)}</span>
        </div>
      </aside>
    </div>
  );
}

function Field({ label, type = "text", placeholder }: { label: string; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="font-mono text-xs uppercase tracking-[0.15em] text-mg-fg/60">{label}</span>
      <input type={type} placeholder={placeholder} className="mt-1 w-full bg-transparent border border-mg-bd/30 px-4 py-3 outline-none focus:border-mg-accent" />
    </label>
  );
}
