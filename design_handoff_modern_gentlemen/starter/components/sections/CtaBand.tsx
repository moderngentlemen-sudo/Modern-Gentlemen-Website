"use client";

import { useState } from "react";
import Link from "next/link";
import { clsx } from "../ui/clsx";

interface Props {
  variant: "split" | "centered" | "link";
  eyebrow?: string;
  heading: string;
  sub?: string;                 // link variant
  placeholder?: string;         // form variants
  buttonLabel?: string;         // form variants
  successLabel?: string;        // form variants
  cta?: { label: string; href: string }; // link variant
  gutter?: number;              // min side padding (48 for Category, 22 for About/Membership)
}

/**
 * The red CTA band — one component, three layouts on a shared 1320px column:
 *  - `split`    Category newsletter (heading left, inline email right)
 *  - `centered` Membership join (centered heading + email → "WELCOME ✓")
 *  - `link`     About join (centered copy + a dark pill link to /membership)
 * Dark in both themes; the email variants flip their label on submit (demo only).
 */
export function CtaBand({
  variant,
  eyebrow,
  heading,
  sub,
  placeholder = "you@email.com",
  buttonLabel = "SUBSCRIBE",
  successLabel = "SUBSCRIBED ✓",
  cta,
  gutter = 48,
}: Props) {
  const [done, setDone] = useState(false);

  const emailForm = (centered: boolean) => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setDone(true);
      }}
      className={clsx("flex flex-wrap gap-[10px]", centered ? "mx-auto mt-[30px] max-w-[460px] justify-center" : "min-w-0 max-w-[440px] flex-1")}
    >
      <input
        type="email"
        required
        aria-label="Email address"
        placeholder={placeholder}
        className="min-w-0 flex-1 border border-white/40 bg-white/[0.12] px-[22px] py-[15px] font-grotesk text-[14px] text-white outline-none placeholder:text-white/60"
      />
      <button type="submit" className="bg-[#0d0d0d] px-[26px] py-[15px] font-mono text-[10px] uppercase tracking-[0.2em] text-white transition-[filter] hover:brightness-110">
        {done ? successLabel : buttonLabel}
      </button>
    </form>
  );

  return (
    <section data-darkband className="pt-20 pb-24" style={{ paddingInline: `max(${gutter}px, calc((100% - 1320px) / 2))` }}>
      <div
        className={clsx(
          "overflow-hidden bg-mg-accent px-6 text-white sm:px-[48px]",
          variant === "split" ? "py-[56px]" : "py-[64px] text-center"
        )}
      >
        {variant === "split" ? (
          <div className="flex flex-wrap items-center justify-between gap-[28px]">
            <div className="max-w-[520px]">
              {eyebrow && <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/80">{eyebrow}</div>}
              <h2 className="mt-3 font-grotesk font-semibold text-[26px] min-[681px]:text-[34px] leading-[1.05] tracking-[-0.03em] text-balance">{heading}</h2>
            </div>
            {emailForm(false)}
          </div>
        ) : variant === "centered" ? (
          <>
            <h2 className="mx-auto max-w-[620px] font-grotesk font-semibold text-[30px] min-[681px]:text-[40px] leading-[1.05] tracking-[-0.03em] text-balance">{heading}</h2>
            {emailForm(true)}
          </>
        ) : (
          <>
            {eyebrow && <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/80">{eyebrow}</div>}
            <h2 className="mx-auto mt-[14px] max-w-[640px] font-grotesk font-semibold text-[30px] min-[681px]:text-[40px] leading-[1.05] tracking-[-0.03em] text-balance">{heading}</h2>
            {sub && <p className="mx-auto mb-[30px] mt-[18px] max-w-[480px] font-grotesk font-light text-[16px] leading-[1.6] text-white/80">{sub}</p>}
            {cta && (
              <Link href={cta.href} className="inline-block bg-[#0d0d0d] px-[34px] py-[15px] font-mono text-[10px] uppercase tracking-[0.2em] text-white transition-transform hover:-translate-y-0.5">
                {cta.label}
              </Link>
            )}
          </>
        )}
      </div>
    </section>
  );
}
