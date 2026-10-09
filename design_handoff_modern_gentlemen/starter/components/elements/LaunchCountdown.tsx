"use client";

import { useEffect, useState, type CSSProperties } from "react";

import { countdownParts } from "@/lib/blocks/afterHours";
import { libraryFontStack } from "@/lib/domain/fontLibrary";
import { clsx } from "@/components/ui/clsx";
import { FontStylesheet } from "../ui/FontStylesheet";
import styles from "./LaunchElements.module.css";

const UNITS = ["days", "hours", "minutes", "seconds"] as const;
type Unit = (typeof UNITS)[number];
const DASH = "––";
const pad = (n: number) => String(n).padStart(2, "0");
const HEX = /^#[0-9a-f]{6}$/i;

export interface LaunchCountdownProps {
  target?: string;
  message?: string;
  style?: "numerals" | "inline" | "grid" | "dial" | "clock" | "single";
  size?: number;
  color?: string;
  accentColor?: string;
  accentUnit?: Unit | "none";
  align?: "left" | "center" | "right";
  font?: string;
  separator?: "colon" | "dot" | "none";
  units?: Partial<Record<Unit, boolean>>;
  labels?: Partial<Record<Unit, string>>;
  labelFont?: string;
  labelSize?: number;
  labelColor?: string;
  unit?: Unit;
  outline?: boolean;
  timeZone?: string;
  tick?: "none" | "fade" | "rise" | "flip";
}

/** Ticks once a second after mount; `null` on the server so SSR shows dashes, never a stale time. */
function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function clockIn(now: number, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hourCycle: "h23",
    }).formatToParts(new Date(now));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    return { h: get("hour"), m: get("minute"), s: get("second") };
  } catch {
    return { h: 10, m: 10, s: 0 };
  }
}

/**
 * A live countdown in six styles. Every value comes from the element's own
 * settings; with no valid launch date it shows dashes rather than inventing one.
 */
