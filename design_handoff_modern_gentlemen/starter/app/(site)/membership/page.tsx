"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart/CartProvider";
import { clsx } from "@/components/ui/clsx";
import { RailLabel } from "@/components/ui/RailLabel";
import { HairlineGrid } from "@/components/ui/HairlineGrid";
import { EditorialHero } from "@/components/sections/EditorialHero";
import { PullQuote } from "@/components/sections/PullQuote";
import { CtaBand } from "@/components/sections/CtaBand";

/**
 * Membership "The Debrief" — verbatim copy/prices from design_files/MG
 * Membership.dc.html. A bespoke client page (the billing toggle drives price
 * across all three tiers), reusing the shared editorial primitives. Joining the
 * featured MEMBER tier sets the cart member flag → 15% off store-wide.
 */

interface Tier {
  name: string;
  monthly: string;
  annual: string;
  blurb: string;
  perks: string[];
  cta: string;
  featured?: boolean;
}

const TIERS: Tier[] = [
  {
    name: "THE READER",
    monthly: "£0",
    annual: "£0",
    blurb: "The essentials — our weekly letter and open stories.",
    perks: ["The Debrief, every Sunday", "Unlimited free articles", "Public MG Film episodes"],
    cta: "CHOOSE PLAN",
  },
  {
    name: "THE MEMBER",
    monthly: "£9",
    annual: "£86",
    blurb: "The full house — archive, films and shop savings.",
    perks: [
      "Everything in The Reader",
      "The complete archive",
      "Member-only films & essays",
      "15% off the MG Shop",
    ],
    cta: "START — 7 DAYS FREE",
    featured: true,
  },
  {
    name: "THE PATRON",
    monthly: "£22",
    annual: "£211",
    blurb: "For the committed — events, print and early access.",
    perks: [
      "Everything in The Member",
      "The printed quarterly",
      "Invitations to MG events",
      "Early access to drops",
    ],
    cta: "CHOOSE PLAN",
  },
];

const BENEFITS = [
  { no: "01", title: "The Debrief", dek: "One considered email each Sunday. No noise, ever." },
  { no: "02", title: "The Archive", dek: "Every issue since 2026, searchable and complete." },
  {
    no: "03",
    title: "Member Films",
    dek: "Extended cuts and films we don’t publish anywhere else.",
  },
  { no: "04", title: "15% Off", dek: "A standing discount across everything in the shop." },
];

const FAQ = [
  {
    q: "Can I cancel anytime?",
    a: "Yes — memberships are month-to-month or annual, and you can cancel in a click from your account. No calls, no retention scripts.",
  },
  {
    q: "What’s in the archive?",
    a: "Every article and film we’ve published since issue 001, plus member-only long reads that never appear on the open site.",
  },
  {
    q: "Is there a free trial?",
    a: "The Member tier starts with seven days free. Cancel before it ends and you won’t be charged.",
  },
  {
    q: "Does the shop discount stack?",
    a: "The 15% member discount applies to every order and combines with free shipping over £50.",
  },
];

