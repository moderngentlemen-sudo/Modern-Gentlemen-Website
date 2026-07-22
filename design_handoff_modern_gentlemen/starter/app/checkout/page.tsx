"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart, formatGBP } from "@/lib/cart/CartProvider";
import { Field, SelectField } from "@/components/store/Field";
import { OrderSummary } from "@/components/store/OrderSummary";

const STEPS = ["Contact", "Shipping", "Payment", "Review"] as const;
const COUNTRIES = ["United Kingdom", "Ireland", "France", "Germany", "United States", "Canada", "Australia"];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Multi-step checkout. Payment is a DEMO (no card charged).
 * PRODUCTION (Track B): replace step 3 with Stripe, or redirect to a hosted
 * checkout via cart.checkoutUrl(). See 06_SUPABASE.md.
 */
export default function CheckoutPage() {
  const cart = useCart();
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [order, setOrder] = useState<{ id: string; email: string; total: string; ship: string } | null>(null);
  const [form, setForm] = useState({
    email: "", phone: "", debrief: true,
    first: "", last: "", address: "", city: "", postcode: "", country: "United Kingdom",
    cardName: "", cardNumber: "", cardExp: "", cvc: "",
  });

  const set = (k: keyof typeof form, v: string | boolean) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => {
      if (!e[k]) return e;
      const n = { ...e };
      delete n[k as string];
      return n;
    });
  };

  function validate(s: number): boolean {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!EMAIL_RE.test(form.email)) e.email = "Enter a valid email address.";
    } else if (s === 1) {
      ([["first", "First name"], ["last", "Last name"], ["address", "Address"], ["city", "City"], ["postcode", "Postcode"]] as const).forEach(
        ([k, lbl]) => {
          if (!form[k].trim()) e[k] = `${lbl} is required.`;
        }
      );
    } else if (s === 2) {
      if (!form.cardName.trim()) e.cardName = "Name on card is required.";
      if (form.cardNumber.replace(/\s/g, "").length < 12) e.cardNumber = "Enter a valid card number.";
      if (!/^\d{1,2}\s*\/?\s*\d{2}$/.test(form.cardExp)) e.cardExp = "Use MM / YY.";
      if (form.cvc.trim().length < 3) e.cvc = "Enter the CVC.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const next = () => {
    if (!validate(step)) return;
    const n = step + 1;
    setStep(n);
    setMaxStep((m) => Math.max(m, n));
    window.scrollTo({ top: 0 });
  };

  const placeOrder = () => {
    const id = "MG-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    const snapshot = {
      id,
      email: form.email,
      total: formatGBP(cart.total),
      ship: `${form.first} ${form.last}, ${form.city} ${form.postcode}`.trim(),
    };
    cart.clear();
    setOrder(snapshot);
  };

  // --- Confirmation (must precede the empty-bag guard: cart is cleared here) ---
  if (order) {
    return (
      <div className="container-mg flex min-h-[70vh] flex-col items-center justify-center py-24 text-center">
        <p className="font-mono uppercase text-xs tracking-[0.28em] text-mg-accent">Order confirmed</p>
        <p className="mt-4 font-serif italic text-2xl text-mg-accentSerif">Thank you.</p>
        <h1 className="mt-2 font-grotesk font-semibold text-3xl md:text-4xl">Your order is in.</h1>
        <p className="mt-4 max-w-md text-mg-fg/60">
          A confirmation is on its way to {order.email}. (Demo — no card was charged.)
        </p>
        <dl className="mt-8 grid grid-cols-3 gap-8 border-y border-mg-bd/15 py-6 text-left">
          {[["Order", order.id], ["Shipping to", order.ship], ["Total paid", order.total]].map(([k, v]) => (
            <div key={k}>
              <dt className="font-mono uppercase text-[10px] tracking-[0.15em] text-mg-fg/40">{k}</dt>
              <dd className="mt-1 text-sm">{v}</dd>
            </div>
          ))}
        </dl>
        <Link href="/shop" className="mt-8 inline-block font-mono uppercase text-xs tracking-[0.2em] text-mg-accent">Continue shopping →</Link>
      </div>
    );
  }

  // --- Empty bag ---
  if (cart.lines.length === 0) {
    return (
      <div className="container-mg flex min-h-[70vh] flex-col items-center justify-center py-24 text-center">
        <p className="font-mono uppercase text-xs tracking-[0.28em] text-mg-accent">Nothing to check out</p>
        <h1 className="mt-4 font-grotesk font-semibold text-3xl md:text-4xl">Your bag is empty.</h1>
        <Link
          href="/shop"
          className="mt-8 inline-block border border-mg-bd/30 px-6 py-3 font-mono uppercase text-xs tracking-[0.2em] transition-colors hover:bg-mg-fg hover:text-mg-bg"
        >
          Browse the store →
        </Link>
      </div>
    );
  }

  return (
    <div className="container-mg py-12 md:py-16">
      <h1 className="mb-8 font-grotesk font-semibold text-3xl md:text-4xl">Checkout</h1>

      <div className="flex min-h-[60vh] flex-col gap-10 min-[901px]:flex-row min-[901px]:gap-12">
        {/* Form panel */}
        <div className="order-2 flex-1 min-[901px]:order-none">
          {/* Step indicator */}
          <ol className="mb-10 flex flex-wrap items-center gap-3">
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <li key={s} className="flex items-center gap-3">
                  <button
                    disabled={i > maxStep}
                    onClick={() => i <= maxStep && setStep(i)}
                    className="flex items-center gap-2 disabled:cursor-default"
                  >
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-full font-mono text-[11px] ${
                        active ? "bg-mg-accent text-white" : done ? "bg-mg-accent/15 text-mg-accent" : "border border-mg-bd/25 text-mg-fg/40"
                      }`}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    <span className={`font-mono uppercase text-[11px] tracking-[0.15em] ${active ? "text-mg-fg" : "text-mg-fg/40"}`}>{s}</span>
                  </button>
                  {i < STEPS.length - 1 && <span className="h-px w-6 bg-mg-bd/20" />}
                </li>
              );
            })}
          </ol>

          {/* Step 1 — Contact */}
          {step === 0 && (
            <div className="grid max-w-md gap-4">
              <h2 className="font-grotesk text-xl">Contact</h2>
              <Field label="Email" type="email" autoComplete="email" value={form.email} onChange={(v) => set("email", v)} error={errors.email} />
              <Field label="Phone" type="tel" optional value={form.phone} onChange={(v) => set("phone", v)} />
              <label className="mt-1 flex items-center gap-2 text-sm text-mg-fg/70">
                <input type="checkbox" checked={form.debrief} onChange={(e) => set("debrief", e.target.checked)} className="accent-mg-accent" />
                Email me The Debrief — our weekly note.
              </label>
            </div>
          )}

          {/* Step 2 — Shipping */}
          {step === 1 && (
            <div className="grid max-w-md gap-4">
              <h2 className="font-grotesk text-xl">Shipping address</h2>
              <div className="grid grid-cols-2 gap-4">
                <Field label="First name" autoComplete="given-name" value={form.first} onChange={(v) => set("first", v)} error={errors.first} />
                <Field label="Last name" autoComplete="family-name" value={form.last} onChange={(v) => set("last", v)} error={errors.last} />
              </div>
              <Field label="Address" autoComplete="street-address" value={form.address} onChange={(v) => set("address", v)} error={errors.address} />
              <div className="grid grid-cols-2 gap-4">
                <Field label="City" value={form.city} onChange={(v) => set("city", v)} error={errors.city} />
                <Field label="Postcode" value={form.postcode} onChange={(v) => set("postcode", v)} error={errors.postcode} />
              </div>
              <SelectField label="Country" value={form.country} onChange={(v) => set("country", v)} options={COUNTRIES} />
            </div>
          )}

          {/* Step 3 — Payment */}
          {step === 2 && (
            <div className="grid max-w-md gap-4">
              <h2 className="font-grotesk text-xl">Payment</h2>
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-mg-fg/50">Demo checkout — no real card is charged.</p>
              <Field label="Name on card" value={form.cardName} onChange={(v) => set("cardName", v)} error={errors.cardName} />
              <Field label="Card number" placeholder="4242 4242 4242 4242" value={form.cardNumber} onChange={(v) => set("cardNumber", v)} error={errors.cardNumber} />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Expiry" placeholder="MM / YY" value={form.cardExp} onChange={(v) => set("cardExp", v)} error={errors.cardExp} />
                <Field label="CVC" value={form.cvc} onChange={(v) => set("cvc", v)} error={errors.cvc} />
              </div>
            </div>
          )}

          {/* Step 4 — Review */}
          {step === 3 && (
            <div className="grid max-w-md gap-4">
              <h2 className="font-grotesk text-xl">Review &amp; place order</h2>
              <ReviewCard title="Contact" onEdit={() => setStep(0)}>
                <p>{form.email}</p>
                {form.phone && <p>{form.phone}</p>}
              </ReviewCard>
              <ReviewCard title="Ship to" onEdit={() => setStep(1)}>
                <p>{form.first} {form.last}</p>
                <p>{form.address}</p>
                <p>{form.city} {form.postcode}</p>
                <p>{form.country}</p>
              </ReviewCard>
              <ReviewCard title="Payment" onEdit={() => setStep(2)}>
                <p>Card ending {form.cardNumber.replace(/\s/g, "").slice(-4) || "····"}</p>
              </ReviewCard>
            </div>
          )}

          {/* Nav buttons */}
          <div className="mt-8 flex gap-3">
            {step > 0 && (
              <button onClick={() => setStep((s) => s - 1)} className="border border-mg-bd/30 px-6 py-3 font-mono uppercase text-xs tracking-[0.15em] hover:border-mg-accent">
                ← Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button onClick={next} className="bg-mg-accent px-6 py-3 font-mono uppercase text-xs tracking-[0.15em] text-white transition-colors hover:bg-mg-fg hover:text-mg-bg">
                Continue →
              </button>
            ) : (
              <button onClick={placeOrder} className="bg-mg-accent px-6 py-3 font-mono uppercase text-xs tracking-[0.15em] text-white transition-colors hover:bg-mg-fg hover:text-mg-bg">
                Place order
              </button>
            )}
          </div>
        </div>

        {/* Summary rail (above the form on mobile) */}
        <aside className="order-1 shrink-0 self-start min-[901px]:order-none min-[901px]:w-[340px] min-[901px]:sticky min-[901px]:top-24">
          <OrderSummary heading="In your bag" showItems />
        </aside>
      </div>
    </div>
  );
}

function ReviewCard({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="border border-mg-bd/15 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono uppercase text-[11px] tracking-[0.15em] text-mg-fg/50">{title}</span>
        <button onClick={onEdit} className="font-mono uppercase text-[10px] tracking-[0.15em] text-mg-accent">Edit</button>
      </div>
      <div className="space-y-0.5 text-sm text-mg-fg/80">{children}</div>
    </div>
  );
}
