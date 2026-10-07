"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { countdownParts } from "@/lib/blocks/afterHours";
import {
  REEL_DEFAULTS as defaults,
  REEL_DESIGNS,
  type ReelConfig,
  type ReelDesignId,
} from "@/lib/blocks/comingSoonReel";
import { studyHref } from "@/lib/blocks/sectionStudies";
import { optimizedImageUrl } from "../ui/imageUrl";
import { MediaVideo } from "../ui/MediaVideo";
import { SIGNUP_MESSAGE, useNewsletterSignup } from "../ui/useNewsletterSignup";
import { SocialIcon } from "./AfterHoursLanding";
import { MgMonogram } from "./MgMonogram";
import styles from "./ReelLanding.module.css";

type SocialLink = { network: string; label: string; href: string };
export interface ReelLandingProps {
  variant: ReelDesignId;
  brand?: string;
  eyebrow?: string;
  title?: string;
  intro?: string;
  signature?: string;
  details?: { title: string; text?: string }[];
  showSignup?: boolean;
  buttonLabel?: string;
  socialLinks?: SocialLink[];
  config?: ReelConfig;
}

/** One clock for the whole page. Null until hydration so server and first client render agree. */
function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

const pad = (value: number) => String(value).padStart(2, "0");
const DASH = "––";

