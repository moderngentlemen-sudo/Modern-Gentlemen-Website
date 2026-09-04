"use client";

import { SIGNUP_MESSAGE, useNewsletterSignup } from "../ui/useNewsletterSignup";
import styles from "./SectionStudies.module.css";

/** Reuses the real newsletter boundary, including loading, error and confirmed-response states. */
export function StudySignup({ buttonLabel = "Subscribe" }: { buttonLabel?: string }) {
  const { email, setEmail, state, submit } = useNewsletterSignup("newsletter");
  return (
    <div className={styles.signup}>
      {state === "done" ? (
        <p role="status">{SIGNUP_MESSAGE.done}</p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label>
            Email address
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <button type="submit" disabled={state === "submitting"}>
            {state === "submitting" ? "Submitting…" : buttonLabel}
          </button>
        </form>
      )}
      {(state === "invalid" || state === "error" || state === "throttled") && (
        <p role="alert">{SIGNUP_MESSAGE[state]}</p>
      )}
    </div>
  );
}
