"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Field } from "@/components/store/Field";
import { requestPasswordReset, type ForgotPasswordState } from "./actions";

/**
 * Built from the same primitives as `SignInForm` — `Field` carries the mono
 * uppercase label and the `data-invalid` red border, so this introduces no new
 * form language.
 */
export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<ForgotPasswordState, FormData>(
    requestPasswordReset,
    {}
  );
  const [email, setEmail] = useState("");

  if (state.sent) {
    return (
      <div className="grid gap-5">
        <p
          role="status"
          className="border border-mg-bd/25 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-mg-fg/70"
        >
          If that email has an account, a reset link is on its way.
        </p>
        <p className="text-[13px] leading-relaxed text-mg-fg/60">
          The link signs you in and takes you straight to a page where you can set a new password.
          It expires, and it can only be used once — request another if it goes stale.
        </p>
        <Link
          href="/sign-in"
          className="font-mono text-[11px] uppercase tracking-[0.15em] text-mg-fg/70 underline underline-offset-4 hover:text-mg-accentInk"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <Field
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        error={state.fieldErrors?.email}
      />
      {/* The controlled Field renders no name attribute, so mirror the value
          into a hidden input the server action can read from FormData. */}
      <input type="hidden" name="email" value={email} />

      {state.error && (
        <p
          role="alert"
          className="border border-mg-accentSerif/40 bg-mg-accent/5 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-mg-accentSerif"
        >
          {state.error}
        </p>
      )}

      <SubmitButton />

      <Link
        href="/sign-in"
        className="font-mono text-[11px] uppercase tracking-[0.15em] text-mg-fg/60 underline underline-offset-4 hover:text-mg-accentInk"
      >
        Back to sign in
      </Link>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 inline-flex items-center justify-center bg-mg-accent px-8 py-3 font-mono text-xs uppercase tracking-[0.15em] text-white transition-colors hover:bg-mg-fg hover:text-mg-bg disabled:opacity-60"
    >
      {pending ? "Sending…" : "Send reset link"}
    </button>
  );
}
