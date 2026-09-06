"use client";
import { useEffect, useId, useState, type CSSProperties } from "react";
import { countdownParts } from "@/lib/blocks/afterHours";
import { studyHref } from "@/lib/blocks/sectionStudies";
import { SIGNUP_MESSAGE, useNewsletterSignup } from "../ui/useNewsletterSignup";
import { SocialIcon } from "./AfterHoursLanding";
import styles from "./WidgetStudio.module.css";
type Item = { title: string; text?: string; href?: string; network?: string };
interface Props {
  previewDevice?: "desktop" | "tablet" | "mobile";
  variant?: string;
  title?: string;
  text?: string;
  align?: string;
  treatment?: string;
  padding?: number;
  size?: number;
  mobileSize?: number;
  divider?: boolean;
  target?: string;
  seconds?: boolean;
  expired?: string;
  placeholder?: string;
  buttonLabel?: string;
  value?: string;
  progress?: number;
  attribution?: string;
  items?: Item[];
}
export function WidgetStudio({
  previewDevice,
  variant = "countdown",
  title,
  text,
  align = "center",
  treatment = "transparent",
  padding = 24,
  size = 48,
  mobileSize = 32,
  divider = true,
  target = "",
  seconds = true,
  expired,
  placeholder = "Your email address",
  buttonLabel = "Subscribe",
  value,
  progress = 0,
  attribution,
  items = [],
}: Props) {
  const [now, setNow] = useState<number | null>(null),
    [tab, setTab] = useState(0);
  const id = useId();
  const signup = useNewsletterSignup("newsletter");
  useEffect(() => {
    if (variant !== "countdown" || !countdownParts(target, Date.now())) return;
    setNow(Date.now());
    const timer = setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (Date.parse(target) <= time) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [variant, target]);
  const parts = now === null ? null : countdownParts(target, now);
  const active = Math.min(tab, Math.max(0, items.length - 1));
  const count = Math.max(0, Math.min(100, progress));
  return (
    <section
      data-widget-preview={previewDevice}
      className={[
        styles.widget,
        treatment === "dark" ? styles.dark : treatment === "paper" ? styles.paper : "",
      ].join(" ")}
      style={
        {
          "--widget-justify":
            align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center",
          "--widget-margin-left": align === "left" ? "0" : "auto",
          "--widget-margin-right": align === "right" ? "0" : "auto",
          "--widget-padding": `${padding}px`,
          "--widget-size": `${size}px`,
          "--widget-mobile-size": `${mobileSize}px`,
          "--widget-align": ["left", "center", "right"].includes(align) ? align : "center",
        } as CSSProperties
      }
    >
      {title && <h2 className={styles.title}>{title}</h2>}
      {variant === "countdown" &&
        parts &&
        (Date.parse(target) <= now! ? (
          expired ? (
            <p className={styles.display}>{expired}</p>
          ) : null
        ) : (
          <div className={styles.timer} role="timer" aria-label="Time until launch">
            {parts.slice(0, seconds ? 4 : 3).map((n, index) => (
              <div key={index} className={styles.unit}>
                <span className={styles.display}>{String(n).padStart(2, "0")}</span>
                <small>{["Days", "Hours", "Minutes", "Seconds"][index]}</small>
              </div>
            ))}
          </div>
        ))}
      {variant === "newsletter" && (
        <>
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              void signup.submit();
            }}
          >
            <label htmlFor={`${id}-email`} className="sr-only">
              Email address
            </label>
            <input
              id={`${id}-email`}
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              placeholder={placeholder}
              value={signup.email}
              onChange={(e) => signup.setEmail(e.target.value)}
              disabled={signup.state === "submitting" || signup.state === "done"}
            />
            <button
              type="submit"
              aria-label={buttonLabel}
              disabled={signup.state === "submitting" || signup.state === "done"}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                aria-hidden="true"
              >
                <path d="M3 12h17m-6-6 6 6-6 6" />
              </svg>
            </button>
          </form>
          <p role="status" className={styles.body}>
            {signup.state === "submitting"
              ? "Submitting…"
              : signup.state !== "idle"
                ? SIGNUP_MESSAGE[signup.state]
                : ""}
          </p>
        </>
      )}
      {variant === "social" && (
        <nav aria-label={title || "Social links"} className={styles.links}>
          {items
            .filter((item) => item.href && studyHref(item.href))
            .map((item, i) => (
              <a key={i} href={studyHref(item.href!)} aria-label={item.title}>
                {item.network && item.network !== "text" ? (
                  <span className="inline-block h-6 w-6">
                    <SocialIcon network={item.network} />
                  </span>
                ) : (
                  item.title
                )}
              </a>
            ))}
        </nav>
      )}
      {variant === "accordion" &&
        items.map((item, i) => (
          <details key={i} className={styles.details}>
            <summary>{item.title}</summary>
            <p className={styles.body}>{item.text}</p>
          </details>
        ))}
      {variant === "tabs" && items.length > 0 && (
        <>
          <div role="tablist" aria-label={title || "Content panels"} className={styles.tabs}>
            {items.map((item, i) => (
              <button
                key={i}
                id={`${id}-tab-${i}`}
                role="tab"
                aria-selected={active === i}
                aria-controls={`${id}-panel-${i}`}
                tabIndex={active === i ? 0 : -1}
                onClick={() => setTab(i)}
                onKeyDown={(e) => {
                  let next = i;
                  if (e.key === "ArrowRight") next = (i + 1) % items.length;
                  else if (e.key === "ArrowLeft") next = (i + items.length - 1) % items.length;
                  else if (e.key === "Home") next = 0;
                  else if (e.key === "End") next = items.length - 1;
                  else return;
                  e.preventDefault();
                  setTab(next);
                  document.getElementById(`${id}-tab-${next}`)?.focus();
                }}
              >
                {item.title}
              </button>
            ))}
          </div>
          {items.map((item, i) => (
            <div
              key={i}
              id={`${id}-panel-${i}`}
              role="tabpanel"
              aria-labelledby={`${id}-tab-${i}`}
              tabIndex={0}
              hidden={active !== i}
              className={styles.body}
            >
              {item.text}
            </div>
          ))}
        </>
      )}
      {variant === "stat" && <p className={styles.display}>{value}</p>}
      {variant === "progress" && (
        <>
          <p className={styles.display}>{count}%</p>
          <progress aria-label={title || "Progress"} value={count} max={100} />
        </>
      )}
      {variant === "quote" && (
        <blockquote>
          <p className={styles.display}>{text}</p>
          {attribution && <footer className={styles.body}>{attribution}</footer>}
        </blockquote>
      )}
      {divider && <div className={styles.divider} aria-hidden="true" />}
      {text && variant !== "quote" && <p className={styles.body}>{text}</p>}
    </section>
  );
}
