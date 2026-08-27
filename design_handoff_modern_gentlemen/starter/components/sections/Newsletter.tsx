"use client";

import { Eyebrow } from "../ui/Eyebrow";
import { SIGNUP_MESSAGE, useNewsletterSignup } from "../ui/useNewsletterSignup";

interface Props {
  heading: string;
  eyebrow?: string;
  sub?: string;
  buttonLabel?: string;
  placeholder?: string;
}

/**
 * Centered email-capture band ("The Debrief").
 *
 * ⚠️ **This used to be demo only, and it did not say so where it mattered.** The
 * submit handler was `if (email) setDone(true)` — the address was read into
 * state and thrown away, and the band then rendered "Thanks — you're on the
 * list." on the live homepage. It POSTs to `/api/newsletter` now, and the
 * success copy no longer claims a subscription nothing has confirmed.
 */
export function Newsletter({
  heading,
  eyebrow,
  sub,
  buttonLabel = "Subscribe",
  placeholder = "your@address.com",
}: Props) {
  const { email, setEmail, state, submit } = useNewsletterSignup("newsletter");
  const done = state === "done";

  return (
    <section className="container-mg pt-6 pb-[88px] text-center">
      {eyebrow && (
        <Eyebrow className="block !text-[22px] !leading-[normal] mb-2 !text-mg-muted">
          {eyebrow}
        </Eyebrow>
      )}
      <h2 className="font-grotesk font-semibold text-3xl leading-[1.05] min-[681px]:text-[42px] min-[681px]:leading-none tracking-[-0.035em]">
        {heading}
      </h2>
      {done ? (
        <p className="mt-8 font-mono text-sm text-mg-accentInk" role="status">
          {SIGNUP_MESSAGE.done}
        </p>
      ) : (
        <form
          className="mt-[26px] mx-auto flex w-[520px] max-w-full bg-mg-surface border border-mg-bd/[0.09] overflow-hidden"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={placeholder}
            aria-label="Email address"
            className="flex-1 min-w-0 bg-transparent px-6 py-4 font-mono text-[13px] leading-[normal] outline-none placeholder:text-mg-fg/60"
          />
          <button
            type="submit"
            disabled={state === "submitting"}
            className="shrink-0 bg-mg-accent text-white px-[26px] py-4 font-mono uppercase text-[12px] leading-[normal] tracking-[0.18em] transition-colors hover:bg-mg-fg hover:text-mg-bg disabled:opacity-70"
          >
            {buttonLabel}
          </button>
        </form>
      )}

      {(state === "invalid" || state === "error") && (
        // `role="alert"` rather than `status`: this interrupts, because the
        // visitor believes they have just subscribed and they have not.
        <p className="mt-3 font-mono text-xs text-mg-accentInk" role="alert">
          {SIGNUP_MESSAGE[state]}
        </p>
      )}
      {sub && (
        <p className="mx-auto mt-4 max-w-[420px] font-light text-xs leading-[1.6] text-mg-faint">
          {sub}
        </p>
      )}
    </section>
  );
}
