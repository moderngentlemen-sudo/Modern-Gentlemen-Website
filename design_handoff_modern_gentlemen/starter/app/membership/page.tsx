"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useCart } from "@/lib/cart/CartProvider";

const TIERS = [
  { name: "The Reader", monthly: 0, annual: 0, features: ["Weekly dispatch", "Full archive", "Member-only articles"], cta: "Join free" },
  { name: "The Debrief", monthly: 8, annual: 72, features: ["Everything in Reader", "15% off the shop", "Early product access", "Quarterly print"], cta: "Become a member", featured: true },
  { name: "The Concierge", monthly: 20, annual: 180, features: ["Everything in Debrief", "Personal styling notes", "Priority on limited runs"], cta: "Go Concierge" },
];

const FAQ = [
  ["Can I cancel anytime?", "Yes — memberships are month-to-month or annual, cancel whenever."],
  ["How does the shop discount work?", "The Debrief and above get 15% off automatically at checkout."],
  ["Is the print quarterly included?", "Debrief and Concierge members receive the print at no extra cost."],
];

export default function MembershipPage() {
  const [annual, setAnnual] = useState(false);
  const [open, setOpen] = useState<number | null>(0);
  const cart = useCart();

  return (
    <div className="container-mg py-16 md:py-24">
      <div className="text-center max-w-2xl mx-auto">
        <p className="font-serif italic text-mg-accentSerif text-xl">The Debrief</p>
        <h1 className="font-grotesk font-semibold text-4xl md:text-6xl mt-3 text-balance">Membership, for the considered man.</h1>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-4 mt-10 font-mono text-xs uppercase tracking-[0.15em]">
        <span className={annual ? "text-mg-fg/40" : ""}>Monthly</span>
        <button
          onClick={() => setAnnual((a) => !a)}
          className="relative h-6 w-12 rounded-full bg-mg-bd/30"
          aria-label="Toggle billing period"
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-mg-accent transition-all ${annual ? "left-6" : "left-0.5"}`} />
        </button>
        <span className={annual ? "" : "text-mg-fg/40"}>Annual <span className="text-mg-accent">(save 25%)</span></span>
      </div>

      {/* Tiers */}
      <div className="grid md:grid-cols-3 gap-6 mt-12">
        {TIERS.map((t) => {
          const price = annual ? t.annual : t.monthly;
          return (
            <div key={t.name} className={`border p-8 flex flex-col ${t.featured ? "border-mg-accent" : "border-mg-bd/20"}`}>
              <h3 className="font-grotesk text-2xl">{t.name}</h3>
              <div className="mt-4 font-grotesk text-4xl">
                {price === 0 ? "Free" : `£${price}`}
                {price !== 0 && <span className="text-base text-mg-fg/50">/{annual ? "yr" : "mo"}</span>}
              </div>
              <ul className="mt-6 space-y-2 text-sm text-mg-fg/70 flex-1">
                {t.features.map((f) => <li key={f}>— {f}</li>)}
              </ul>
              <Button
                className="mt-8"
                variant={t.featured ? "solid" : "outline"}
                onClick={() => t.featured && cart.setMember(true)}
              >
                {t.cta}
              </Button>
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto mt-20">
        <h2 className="font-grotesk text-2xl mb-6">Questions</h2>
        {FAQ.map(([q, a], i) => (
          <div key={i} className="border-b border-mg-bd/15">
            <button className="w-full text-left py-4 flex justify-between items-center font-grotesk" onClick={() => setOpen(open === i ? null : i)}>
              {q}<span className="text-mg-accent">{open === i ? "–" : "+"}</span>
            </button>
            {open === i && <p className="pb-4 text-mg-fg/70 text-sm text-pretty">{a}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
