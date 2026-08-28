import type { Metadata } from "next";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset your password — Modern Gentlemen",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6 py-24">
      <div className="w-full max-w-[420px]">
        <p className="font-serif text-lg italic text-mg-fg/60">Modern Gentlemen</p>
        <h1 className="mt-1 font-grotesk text-[34px] font-semibold leading-none tracking-[-0.03em]">
          Reset your password
        </h1>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.15em] text-mg-fg/60">
          We will email you a link
        </p>

        <div className="mt-9">
          <ForgotPasswordForm />
        </div>
      </div>
    </main>
  );
}
