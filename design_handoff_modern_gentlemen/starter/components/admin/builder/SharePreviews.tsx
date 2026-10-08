"use client";

import { useState } from "react";

import { clsx } from "@/components/ui/clsx";
import { FOCUS_RING, HAIRLINE, LABEL_SM } from "@/components/admin/ui/styles";
import { BRAND, metaDescription } from "@/lib/domain/seo";

/**
 * What the page will look like as a search result and as a shared link.
 *
 * Approximations, said plainly in the UI: search engines and social networks
 * each truncate and lay out differently and change it without notice. The
 * lengths here are the widely used guides (titles about 30–60 characters,
 * descriptions about 70–160), shown as a meter rather than enforced.
 */

export type LengthVerdict = "empty" | "short" | "good" | "long";

export function lengthVerdict(length: number, min: number, max: number): LengthVerdict {
  if (length === 0) return "empty";
  if (length < min) return "short";
  if (length > max) return "long";
  return "good";
}

/** Cut at a word boundary with an ellipsis, as a results page does. */
export function truncateForDisplay(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function siteHost(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "").host || "moderngentlemen.co";
  } catch {
    return "moderngentlemen.co";
  }
}

const VERDICT_TEXT: Record<LengthVerdict, string> = {
  empty: "Missing",
  short: "Short",
  good: "Good length",
  long: "May be cut off",
};

function Meter({
  label,
  length,
  min,
  max,
}: {
  label: string;
  length: number;
  min: number;
  max: number;
}) {
  const verdict = lengthVerdict(length, min, max);
  return (
    <p className="flex items-center gap-2 text-[11px]" data-length-meter={label}>
      <span className="w-[86px] shrink-0 text-mg-fg/70">{label}</span>
      <span aria-hidden className="relative h-1 flex-1 bg-mg-fg/10">
        <span
          className={clsx(
            "absolute inset-y-0 left-0",
            verdict === "good"
              ? "bg-[#2f9e5b]"
              : verdict === "long"
                ? "bg-mg-accent"
                : "bg-[#c98a1b]"
          )}
          style={{ width: `${Math.min(100, (length / (max * 1.25)) * 100)}%` }}
        />
      </span>
      <span className="w-[120px] shrink-0 text-right font-mono text-[10px]">
        {length} · {VERDICT_TEXT[verdict]}
      </span>
    </p>
  );
}

export function SharePreviews({
  title,
  description,
  socialTitle,
  socialDescription,
  socialImage,
  path,
  noIndex,
}: {
  /** The full document title, brand suffix included. */
  title: string;
  description: string;
  socialTitle: string;
  socialDescription: string;
  socialImage: string;
  path: string;
  noIndex: boolean;
}) {
  const [card, setCard] = useState<"large" | "compact">("large");
  const host = siteHost();
  const crumbs = path.split("/").filter(Boolean);
  const shownDescription = metaDescription(description, 160);

  return (
    <div className="space-y-3">
      <section aria-label="Search preview" className={clsx("border p-3", HAIRLINE)}>
        <p className={clsx(LABEL_SM, "mb-2")}>Search result · approximate</p>
        {noIndex && (
          <p className="mb-2 bg-mg-accent/10 px-2 py-1 text-[11px]">
            This page asks search engines not to index it, so it should not appear in results.
          </p>
        )}
        <div className="bg-white p-3 font-sans text-[#202124]">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="grid h-6 w-6 place-items-center rounded-full bg-[#141414] text-[9px] font-bold text-white"
            >
              MG
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block text-[12px]">{BRAND}</span>
              <span className="block truncate text-[11px] text-[#4d5156]">
                https://{host}
                {crumbs.length ? ` › ${crumbs.join(" › ")}` : ""}
              </span>
            </span>
          </div>
          <p className="mt-1 text-[17px] leading-snug text-[#1a0dab]">
            {truncateForDisplay(title, 60)}
          </p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-[#4d5156]">
            {shownDescription ?? (
              <span className="italic">
                No meta description: search engines will pick text from the page.
              </span>
            )}
          </p>
        </div>
        <div className="mt-2 space-y-1">
          <Meter label="Title" length={title.length} min={30} max={60} />
          <Meter label="Description" length={description.trim().length} min={70} max={160} />
        </div>
      </section>

      <section aria-label="Social preview" className={clsx("border p-3", HAIRLINE)}>
        <div className="mb-2 flex items-center justify-between">
          <p className={LABEL_SM}>Shared link · approximate</p>
          <div className="flex" role="group" aria-label="Card style">
            {(["large", "compact"] as const).map((style) => (
              <button
                key={style}
                type="button"
                aria-pressed={card === style}
                onClick={() => setCard(style)}
                className={clsx(
                  "border px-2 py-0.5 text-[10px]",
                  HAIRLINE,
                  card === style && "bg-mg-fg text-mg-bg",
                  FOCUS_RING
                )}
              >
                {style === "large" ? "Large image" : "Compact"}
              </button>
            ))}
          </div>
        </div>
        <div
          data-social-card={card}
          className={clsx(
            "overflow-hidden border border-[#dadde1] bg-white font-sans text-[#1c1e21]",
            card === "compact" && "flex"
          )}
        >
          <div
            className={clsx(
              "relative shrink-0 bg-[#e4e6eb]",
              card === "large" ? "aspect-[1.91/1] w-full" : "h-[86px] w-[86px]"
            )}
          >
            {socialImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- an editor preview of any URL, never a public image
              <img
                src={socialImage}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <span className="absolute inset-0 grid place-items-center px-2 text-center text-[11px] text-[#606770]">
                No social image
              </span>
            )}
          </div>
          <div className="min-w-0 bg-[#f0f2f5] px-3 py-2">
            <p className="truncate text-[11px] uppercase text-[#606770]">{host}</p>
            <p className="line-clamp-2 text-[14px] font-semibold leading-snug">{socialTitle}</p>
            <p className="line-clamp-1 text-[12px] text-[#606770]">
              {socialDescription || "No description"}
            </p>
          </div>
        </div>
        {!socialImage && (
          <p className="mt-2 text-[11px] text-mg-fg/70">
            Links with an image are shared far more. 1200 × 630 suits most networks.
          </p>
        )}
      </section>
    </div>
  );
}
