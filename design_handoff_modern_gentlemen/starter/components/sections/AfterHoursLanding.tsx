"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import {
  AFTER_HOURS_DEFAULTS as defaults,
  countdownParts,
  safeAfterHoursColor,
  type AfterHoursConfig,
} from "@/lib/blocks/afterHours";
import { studyHref } from "@/lib/blocks/sectionStudies";
import { MediaImage } from "../ui/MediaImage";
import { SIGNUP_MESSAGE, useNewsletterSignup } from "../ui/useNewsletterSignup";
import styles from "./AfterHoursLanding.module.css";

const fonts: Record<string, string> = {
  serif: "var(--font-editorial), Georgia, serif",
  sans: "var(--font-heading), Arial, sans-serif",
  mono: "var(--font-label), monospace",
  navigation: 'Futura, "Century Gothic", sans-serif',
};
const family = (key: string) => fonts[key] ?? fonts.serif;
type SocialLink = { network: string; label: string; href: string };
export interface AfterHoursProps {
  title?: string;
  intro?: string;
  eyebrow?: string;
  image?: string;
  imageAlt?: string;
  showSignup?: boolean;
  config?: AfterHoursConfig;
  socialLinks?: SocialLink[];
}
export function AfterHoursLanding({
  title = "Coming soon",
  intro,
  eyebrow,
  image,
  imageAlt = "",
  showSignup = false,
  config = {},
  socialLinks = [],
}: AfterHoursProps) {
  const layout = { ...defaults.layout, ...config.layout };
  const background = { ...defaults.background, ...config.background };
  const logo = { ...defaults.logo, ...config.logo };
  const type = { ...defaults.type, ...config.type };
  const divider = { ...defaults.divider, ...config.divider };
  const countdown = { ...defaults.countdown, ...config.countdown };
  const signup = { ...defaults.signup, ...config.signup };
  const social = { ...defaults.social, ...config.social };
  const about = { ...defaults.about, ...config.about };
  const [aboutOpen, setAboutOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (aboutOpen && about.show && element && !element.open) element.showModal();
    else if (element?.open) element.close();
  }, [aboutOpen, about.show]);
  const color = safeAfterHoursColor(type.color, defaults.type.color);
  const vars = {
    "--ah-color": color,
    "--ah-bg": safeAfterHoursColor(background.color, defaults.background.color),
    "--ah-overlay": background.overlay / 100,
    "--ah-gray": `${background.grayscale}%`,
    "--ah-focal": `${background.focalX}% ${background.focalY}%`,
    "--ah-mobile-focal": `${background.mobileFocalX}% ${background.mobileFocalY}%`,
    "--ah-width": `${layout.width}px`,
    "--ah-padding": `${layout.padding}px`,
    "--ah-mobile-padding": `${layout.mobilePadding}px`,
    "--ah-bottom": `${layout.bottom}px`,
    "--ah-mobile-bottom": `${layout.mobileBottom}px`,
    "--ah-gap": `${layout.gap}px`,
    "--ah-height": `${layout.minHeight}svh`,
    "--ah-logo": `${logo.width}px`,
    "--ah-mobile-logo": `${logo.mobileWidth}px`,
    "--ah-heading": `${type.headingSize}px`,
    "--ah-mobile-heading": `${type.mobileHeadingSize}px`,
    "--ah-heading-font": family(type.headingFont),
    "--ah-heading-weight": type.headingWeight,
    "--ah-tracking": `${type.headingTracking}px`,
    "--ah-body": `${type.textSize}px`,
    "--ah-label-font": family(type.labelFont),
    "--ah-accent": safeAfterHoursColor(divider.color, defaults.divider.color),
    "--ah-divider-width": `${divider.width}px`,
    "--ah-divider-thickness": `${divider.thickness}px`,
    "--ah-count-size": `${countdown.size}px`,
    "--ah-count-mobile": `${countdown.mobileSize}px`,
    "--ah-count-width": `${countdown.width}px`,
    "--ah-count-font": family(countdown.font),
    "--ah-form-width": `${signup.width}px`,
    "--ah-line": `${signup.thickness}px`,
    "--ah-line-color": `color-mix(in srgb, ${color} ${signup.opacity}%, transparent)`,
    "--ah-social-size": `${social.size}px`,
    "--ah-social-gap": `${social.gap}px`,
    "--ah-about-width": `${about.width}px`,
    "--ah-about-bg": safeAfterHoursColor(about.color, defaults.about.color),
  } as CSSProperties;
  const links = socialLinks.filter((link) => studyHref(link.href));
  return (
    <section
      className={styles.page}
      style={vars}
      data-coming-soon="21"
      data-tone="dark"
      data-darkband
      data-after-hours-standalone={layout.standalone}
      data-align={layout.align}
      data-position={layout.position}
    >
      {image && (
        <div className={styles.background}>
          <MediaImage
            src={image}
            alt={imageAlt}
            slot="fullBleed"
            priority
            className={styles.photo}
          />
        </div>
      )}
      <div className={styles.scrim} />
      <header className={styles.header}>
        {logo.show &&
          logo.image &&
          (studyHref(logo.href) ? (
            <a href={studyHref(logo.href)} className={styles.logo}>
              <MediaImage src={logo.image} alt={logo.alt} slot="quarter" />
            </a>
          ) : (
            <span className={styles.logo}>
              <MediaImage src={logo.image} alt={logo.alt} slot="quarter" />
            </span>
          ))}
        {about.show && (
          <button
            type="button"
            className={styles.aboutButton}
            aria-haspopup="dialog"
            aria-expanded={aboutOpen}
            onClick={() => setAboutOpen(true)}
          >
            {about.label}
          </button>
        )}
      </header>
      <div className={styles.content}>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1>{title}</h1>
        {intro && <p className={styles.intro}>{intro}</p>}
        {divider.show && <div className={styles.divider} aria-hidden="true" />}
        {countdown.show && <AfterHoursCountdown settings={countdown} />}
        {showSignup && <AfterHoursSignup settings={signup} />}
        {social.show && links.length > 0 && (
          <nav
            aria-label="Social media"
            className={styles.social}
            data-separators={social.separators}
          >
            {links.map((link, index) => (
              <a
                key={`${link.network}-${index}`}
                href={studyHref(link.href)}
                aria-label={link.label || link.network}
              >
                {social.style !== "text" && <SocialIcon network={link.network} />}
                {(social.style !== "icons" ||
                  !["instagram", "linkedin", "x", "youtube"].includes(link.network)) && (
                  <span>{link.label || link.network}</span>
                )}
              </a>
            ))}
          </nav>
        )}
      </div>
      {about.show && (
        <dialog
          ref={dialog}
          className={styles.dialog}
          aria-labelledby={headingId}
          onClose={() => setAboutOpen(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              const r = event.currentTarget.getBoundingClientRect();
              if (
                event.clientX < r.left ||
                event.clientX > r.right ||
                event.clientY < r.top ||
                event.clientY > r.bottom
              )
                event.currentTarget.close();
            }
          }}
        >
          <button
            type="button"
            className={styles.close}
            aria-label={about.closeLabel}
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
          <h2 id={headingId}>{about.title}</h2>
          <p>{about.text}</p>
        </dialog>
      )}
    </section>
  );
}
export function AfterHoursCountdown({ settings }: { settings: typeof defaults.countdown }) {
  // Stable SSR/first client tree; real time starts after hydration. No fake launch timer.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!settings.show || !countdownParts(settings.target, Date.now())) return;
    const tick = () => setNow(Date.now());
    tick();
    if (Date.parse(settings.target) <= Date.now()) return;
    const timer = window.setInterval(() => {
      tick();
      if (Date.parse(settings.target) <= Date.now()) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [settings.target, settings.seconds, settings.show]);
  const parts = now === null ? null : countdownParts(settings.target, now);
  if (!parts) return null;
  if (parts.every((value) => value === 0)) {
    if (settings.expired === "hide") return null;
    if (settings.expired === "message")
      return settings.message ? <p role="status">{settings.message}</p> : null;
  }
  const labels = [settings.days, settings.hours, settings.minutes, settings.secondsLabel];
  return (
    <div
      role="timer"
      aria-label="Time until launch"
      aria-live="off"
      className={styles.countdown}
      data-separators={settings.separators}
    >
      {parts.slice(0, settings.seconds ? 4 : 3).map((value, index) => (
        <div key={index}>
          <span className={styles.numeral}>{String(value).padStart(index === 0 ? 3 : 2, "0")}</span>
          <span className={styles.unit}>{labels[index]}</span>
        </div>
      ))}
    </div>
  );
}
function AfterHoursSignup({ settings }: { settings: typeof defaults.signup }) {
  const { email, setEmail, state, submit } = useNewsletterSignup("newsletter");
  const id = useId();
  return (
    <div className={styles.signup}>
      {state === "done" ? (
        <p role="status">{SIGNUP_MESSAGE.done}</p>
      ) : (
        <form
          data-treatment={settings.style}
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          aria-busy={state === "submitting"}
        >
          <label htmlFor={id} className={styles.srOnly}>
            {settings.accessibleLabel}
          </label>
          <input
            id={id}
            type="email"
            autoComplete="email"
            required
            placeholder={settings.placeholder}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button
            type="submit"
            disabled={state === "submitting"}
            aria-label={state === "submitting" ? "Submitting…" : settings.submitLabel}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={settings.arrowWidth}
              aria-hidden="true"
            >
              <path d="M3 12h17m-6-6 6 6-6 6" />
            </svg>
          </button>
        </form>
      )}
      {settings.privacy && <p className={styles.privacy}>{settings.privacy}</p>}
      {(state === "error" || state === "throttled" || state === "invalid") && (
        <p role="alert">{SIGNUP_MESSAGE[state]}</p>
      )}
    </div>
  );
}
export function SocialIcon({ network }: { network: string }) {
  if (network === "instagram")
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    );
  if (network === "linkedin")
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0 0-5ZM3 9.5h4v11H3v-11Zm6.5 0h3.83v1.5h.05c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.78 2.5 4.78 5.75v5.7h-4v-5.05c0-1.2-.02-2.75-1.7-2.75-1.7 0-1.96 1.31-1.96 2.66v5.14h-4v-11Z" />
      </svg>
    );
  if (network === "x")
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.21-6.82-5.96 6.82H1.68l7.73-8.84L1.25 2.25h6.82l4.71 6.23 5.46-6.23Zm-1.16 17.52h1.83L7.02 4.13H5.05l12.03 15.64Z" />
      </svg>
    );
  if (network === "youtube")
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
        <path d="m10 9 5 3-5 3Z" fill="currentColor" />
      </svg>
    );
  return null;
}
