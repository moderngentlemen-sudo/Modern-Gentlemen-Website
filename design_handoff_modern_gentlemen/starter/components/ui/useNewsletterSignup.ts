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

export type SignupState = "idle" | "submitting" | "done" | "invalid" | "error";

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

      // 400 is an address we cannot use and the visitor can fix; anything else
      // is ours and they cannot. Different copy for each — an error that blames
      // the reader for our outage is worse than no error.
      setState(response.status === 400 ? "invalid" : "error");
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
      if (state === "invalid" || state === "error") setState("idle");
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
  error: "Something went wrong. Please try again shortly.",
};
