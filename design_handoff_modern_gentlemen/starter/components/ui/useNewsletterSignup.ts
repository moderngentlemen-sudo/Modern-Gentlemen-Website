"use client";

import { useState } from "react";
import type { SubscriberSource } from "@/lib/domain/newsletter";

/**
 * The sign-up form's behaviour, shared by both bands.
 *
 * One hook rather than the logic twice, because the two bands drifted apart the
 * last time they were left to themselves: `Newsletter.tsx` at least read the
 * address into state before discarding it, while `CtaBand.tsx`'s input was
 * never controlled at all. Both then claimed success. A shared hook is what
 * stops one of them being fixed and the other quietly not.
 */

export type SignupState = "idle" | "submitting" | "done" | "invalid" | "throttled" | "error";

export function useNewsletterSignup(source: SubscriberSource) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<SignupState>("idle");

  async function submit(): Promise<void> {
    // Guard the double submit rather than only disabling the button: a form
    // still submits on Enter while a pointer-driven `disabled` is being applied.
    if (state === "submitting") return;
    setState("submitting");

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });

      if (response.ok) {
        setState("done");
        setEmail("");
        return;
      }

      // Three answers, because there are three things the visitor can do about
      // them. 400 is an address we cannot use and they can fix; 429 clears by
      // waiting; anything else is ours and they can do nothing. An error that
      // blames the reader for our outage is worse than no error, and one that
      // tells them to fix an address that is fine is worse still.
      if (response.status === 400) setState("invalid");
      else if (response.status === 429) setState("throttled");
      else setState("error");
    } catch {
      // Offline, DNS, a blocked request. Indistinguishable from our own failure
      // from here, and the honest answer to the visitor is the same.
      setState("error");
    }
  }

  return {
    email,
    setEmail: (next: string) => {
      setEmail(next);
      // Clear a previous rejection as soon as they start correcting it, so the
      // message describes what is in the box now rather than what used to be.
      if (state === "invalid" || state === "error" || state === "throttled") setState("idle");
    },
    state,
    submit,
  };
}

/**
 * What to tell the visitor.
 *
 * ⚠️ **"You're on the list" is deliberately gone.** Nothing confirms an address
 * yet, so the only honest success message is that we have it. When double
 * opt-in lands this becomes "check your inbox", and the row moves from
 * `pending` to `confirmed` — see `lib/domain/newsletter.ts`.
 */
export const SIGNUP_MESSAGE: Record<Exclude<SignupState, "idle" | "submitting">, string> = {
  done: "Thanks — we've got your address.",
  invalid: "That address doesn't look right. Try again?",
  // Deliberately vague about how long. The endpoint sends `Retry-After`, but it
  // is the whole window rather than the remainder, so quoting a number here
  // would be quoting one that is usually wrong.
  throttled: "That's a few tries in a row. Give it a few minutes and try again.",
  error: "Something went wrong. Please try again shortly.",
};
