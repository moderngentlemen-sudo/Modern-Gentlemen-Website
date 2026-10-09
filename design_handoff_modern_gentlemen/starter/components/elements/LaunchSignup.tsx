"use client";

import { useId, type CSSProperties } from "react";

import { libraryFontStack } from "@/lib/domain/fontLibrary";
import { FontStylesheet } from "../ui/FontStylesheet";
import { SIGNUP_MESSAGE, useNewsletterSignup } from "../ui/useNewsletterSignup";
import styles from "./LaunchElements.module.css";

const HEX = /^#[0-9a-f]{6}$/i;
const JUSTIFY = { left: "flex-start", center: "center", right: "flex-end" } as const;

/** Joins the site newsletter through the same anonymous endpoint every signup uses. */
export function LaunchSignup({
  buttonLabel = "Notify me",
  placeholder = "Your email address",
  style = "underline",
  color,
  accentColor = "#c8102e",
  align = "center",
  consent,
  accessibleLabel = "Email address",
  font,
}: {
  buttonLabel?: string;
  placeholder?: string;
  style?: "underline" | "boxed" | "pill";
  color?: string;
  accentColor?: string;
  align?: "left" | "center" | "right";
  consent?: string;
  accessibleLabel?: string;
  font?: string;
}) {
  const { email, setEmail, state, submit } = useNewsletterSignup("newsletter");
  const id = useId();
  const vars = {
    ...(color && HEX.test(color) ? { "--su-color": color } : {}),
    "--su-accent": HEX.test(accentColor) ? accentColor : "#c8102e",
    textAlign: align,
    ...(libraryFontStack(font) ? { "--el-font": libraryFontStack(font) } : {}),
  } as CSSProperties;
  return (
    <div className={styles.signup} data-style={style} style={vars}>
      <FontStylesheet font={font} />
      {state === "done" ? (
        <p role="status" className={styles.signupStatus}>
          {SIGNUP_MESSAGE.done}
        </p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          aria-busy={state === "submitting"}
          style={{ justifyContent: JUSTIFY[align] ?? "center" }}
        >
          <label htmlFor={id} className={styles.srOnly}>
            {accessibleLabel || "Email address"}
          </label>
          <input
            id={id}
            type="email"
            autoComplete="email"
            required
            placeholder={placeholder}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button type="submit" disabled={state === "submitting"}>
            {state === "submitting" ? "Submitting…" : buttonLabel}
            {style === "underline" && <span aria-hidden="true"> →</span>}
          </button>
        </form>
      )}
      {(state === "error" || state === "throttled" || state === "invalid") && (
        <p role="alert" className={styles.signupStatus}>
          {SIGNUP_MESSAGE[state]}
        </p>
      )}
      {consent && state !== "done" && <p className={styles.signupNote}>{consent}</p>}
    </div>
  );
}