export function ReelLanding({
  variant,
  brand = "Modern Gentlemen",
  eyebrow,
  title = "Coming soon",
  intro,
  signature,
  details = [],
  showSignup = false,
  buttonLabel = "Notify me",
  socialLinks = [],
  config = {},
}: ReelLandingProps) {
  const countdown = { ...defaults.countdown, ...config.countdown };
  const video = config.video ?? defaults.video;
  const poster = config.poster ?? defaults.poster;
  const standalone = config.standalone ?? defaults.standalone;
  const caption = config.caption ?? defaults.caption;
  const placeholder = config.placeholder || defaults.placeholder;
  const tone = REEL_DESIGNS.find(([id]) => id === variant)?.[2] ?? "dark";
  const now = useNow();
  const parts = now === null ? null : countdownParts(countdown.target, now);
  const launched = parts !== null && parts.every((value) => value === 0);
  const labels = [countdown.days, countdown.hours, countdown.minutes, countdown.seconds];
  const values = parts ? parts.map(pad) : [DASH, DASH, DASH, DASH];
  const links = socialLinks.filter((link) => studyHref(link.href));

  const units = (separator?: string) =>
    launched ? (
      <p role="status" className={styles.launched}>
        {countdown.message}
      </p>
    ) : (
      <div role="timer" aria-label="Time until launch" aria-live="off" className={styles.cd}>
        {values.map((value, index) => (
          <span key={index} className={styles.unitWrap}>
            {separator && index > 0 && (
              <span className={styles.sep} aria-hidden="true">
                {separator}
              </span>
            )}
            <span className={styles.unit}>
              <span className={styles.num}>{value}</span>
              <span className={styles.label}>{labels[index]}</span>
            </span>
          </span>
        ))}
      </div>
    );
  const inline = launched ? (
    <p role="status" className={styles.launched}>
      {countdown.message}
    </p>
  ) : (
    <p role="timer" aria-label="Time until launch" aria-live="off" className={styles.inline}>
      {values.map((value, index) => (
        <span key={index}>
          {index > 0 && <span aria-hidden="true"> · </span>}
          {value} {labels[index]}
        </span>
      ))}
    </p>
  );
  const social = links.length > 0 && (
    <nav aria-label="Social media" className={styles.social}>
      {links.map((link, index) => (
        <a
          key={`${link.network}-${index}`}
          href={studyHref(link.href)}
          aria-label={link.label || link.network}
        >
          <SocialIcon network={link.network} />
        </a>
      ))}
    </nav>
  );
  const signup = showSignup && <ReelSignup buttonLabel={buttonLabel} placeholder={placeholder} />;
  const logo = (
    <span className={styles.logo}>
      <i aria-hidden="true" />
      <MgMonogram title={brand || "Modern Gentlemen"} />
    </span>
  );
  const reel = (className?: string) => (
    <ReelVideo src={video} poster={poster} className={className ?? styles.video} />
  );

  let body: ReactNode;
  switch (variant) {
    case "22":
      body = (
        <>
          {reel()}
          <div className={styles.shade} />
          <div className={styles.top}>
            {logo}
            {social}
          </div>
          <div className={styles.center}>
            {eyebrow && <p className={styles.mono}>{eyebrow}</p>}
            <h1 className={styles.eye}>{title}</h1>
            {units(":")}
            {intro && <p className={styles.lede}>{intro}</p>}
            {signup}
          </div>
        </>
      );
      break;
    case "23":
      body = (
        <>
          {reel()}
          <div className={styles.shade} />
          <div className={styles.top}>{logo}</div>
          <div className={styles.center}>
            {eyebrow && <p className={styles.mono}>{eyebrow}</p>}
            <h1 className={styles.soon}>{title}</h1>
            {inline}
            {intro && <p className={styles.lede}>{intro}</p>}
            {signup}
          </div>
          <div className={styles.foot}>{social}</div>
        </>
      );
      break;
    case "24": {
      const [first, ...rest] = title.trim().split(/\s+/);
      body = (
        <>
          {reel()}
          <div className={styles.top}>
            {logo}
            {eyebrow && <p className={styles.mono}>{eyebrow}</p>}
          </div>
          <h1 className={styles.split}>
            <span>{first}</span> {rest.length > 0 && <em>{rest.join(" ")}</em>}
          </h1>
          <div className={styles.under}>
            {units()}
            {signup}
          </div>
          {intro && <p className={styles.lede}>{intro}</p>}
          <div className={styles.foot}>{social}</div>
        </>
      );
      break;
    }
    case "25": {
      const seconds = parts ? parts[3] : 0;
      body = (
        <>
          {reel()}
          <div className={styles.shade} />
          <div className={styles.top}>
            {logo}
            {signature && <p className={styles.mono}>{signature}</p>}
          </div>
          <div className={styles.body}>
            {eyebrow && <p className={styles.eye}>{eyebrow}</p>}
            <h1>{title}</h1>
            {intro && <p className={styles.lede}>{intro}</p>}
            {signup}
          </div>
          <div className={styles.dial}>
            <svg viewBox="0 0 200 200" aria-hidden="true">
              <circle
                className={styles.ticks}
                cx="100"
                cy="100"
                r="96"
                pathLength={60}
                strokeDasharray=".08 .92"
              />
              <circle className={styles.ring} cx="100" cy="100" r="86" />
              <circle
                className={styles.prog}
                cx="100"
                cy="100"
                r="86"
                pathLength={60}
                strokeDasharray="60"
                strokeDashoffset={60 - (seconds === 0 ? 60 : seconds)}
                transform="rotate(-90 100 100)"
              />
            </svg>
            {launched ? (
              <div className={styles.face}>
                <p role="status" className={styles.launched}>
                  {countdown.message}
                </p>
              </div>
            ) : (
              <div className={styles.face} role="timer" aria-label="Time until launch">
                <span className={styles.mono}>{countdown.days}</span>
                <span className={styles.dd}>{values[0]}</span>
                <span className={styles.hms}>{values.slice(1).join(":")}</span>
              </div>
            )}
          </div>
          <div className={styles.foot}>{social}</div>
        </>
      );
      break;
    }
    case "26":
      body = (
        <>
          {reel()}
          <div className={styles.shade} />
          <div className={styles.center}>
            <div className={styles.line}>
              {logo}
              <h1>{title}</h1>
            </div>
            {inline}
            {intro && <p className={styles.lede}>{intro}</p>}
            {signup}
          </div>
          <div className={styles.foot}>{social}</div>
        </>
      );
      break;
    case "27":
      body = (
        <>
          {reel()}
          {caption && <p className={`${styles.mono} ${styles.cap}`}>{caption}</p>}
          <div className={styles.panel}>
            {logo}
            {eyebrow && <p className={styles.eye}>{eyebrow}</p>}
            <h1>{title}</h1>
            {intro && <p className={styles.lede}>{intro}</p>}
            {units()}
            {signup}
            {social}
          </div>
        </>
      );
      break;
    case "28":
      body = (
        <>
          {reel()}
          <div className={styles.knock}>
            <h1>{title}</h1>
          </div>
          <div className={styles.top}>
            {logo}
            {social}
          </div>
          <div className={styles.bottom}>
            <div>
              {eyebrow && <p className={styles.eye}>{eyebrow}</p>}
              {intro && <p className={styles.lede}>{intro}</p>}
            </div>
            {units()}
            {signup}
          </div>
        </>
      );
      break;
    case "29":
      body = (
        <>
          {reel()}
          <div className={styles.shade} />
          <div className={styles.top}>
            {logo}
            {signature && <p className={styles.mono}>{signature}</p>}
          </div>
          <div className={styles.band}>
            <div>
              {eyebrow && <p className={styles.eye}>{eyebrow}</p>}
              <h1>{title}</h1>
            </div>
            {units()}
            <div className={styles.end}>
              {signup}
              {social}
            </div>
          </div>
        </>
      );
      break;
    case "30":
      body = (
        <>
          {reel()}
          <div className={styles.mono30} aria-hidden="true">
            <MgMonogram />
          </div>
          <div className={styles.top}>
            {brand && <p className={styles.mono}>{brand}</p>}
            {social}
          </div>
          <div className={styles.bottom}>
            <div>
              {eyebrow && <p className={styles.eye}>{eyebrow}</p>}
              <h1>{title}</h1>
            </div>
            {units()}
            {signup}
          </div>
        </>
      );
      break;
    case "31":
      body = (
        <>
          {reel()}
          <div className={styles.shade} />
          <div className={styles.top}>
            {signature ? <p className={styles.mono}>{signature}</p> : <span />}
            {social}
          </div>
          <div className={styles.center}>
            <Seal text={`${brand} · ${eyebrow || "Coming soon"} · `}>{logo}</Seal>
            <h1 className={styles.eye}>{title}</h1>
            {units()}
            {intro && <p className={styles.lede}>{intro}</p>}
            {signup}
          </div>
        </>
      );
      break;
    case "32":
      body = (
        <>
          {reel()}
          <div className={styles.shade} />
          <div className={styles.top}>
            {logo}
            {social}
          </div>
          <figure className={styles.quote}>
            <span className={styles.qm} aria-hidden="true">
              “
            </span>
            <h1>
              {title} {intro && <em>{intro}</em>}
            </h1>
            {signature && <figcaption className={styles.mono}>{signature}</figcaption>}
          </figure>
          <div className={styles.bottom}>
            {units()}
            {signup}
          </div>
        </>
      );
      break;
    case "33":
      body = (
        <>
          {reel()}
          <div className={styles.shade} />
          {/* The figure bleeds off the edge; its own clip keeps it out of the page's scroll width. */}
          <span className={styles.ghostClip} aria-hidden="true">
            <span className={styles.ghost}>{values[3]}</span>
          </span>
          <div className={styles.top}>
            {logo}
            {social}
          </div>
          <div className={styles.body}>
            {eyebrow && <p className={styles.eye}>{eyebrow}</p>}
            <h1>{title}</h1>
            {intro && <p className={styles.lede}>{intro}</p>}
            {units()}
            {signup}
          </div>
          <p className={`${styles.mono} ${styles.ghostLabel}`} aria-hidden="true">
            {countdown.seconds}
          </p>
        </>
      );
      break;
    case "34":
      body = (
        <>
          {reel()}
          <div className={styles.shade} />
          <ClockHands now={now} />
          <div className={styles.top}>
            {logo}
            {social}
          </div>
          <div className={styles.body}>
            {eyebrow && <p className={styles.eye}>{eyebrow}</p>}
            <h1>{title}</h1>
            {intro && <p className={styles.lede}>{intro}</p>}
          </div>
          <div className={styles.hub}>
            {launched ? (
              <p role="status" className={styles.launched}>
                {countdown.message}
              </p>
            ) : (
              <div role="timer" aria-label="Time until launch" className={styles.hubInner}>
                <span className={styles.mono}>{countdown.days}</span>
                <span className={styles.dd}>{values[0]}</span>
                <span className={styles.hms}>{values.slice(1).join(":")}</span>
              </div>
            )}
          </div>
          <div className={styles.foot}>
            {signup}
            <LaunchTime target={countdown.target} fallback={signature} />
          </div>
        </>
      );
      break;
    case "35":
      body = (
        <>
          <div className={styles.plate}>
            {reel(styles.plateVideo)}
            {caption && <p className={styles.fig}>{caption}</p>}
          </div>
          <div className={styles.col}>
            {logo}
            <div className={styles.lot}>
              {eyebrow && <p className={styles.mono}>{eyebrow}</p>}
              <h1>{title}</h1>
            </div>
            {brand && <p className={styles.name}>{brand}</p>}
            {intro && <p className={styles.desc}>{intro}</p>}
            {details.length > 0 && (
              <dl className={styles.est}>
                {details.map((item, index) => (
                  <div key={index}>
                    <dt>{item.title}</dt>
                    <dd>{item.text}</dd>
                  </div>
                ))}
              </dl>
            )}
            {units()}
            {signup}
            <div className={styles.colFoot}>
              {social}
              {signature && <p className={styles.mono}>{signature}</p>}
            </div>
          </div>
        </>
      );
      break;
  }

  return (
    <section
      className={styles.page}
      data-coming-soon={variant}
      data-reel={variant}
      data-tone={tone}
      data-darkband={tone !== "light" || undefined}
      data-coming-soon-standalone={standalone}
    >
      {body}
    </section>
  );
}

