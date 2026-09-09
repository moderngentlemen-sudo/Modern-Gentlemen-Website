"use client";

import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import { libraryFontStack } from "@/lib/domain/fontLibrary";
import {
  countdownParts,
  countdownUnits,
  socialDestination,
  type CountdownWidget,
  type SignupWidget,
  type SocialWidget,
  type WidgetTypography,
  type StudioWidgetKind,
} from "@/lib/blocks/studioWidgets";
import { studioThemeColor as studioColor, studioThemeInk } from "@/lib/blocks/studioTheme";
import { FontStylesheet } from "../ui/FontStylesheet";
import { SIGNUP_MESSAGE, useNewsletterSignup } from "../ui/useNewsletterSignup";
import styles from "./StudioWidgets.module.css";
import { studioPixels } from "@/lib/blocks/studioSizing";

type Props = Record<string, unknown>;
const number = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const text = (value: unknown) => (typeof value === "string" ? value : "");
function measures(_p: Props) {
  return studioPixels;
}
function WidgetIcon({ platform }: { platform: string }) {
  let shape: ReactNode;
  switch (platform) {
    case "Instagram":
      shape = (
        <>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r=".7" fill="currentColor" />
        </>
      );
      break;
    case "LinkedIn":
      shape = (
        <>
          <rect x="3" y="9" width="4" height="12" />
          <circle cx="5" cy="4" r="2" />
          <path d="M11 21V9h4v2c1-2 6-3 6 3v7h-4v-7c0-2-2-2-2 0v7Z" />
        </>
      );
      break;
    case "YouTube":
      shape = (
        <>
          <rect x="2" y="5" width="20" height="14" rx="4" />
          <path d="m10 9 5 3-5 3Z" />
        </>
      );
      break;
    case "Facebook":
      shape = <path d="M15 21v-8h3l1-4h-4V7c0-1 0-2 2-2h2V2h-3c-4 0-5 2-5 5v2H8v4h3v8Z" />;
      break;
    case "Arrow":
      shape = <path d="M4 12h16m-6-6 6 6-6 6" />;
      break;
    default:
      shape = (
        <>
          <path d="m10 13 4-4m-5 6-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" />
        </>
      );
  }
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {shape}
    </svg>
  );
}
function Countdown({ p, settings }: { p: Props; settings: CountdownWidget }) {
  // Identical server/client first render. The visitor's clock starts after hydration.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const end = Date.parse(settings.target);
    setNow(Date.now());
    if (!Number.isFinite(end) || Date.now() >= end) return;
    const timer = setInterval(() => {
      const next = Date.now();
      setNow(next);
      if (next >= end) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [settings.target]);
  const unit = measures(p),
    units = countdownUnits(settings);
  const remaining = now === null ? null : countdownParts(settings.target, now, settings.unitMode);
  const ns = settings.numberStyle || {},
    ls = settings.labelStyle || {};
  const typography = (
    style: WidgetTypography,
    fallbackFont: string,
    fallbackColor: string
  ): CSSProperties => ({
    fontFamily: libraryFontStack(style.font || fallbackFont),
    fontWeight: style.weight ?? 400,
    color: studioThemeInk(style.color || fallbackColor),
    letterSpacing: unit(style.tracking ?? 0),
    lineHeight: style.leading ?? 1.1,
    textAlign: style.align || "center",
    fontStyle: style.italic ? "italic" : "normal",
    textDecoration: style.underline ? "underline" : "none",
  });
  return (
    <>
      <FontStylesheet font={ns.font} />
      <FontStylesheet font={ls.font || "IBM Plex Mono"} />
      {remaining?.expired ? (
        <div className={styles.ended} role="status">
          {settings.endText || "The next chapter is here."}
        </div>
      ) : (
        <div
          className={styles.countdown}
          role="timer"
          aria-label="Time remaining"
          aria-live="off"
          style={{ gridTemplateColumns: `repeat(${units.length}, minmax(0, 1fr))` }}
        >
          {units.map((name, index) => {
            const digits = remaining ? String(remaining[name]).padStart(2, "0") : "—";
            const size = Math.min(
              ns.size ?? number(p.size, 52),
              Math.max(
                14,
                (number(p.w, 650) - 12 * (units.length - 1)) /
                  units.length /
                  (Math.max(2, digits.length) * 0.65)
              )
            );
            const border = `${unit(1)} solid ${studioThemeInk(p.borderColor) || studioThemeInk("#14141455")}`;
            return (
              <div
                key={name}
                className={styles.clockUnit}
                style={
                  settings.variant === "Cards"
                    ? {
                        border,
                        background: studioColor(p.fill),
                        borderRadius: unit(number(p.radius, 0) || 4),
                      }
                    : settings.variant === "Divided" && index
                      ? { borderLeft: border }
                      : undefined
                }
              >
                <span
                  data-clock-unit={name}
                  className={styles.clockNumber}
                  style={{
                    ...typography(
                      { ...ns, weight: ns.weight ?? number(p.weight, 400) },
                      text(p.fontFamily),
                      text(p.color)
                    ),
                    fontSize: unit(size),
                  }}
                >
                  {digits}
                </span>
                <span
                  className={ls.visible === false ? styles.srOnly : styles.clockLabel}
                  style={
                    ls.visible === false
                      ? undefined
                      : {
                          ...typography(
                            { ...ls, tracking: ls.tracking ?? 0.6, leading: ls.leading ?? 1.3 },
                            "IBM Plex Mono",
                            text(p.color)
                          ),
                          fontSize: unit(ls.size ?? 11),
                          marginTop: unit(ls.gap ?? 8),
                          textTransform: ls.case || "none",
                        }
                  }
                >
                  {settings.labels?.[name] ?? name}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
function Signup({ p, settings }: { p: Props; settings: SignupWidget }) {
  const unit = measures(p),
    messageId = useId();
  const { email, setEmail, state, submit } = useNewsletterSignup("newsletter");
  const error = state === "invalid" || state === "throttled" || state === "error";
  const line = studioThemeInk(p.borderColor) || studioThemeInk(p.color) || "currentColor";
  return (
    <>
      {state !== "done" && (
        <form
          aria-label="Email signup"
          aria-busy={state === "submitting"}
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div
            className={styles.signupRow}
            style={
              settings.variant === "Boxed"
                ? {
                    border: `${unit(1)} solid ${line}`,
                    background: studioColor(p.fill),
                    borderRadius: unit(number(p.radius, 0)),
                    padding: `0 ${unit(14)}`,
                  }
                : { borderColor: line }
            }
          >
            <input
              type="email"
              name="email"
              required
              maxLength={254}
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Email address"
              aria-invalid={state === "invalid"}
              aria-describedby={error ? messageId : undefined}
              placeholder={settings.placeholder || "Your email address"}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={state === "submitting"}
            />
            <button
              type="submit"
              aria-label={text(p.text) || "Join the list"}
              disabled={state === "submitting"}
            >
              {settings.buttonMode === "Label" ? (
                text(p.text) || "Join the list"
              ) : (
                <WidgetIcon platform="Arrow" />
              )}
            </button>
          </div>
        </form>
      )}
      {state === "done" && (
        <p className={styles.signupMessage} role="status">
          {settings.successText || SIGNUP_MESSAGE.done}
        </p>
      )}
      {error && (
        <p id={messageId} className={styles.signupMessage} role="alert">
          {SIGNUP_MESSAGE[state]}
        </p>
      )}
    </>
  );
}
function Social({ p, settings }: { p: Props; settings: SocialWidget }) {
  const unit = measures(p);
  return (
    <nav
      aria-label={text(p.text) || "Social links"}
      className={styles.social}
      style={{
        justifyContent:
          p.align === "center" ? "center" : p.align === "right" ? "flex-end" : "flex-start",
      }}
    >
      {settings.links.map((link, index) => {
        const href = socialDestination(link.url);
        if (!href) return null; // Defense in depth for callers outside the Studio converter.
        return (
          <a
            key={index}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${link.label || link.platform} (opens in a new tab)`}
            className={styles.socialLink}
            style={
              settings.variant === "Outlined"
                ? {
                    border: `${unit(1)} solid ${studioThemeInk(p.borderColor) || studioThemeInk(p.color) || "currentColor"}`,
                    background: studioColor(p.fill),
                    padding: `${unit(10)} ${unit(12)}`,
                    borderRadius: unit(number(p.radius, 0)),
                  }
                : undefined
            }
          >
            {(settings.variant === "Icons" || settings.variant === "Outlined") && (
              <WidgetIcon platform={link.platform} />
            )}
            {settings.variant !== "Icons" && (link.label || link.platform)}
          </a>
        );
      })}
    </nav>
  );
}
export function StudioWidget(p: Props & { kind: StudioWidgetKind }) {
  const config = p[p.kind];
  if (!config || typeof config !== "object") return null;
  const unit = measures(p);
  return (
    <div
      className={styles.content}
      data-studio-widget={p.kind}
      style={{ "--studio-px": unit(1) } as CSSProperties}
    >
      {p.kind !== "signup" && !!p.text && <div className={styles.caption}>{text(p.text)}</div>}
      {p.kind === "countdown" && <Countdown p={p} settings={config as CountdownWidget} />}
      {p.kind === "signup" && <Signup p={p} settings={config as SignupWidget} />}
      {p.kind === "social" && <Social p={p} settings={config as SocialWidget} />}
    </div>
  );
}
