"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Field } from "@/components/store/Field";
import { signIn, type SignInState } from "./actions";

/**
 * Sign-in form. Deliberately built from the existing site primitives —
 * `Field` already carries the mono uppercase label and the `data-invalid` red
 * border treatment, so this introduces no new form language (see §4.1).
 */
export function SignInForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<SignInState, FormData>(signIn, {});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}

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

      <Field
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        error={state.fieldErrors?.password}
      />
      <input type="hidden" name="password" value={password} />

      {state.error && (
        <p
          role="alert"
          data-testid="sign-in-error"
          className="border border-mg-accentSerif/40 bg-mg-accent/5 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-mg-accentSerif"
        >
          {state.error}
        </p>
      )}

      <SubmitButton />

      <Link
        href="/forgot-password"
        className="font-mono text-[11px] uppercase tracking-[0.15em] text-mg-fg/60 underline underline-offset-4 hover:text-mg-accentInk"
      >
        Forgot your password?
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
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}