export default function MembershipPage() {
  const [annual, setAnnual] = useState(false);
  const cart = useCart();

  return (
    <>
      <EditorialHero
        align="center"
        eyebrow="THE DEBRIEF · MEMBERSHIP"
        headline="Join the family."
        dek="One considered email a week, the full archive, member films, events and 15% off the shop."
      >
        <div className="mt-9 inline-flex border border-mg-bd/[0.16] bg-mg-surface p-[5px]">
          {(
            [
              ["MONTHLY", false],
              ["ANNUAL · SAVE 20%", true],
            ] as const
          ).map(([label, val]) => (
            <button
              key={label}
              type="button"
              onClick={() => setAnnual(val)}
              aria-pressed={annual === val}
              className={clsx(
                "px-[22px] py-[10px] font-mono text-[10px] uppercase tracking-[0.16em] transition-colors",
                annual === val ? "bg-mg-accent text-white" : "text-mg-fg/60"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </EditorialHero>

      {/* Tiers */}
      <section className="pt-6" style={{ paddingInline: "max(22px, calc((100% - 1180px) / 2))" }}>
        <div className="grid grid-cols-1 items-stretch gap-[20px] min-[901px]:grid-cols-3 max-[900px]:mx-auto max-[900px]:max-w-[460px]">
          {TIERS.map((t) => {
            const price = annual ? t.annual : t.monthly;
            const per = price === "£0" ? "" : annual ? "/yr" : "/mo";
            return (
              <div
                key={t.name}
                data-featured={t.featured ? "true" : undefined}
                className={clsx(
                  "relative flex flex-col p-[36px_32px_32px] transition-transform duration-200 hover:-translate-y-[5px]",
                  t.featured
                    ? "bg-mg-accent text-white"
                    : "border border-mg-bd/10 bg-mg-surface text-mg-fg"
                )}
              >
                {t.featured && (
                  <span className="absolute -top-[11px] left-[32px] bg-mg-accent px-[14px] py-[5px] font-mono text-[9px] uppercase tracking-[0.2em] text-white">
                    MOST POPULAR
                  </span>
                )}
                <div
                  className={clsx(
                    "font-mono text-[10px] uppercase tracking-[0.2em]",
                    t.featured ? "text-white/85" : "text-[#ff4d5e]"
                  )}
                >
                  {t.name}
                </div>
                <div className="mt-[18px] flex items-end gap-[6px]">
                  <span
                    className={clsx(
                      "font-grotesk font-semibold text-[46px] leading-none tracking-[-0.04em]",
                      t.featured ? "text-white" : "text-mg-fg"
                    )}
                  >
                    {price}
                  </span>
                  {per && (
                    <span
                      className={clsx(
                        "mb-2 font-mono text-[11px]",
                        t.featured ? "text-white/75" : "text-mg-fg/50"
                      )}
                    >
                      {per}
                    </span>
                  )}
                </div>
                <p
                  className={clsx(
                    "mb-[22px] mt-4 font-grotesk font-light text-[14px] leading-[1.55]",
                    t.featured ? "text-white/85" : "text-mg-fg/60"
                  )}
                >
                  {t.blurb}
                </p>
                <div className="mb-7 flex flex-col gap-3">
                  {t.perks.map((pk) => (
                    <div
                      key={pk}
                      className={clsx(
                        "flex items-start gap-[10px] font-grotesk font-light text-[14px] leading-[1.4]",
                        t.featured ? "text-white/90" : "text-mg-fg/[0.82]"
                      )}
                    >
                      <span
                        className={clsx(
                          "mt-px flex-shrink-0",
                          t.featured ? "text-white" : "text-mg-accent"
                        )}
                        aria-hidden
                      >
                        ✓
                      </span>
                      <span>{pk}</span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => t.featured && cart.setMember(true)}
                  className={clsx(
                    "mt-auto flex items-center justify-center py-[14px] font-mono text-[10px] uppercase tracking-[0.2em] transition-colors",
                    t.featured
                      ? "bg-[#0d0d0d] text-white hover:brightness-110"
                      : "border border-mg-bd/[0.28] text-mg-fg hover:bg-mg-fg hover:text-mg-bg"
                  )}
                >
                  {t.cta}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Benefits */}
      <section
        className="pt-[88px]"
        style={{ paddingInline: "max(22px, calc((100% - 1320px) / 2))" }}
      >
        <RailLabel className="mb-[30px]">WHAT MEMBERS GET</RailLabel>
        <HairlineGrid className="grid-cols-1 min-[681px]:grid-cols-2 min-[821px]:grid-cols-4">
          {BENEFITS.map((b) => (
            <div key={b.no} className="bg-mg-surface p-[34px_28px]">
              <div className="font-grotesk font-semibold text-[30px] leading-none tracking-[-0.03em] text-mg-accent">
                {b.no}
              </div>
              <div className="mt-4 font-grotesk font-medium text-[17px] leading-[1.15] tracking-[-0.015em]">
                {b.title}
              </div>
              <p className="mt-[10px] font-grotesk font-light text-[13.5px] leading-[1.55] text-mg-fg/[0.58] text-pretty">
                {b.dek}
              </p>
            </div>
          ))}
        </HairlineGrid>
      </section>

      {/* Testimonial */}
      <PullQuote
        size="md"
        quote="The only subscription I've kept for three years running. It reads like a letter from a well-dressed friend."
        attribution="— T. HARWOOD, MEMBER SINCE 2023"
      />

      {/* FAQ */}
      <section className="pb-10" style={{ paddingInline: "max(22px, calc((100% - 820px) / 2))" }}>
        <RailLabel className="mb-[26px]">QUESTIONS</RailLabel>
        <div>
          {FAQ.map((f) => (
            <details key={f.q} className="group border-b border-mg-bd/10">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-[22px] font-grotesk font-medium text-[19px] leading-[1.2] tracking-[-0.015em] [&::-webkit-details-marker]:hidden">
                <span>{f.q}</span>
                <span
                  className="font-grotesk text-[22px] text-mg-accent group-open:hidden"
                  aria-hidden
                >
                  +
                </span>
                <span
                  className="hidden font-grotesk text-[22px] text-mg-accent group-open:inline"
                  aria-hidden
                >
                  –
                </span>
              </summary>
              <p className="mb-[22px] font-grotesk font-light text-[15px] leading-[1.65] text-mg-fg/[0.66] text-pretty">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      <CtaBand
        variant="centered"
        gutter={22}
        heading="Considered, not hurried. Start this Sunday."
        buttonLabel="JOIN NOW"
        successLabel="WELCOME ✓"
      />
    </>
  );
}