export function LaunchCountdown({
  target = "",
  message = "We are open.",
  style = "numerals",
  size = 96,
  color,
  accentColor = "#c8102e",
  accentUnit = "seconds",
  align = "center",
  font = "theme:heading",
  separator = "colon",
  units = {},
  labels = {},
  labelFont = "theme:label",
  labelSize = 10,
  labelColor,
  unit = "seconds",
  outline = true,
  timeZone = "Europe/London",
  tick = "none",
}: LaunchCountdownProps) {
  const now = useNow();
  const parts = now === null ? null : countdownParts(target, now);
  const launched = parts !== null && parts.every((v) => v === 0);
  const values: Record<Unit, string> = Object.fromEntries(
    UNITS.map((u, i) => [u, parts ? pad(parts[i]) : DASH])
  ) as Record<Unit, string>;
  const label = (u: Unit) => labels[u] ?? u[0].toUpperCase() + u.slice(1);
  const shown = UNITS.filter((u) => units[u] !== false);

  const vars = {
    "--cd-size": `${Math.min(600, Math.max(10, size))}px`,
    "--cd-font": libraryFontStack(font) ?? "var(--font-heading)",
    "--cd-label-font": libraryFontStack(labelFont) ?? "var(--font-label)",
    "--cd-label-size": `${Math.min(60, Math.max(6, labelSize))}px`,
    "--cd-accent": HEX.test(accentColor) ? accentColor : "#c8102e",
    ...(color && HEX.test(color) ? { "--cd-color": color } : {}),
    ...(labelColor && HEX.test(labelColor) ? { "--cd-label-color": labelColor } : {}),
  } as CSSProperties;

  const spoken = parts
    ? `${parts[0]} days, ${parts[1]} hours, ${parts[2]} minutes to launch`
    : "Launch countdown";

  let body;
  if (launched && message) {
    body = <p className={styles.message}>{message}</p>;
  } else if (style === "inline") {
    const sep = separator === "colon" ? " : " : separator === "dot" ? " · " : "  ";
    body = (
      <p className={styles.inline}>
        {shown.map((u, i) => (
          <span key={u}>
            {i > 0 && <span aria-hidden="true">{sep}</span>}
            {values[u]} {label(u)}
          </span>
        ))}
      </p>
    );
  } else if (style === "grid") {
    body = (
      <div className={styles.grid}>
        {shown.map((u) => (
          <span key={u} className={clsx(styles.unit, accentUnit === u && styles.accent)}>
            <span key={values[u]} className={styles.num}>
              {values[u]}
            </span>
            <span className={styles.label}>{label(u)}</span>
          </span>
        ))}
      </div>
    );
  } else if (style === "dial" || style === "clock") {
    const seconds = parts ? parts[3] : 0;
    const small = `${values.hours}:${values.minutes}:${values.seconds}`;
    const core = (
      <span className={styles.dialCore}>
        <span className={styles.label} style={{ marginTop: 0 }}>
          {label("days")}
        </span>
        <span key={values.days} className={styles.num}>
          {values.days}
        </span>
        <span className={styles.clockSmall}>{small}</span>
      </span>
    );
    if (style === "dial") {
      const arc = 2 * Math.PI * 46;
      body = (
        <div className={styles.dial}>
          <svg viewBox="0 0 100 100" aria-hidden="true">
            {Array.from({ length: 60 }, (_, i) => (
              <line
                key={i}
                x1="50"
                y1={i % 5 === 0 ? 1 : 2}
                x2="50"
                y2="3.5"
                stroke="currentColor"
                strokeOpacity={0.55}
                strokeWidth={i % 5 === 0 ? 0.6 : 0.3}
                transform={`rotate(${i * 6} 50 50)`}
              />
            ))}
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.25}
              strokeWidth="0.4"
            />
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="var(--cd-accent)"
              strokeWidth="0.8"
              strokeDasharray={`${(arc * (60 - seconds)) / 60} ${arc}`}
              transform="rotate(-90 50 50)"
            />
          </svg>
          {core}
        </div>
      );
    } else {
      const c = now === null ? { h: 10, m: 10, s: 0 } : clockIn(now, timeZone);
      const a = { h: (c.h % 12) * 30 + c.m / 2, m: c.m * 6 + c.s / 10, s: c.s * 6 };
      body = (
        <div className={styles.clock}>
          <span className={styles.hands} aria-hidden="true">
            <span className={styles.h} style={{ transform: `rotate(${a.h - 90}deg)` }} />
            <span className={styles.m} style={{ transform: `rotate(${a.m - 90}deg)` }} />
            <span className={styles.s} style={{ transform: `rotate(${a.s - 90}deg)` }} />
          </span>
          {core}
        </div>
      );
    }
  } else if (style === "single") {
    body = (
      <span className={styles.unit}>
        <span
          key={values[unit]}
          className={styles.single}
          data-outline={outline ? "true" : "false"}
        >
          {values[unit]}
        </span>
        <span className={styles.label}>{label(unit)}</span>
      </span>
    );
  } else {
    body = (
      <div className={styles.row}>
        {shown.map((u, i) => (
          <span key={u} style={{ display: "contents" }}>
            {i > 0 && separator !== "none" && (
              <span className={styles.sep} aria-hidden="true">
                {separator === "colon" ? ":" : "·"}
              </span>
            )}
            <span className={clsx(styles.unit, accentUnit === u && styles.accent)}>
              <span key={values[u]} className={styles.num}>
                {values[u]}
              </span>
              <span className={styles.label}>{label(u)}</span>
            </span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={spoken}
      className={styles.countdown}
      data-align={align}
      data-countdown-style={style}
      data-tick={tick === "fade" || tick === "rise" || tick === "flip" ? tick : undefined}
      style={vars}
    >
      <FontStylesheet font={font} />
      <FontStylesheet font={labelFont} />
      {body}
    </div>
  );
}
