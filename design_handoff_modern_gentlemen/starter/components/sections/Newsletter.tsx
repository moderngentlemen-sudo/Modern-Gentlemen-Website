"use client";

import { useState } from "react";
import { Button } from "../ui/Button";

interface Props {
  heading: string;
  sub?: string;
  buttonLabel?: string;
  placeholder?: string;
}

export function Newsletter({ heading, sub, buttonLabel = "Subscribe", placeholder = "Your email address" }: Props) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  return (
    <section className="container-mg py-16 md:py-24">
      <div className="max-w-2xl">
        <h2 className="font-grotesk font-semibold text-3xl md:text-4xl text-balance">{heading}</h2>
        {sub && <p className="mt-4 text-mg-fg/70 text-pretty">{sub}</p>}
        {done ? (
          <p className="mt-8 font-mono text-sm text-mg-accent">Thanks — you&apos;re on the list.</p>
        ) : (
          <form
            className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md"
            onSubmit={(e) => {
              e.preventDefault();
              // TODO: POST to your ESP (Klaviyo/Mailchimp) via a route handler.
              if (email) setDone(true);
            }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={placeholder}
              className="flex-1 bg-transparent border border-mg-bd/40 px-4 py-3 font-mono text-sm outline-none focus:border-mg-accent"
            />
            <Button type="submit">{buttonLabel}</Button>
          </form>
        )}
      </div>
    </section>
  );
}