/** Muted loop, started imperatively (React's `muted` is unreliable) and never for reduced motion. */
function ReelVideo({ src, poster, className }: { src: string; poster: string; className: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !src) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    element.muted = true;
    element.defaultMuted = true;
    element.play().catch(() => {});
  }, [src]);
  if (!src && !poster) return null;
  return (
    <MediaVideo
      ref={ref}
      src={src || undefined}
      poster={poster ? optimizedImageUrl(poster, 1920) : undefined}
      className={className}
      loop
      muted
      playsInline
      preload="metadata"
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}

function ReelSignup({ buttonLabel, placeholder }: { buttonLabel: string; placeholder: string }) {
  const { email, setEmail, state, submit } = useNewsletterSignup("newsletter");
  const id = useId();
  return (
    <div className={styles.signup}>
      {state === "done" ? (
        <p role="status" className={styles.done}>
          {SIGNUP_MESSAGE.done}
        </p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          aria-busy={state === "submitting"}
        >
          <label htmlFor={id} className={styles.srOnly}>
            Email address
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
            <span aria-hidden="true"> →</span>
          </button>
        </form>
      )}
      {(state === "error" || state === "throttled" || state === "invalid") && (
        <p role="alert" className={styles.alert}>
          {SIGNUP_MESSAGE[state]}
        </p>
      )}
    </div>
  );
}

