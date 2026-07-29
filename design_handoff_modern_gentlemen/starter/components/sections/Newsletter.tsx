"use client";

import { useState } from "react";
import { Eyebrow } from "../ui/Eyebrow";

interface Props {
  heading: string;
  eyebrow?: string;
  sub?: string;
  buttonLabel?: string;
  placeholder?: string;
}

/** Centered email-capture band ("The Debrief"). Demo only — no network POST
 *  yet (Track B wires an ESP / Supabase capture behind a route handler). */
export function Newsletter({ heading, eyebrow, sub, buttonLabel = "Subscribe", placeholder = "your@address.com" }: Props) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  return (
    <section className="container-mg py-16 md:py-24 text-center">
      {eyebrow && <Eyebrow className="block text-xl md:text-2xl">{eyebrow}</Eyebrow>}
      <h2 className="mt-3 font-grotesk font-semibold text-3xl md:text-[42px] text-balance">{heading}</h2>
      {done ? (
        <p className="mt-8 font-mono text-sm text-mg-accent">Thanks — you&apos;re on the list.</p>
      ) : (
        <form
          className="mt-8 mx-auto flex flex-col sm:flex-row max-w-[520px] border border-mg-bd/25"
          onSubmit={(e) => {
            e.preventDefault();
            // TODO (Track B): POST to the ESP / Supabase capture via a route handler.
            if (email) setDone(true);
          }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={placeholder}
            aria-label="Email address"
            className="w-full sm:flex-1 sm:min-w-0 bg-transparent px-5 py-4 font-mono text-sm outline-none placeholder:text-mg-fg/40"
          />
          <button type="submit" className="bg-mg-accent text-white px-7 py-3.5 sm:py-0 font-mono uppercase text-xs tracking-[0.15em] transition-colors hover:bg-mg-fg hover:text-mg-bg">
            {buttonLabel}
          </button>
        </form>
      )}
      {sub && <p className="mx-auto mt-4 max-w-[420px] font-mono text-[11px] text-mg-fg/50">{sub}</p>}
    </section>
  );
}
