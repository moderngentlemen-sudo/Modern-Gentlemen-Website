"use client";

import { useEffect, useRef, useState } from "react";

import { clsx } from "@/components/ui/clsx";
import styles from "./LaunchElements.module.css";

export const TICKS = ["none", "fade", "rise", "drop", "flip", "blur", "zoom", "scramble"] as const;
export type Tick = (typeof TICKS)[number];

const SPEEDS = { quick: 320, measured: 550, slow: 900 } as const;
export type TickSpeed = keyof typeof SPEEDS;
export const tickMs = (speed: string | undefined) => SPEEDS[speed as TickSpeed] ?? SPEEDS.measured;

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/**
 * One countdown number that animates when its value changes.
 *
 * Most transitions need the old value as well as the new one — a roll pushes
 * the old number out as the new one arrives — so the outgoing value is kept
 * for one transition and rendered beside the incoming one, then dropped.
 * Scramble instead shuffles the digits for a moment before settling. The
 * first value (dashes until the clock starts) never animates, and nothing
 * moves for visitors who ask for reduced motion.
 */
export function TickNumber({
  value,
  tick,
  speed,
  className,
  data,
}: {
  value: string;
  tick: Tick;
  speed: number;
  className: string;
  /** Extra data attributes for the number itself, e.g. the outline style. */
  data?: Record<string, string>;
}) {
  const last = useRef(value);
  const [outgoing, setOutgoing] = useState<string | null>(null);
  const [scramble, setScramble] = useState<string | null>(null);

  useEffect(() => {
    const old = last.current;
    if (old === value) return;
    last.current = value;
    if (tick === "none" || /–/.test(old) || reducedMotion()) return;
    if (tick === "scramble") {
      const started = Date.now();
      const timer = window.setInterval(() => {
        if (Date.now() - started >= speed) {
          window.clearInterval(timer);
          setScramble(null);
          return;
        }
        setScramble(value.replace(/\d/g, () => String(Math.floor(Math.random() * 10))));
      }, 45);
      return () => {
        window.clearInterval(timer);
        setScramble(null);
      };
    }
    setOutgoing(old);
    const timer = window.setTimeout(() => setOutgoing(null), speed);
    return () => window.clearTimeout(timer);
  }, [value, tick, speed]);

  if (tick === "none")
    return (
      <span className={className} {...data}>
        {value}
      </span>
    );
  return (
    <span className={clsx(className, styles.tick)} {...data}>
      {outgoing !== null && (
        <span key={`out-${outgoing}`} className={styles.tickOut} aria-hidden="true">
          {outgoing}
        </span>
      )}
      <span
        key={`in-${value}`}
        className={styles.tickIn}
        data-moving={outgoing !== null || undefined}
      >
        {scramble ?? value}
      </span>
    </span>
  );
}
