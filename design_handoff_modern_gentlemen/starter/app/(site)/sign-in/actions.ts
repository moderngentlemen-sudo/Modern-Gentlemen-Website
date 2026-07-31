"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/db/server";

const SignInInput = z.object({
  email: z.string().trim().min(1, "Enter your email").email("That does not look like an email"),
  password: z.string().min(1, "Enter your password"),
  // Only same-origin paths are accepted, so `next` cannot be used as an open redirect.
  next: z
    .string()
    .optional()
    .transform((v) => (v && v.startsWith("/") && !v.startsWith("//") ? v : "/admin")),
});

export interface SignInState {
  error?: string;
  fieldErrors?: { email?: string; password?: string };
}

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = SignInInput.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return {
      fieldErrors: { email: flat.email?.[0], password: flat.password?.[0] },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Deliberately not distinguishing "no such account" from "wrong password" —
    // that difference is an account-enumeration oracle.
    return { error: "Those credentials were not recognised." };
  }

  redirect(parsed.data.next);
}
