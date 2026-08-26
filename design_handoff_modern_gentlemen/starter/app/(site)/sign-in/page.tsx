import type { Metadata } from "next";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = {
  title: "Sign in — Modern Gentlemen",
  robots: { index: false, follow: false },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6 py-24">
      <div className="w-full max-w-[420px]">
        <p className="font-serif text-lg italic text-mg-fg/60">Modern Gentlemen</p>
        <h1 className="mt-1 font-grotesk text-[34px] font-semibold leading-none tracking-[-0.03em]">
          Sign in
        </h1>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.15em] text-mg-fg/60">
          Editorial &amp; commerce admin
        </p>

        <div className="mt-9">
          <SignInForm next={next} />
        </div>
      </div>
    </main>
  );
}