function Seal({ text, children }: { text: string; children: ReactNode }) {
  const id = `seal${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <div className={styles.seal}>
      <svg viewBox="0 0 200 200" className={styles.sealRing} aria-hidden="true">
        <defs>
          <path id={id} d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
        </defs>
        <text>
          <textPath href={`#${id}`} textLength="486">
            {text}
          </textPath>
        </text>
      </svg>
      {children}
    </div>
  );
}

const LONDON = "Europe/London";
function londonClock(now: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date(now));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { h: get("hour"), m: get("minute"), s: get("second") };
}

function ClockHands({ now }: { now: number | null }) {
  // Before hydration the hands rest at ten to two, the watchmaker's display time.
  const c = now === null ? { h: 10, m: 10, s: 0 } : londonClock(now);
  const angles = {
    h: (c.h % 12) * 30 + c.m / 2,
    m: c.m * 6 + c.s / 10,
    s: c.s * 6,
  };
  return (
    <div className={styles.hands} aria-hidden="true">
      <span className={styles.handH} style={{ transform: `rotate(${angles.h - 90}deg)` }} />
      <span className={styles.handM} style={{ transform: `rotate(${angles.m - 90}deg)` }} />
      <span className={styles.handS} style={{ transform: `rotate(${angles.s - 90}deg)` }} />
    </div>
  );
}

/** "09:00 GMT, 1 December", derived from the launch date the editor set. */
function LaunchTime({ target, fallback }: { target: string; fallback?: string }) {
  const end = countdownParts(target, 0) ? new Date(Date.parse(target)) : null;
  const text = end
    ? `${new Intl.DateTimeFormat("en-GB", {
        timeZone: LONDON,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZoneName: "short",
      }).format(end)}, ${new Intl.DateTimeFormat("en-GB", {
        timeZone: LONDON,
        day: "numeric",
        month: "long",
      }).format(end)}`
    : fallback;
  if (!text) return null;
  return (
    <p className={styles.launchTime}>
      <span className={styles.mono}>Doors open</span>
      <span className={styles.eye}>{text}</span>
    </p>
  );
}
