import { SEARCH_MOTION_PRESETS, type SearchMotionId } from "@/lib/domain/searchPresets";

type Track = {
  target: HTMLElement;
  frames: Keyframe[];
  start: number;
  span: number;
  easing: string;
};
/** Paired WAAPI tracks from the approved motion studies. Cancel leaves no inline styles. */
export function searchMotionTracks(root: HTMLElement, active: number): Track[] {
  const $ = (selector: string) => root.querySelector<HTMLElement>(selector);
  const rows = Array.from(root.querySelectorAll<HTMLElement>("[data-search-row]"));
  const sheet = $("[data-search-sheet]"),
    scrim = $("[data-search-scrim]"),
    preview = $("[data-search-preview]"),
    media = $("[data-search-media]"),
    text = $("[data-search-text]"),
    form = $("form"),
    body = $("[data-search-body]"),
    bar = $("[data-search-bar]"),
    rule = $("[data-search-rule]");
  const nav = document.querySelector<HTMLElement>('nav[aria-label="Primary"]'),
    page = document.querySelector<HTMLElement>("[data-site-main]"),
    header = nav;
  const tracks: Track[] = [];
  const ease = "cubic-bezier(.22,1,.36,1)";
  function add(target: HTMLElement | null, frames: Keyframe[], start = 0, span = 1) {
    if (target && !target.hidden) tracks.push({ target, frames, start, span, easing: ease });
  }
  const fadeMove = (x = 0, y = 12): Keyframe[] => [
    { opacity: 0, transform: "translate(" + x + "px," + y + "px)" },
    { opacity: 1, transform: "translate(0px,0px)" },
  ];
  function surface(frames = fadeMove(0, 8), start = 0, span = 1) {
    add(sheet, frames, start, span);
  }
  function cascade(axis = "y", start = 0.18, spread = 0.24, span = 0.58) {
    rows.forEach((r, i) =>
      add(
        r,
        fadeMove(axis === "x" ? 20 : 0, axis === "y" ? 12 : 0),
        start + spread * (i / Math.max(1, rows.length - 1)),
        span
      )
    );
  }
  add(scrim, [{ opacity: 0 }, { opacity: 1 }], 0, 0.85);
  switch (active) {
    case 1:
      surface(fadeMove(0, 12));
      break;
    case 2:
      surface([
        { opacity: 0, transform: "translateY(10px) scale(.975)" },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ]);
      break;
    case 3:
      surface(fadeMove(0, -36));
      break;
    case 4:
      surface([
        { opacity: 0, filter: "blur(4px)", transform: "translateY(5px) scale(.992)" },
        { opacity: 1, filter: "blur(0px)", transform: "translateY(0px) scale(1)" },
      ]);
      break;
    case 5:
      surface(fadeMove(0, 4));
      break;
    case 6:
      surface(fadeMove(-64, 0));
      break;
    case 7:
      surface(fadeMove(64, 0));
      break;
    case 8:
      surface(fadeMove(0, 80));
      break;
    case 9:
      surface(fadeMove(34, -24));
      break;
    case 10:
      surface(fadeMove(0, -22));
      add(form, fadeMove(0, 24), 0.06, 0.85);
      add(body, fadeMove(0, 38), 0.12, 0.88);
      break;
    case 11:
      surface([{ clipPath: "inset(0% 0% 100% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)" }]);
      break;
    case 12:
      surface([{ clipPath: "inset(0% 0% 0% 100%)" }, { clipPath: "inset(0% 0% 0% 0%)" }]);
      break;
    case 13:
      surface([{ clipPath: "inset(0% 50% 0% 50%)" }, { clipPath: "inset(0% 0% 0% 0%)" }]);
      break;
    case 14:
      surface([{ clipPath: "inset(50% 0% 50% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)" }]);
      break;
    case 15:
      surface([{ clipPath: "circle(0% at 97% 0%)" }, { clipPath: "circle(150% at 97% 0%)" }]);
      break;
    case 16:
      surface(fadeMove(0, -6), 0, 0.68);
      cascade();
      add(preview, fadeMove(0, 10), 0.22, 0.72);
      break;
    case 17:
      surface(fadeMove(8, 0), 0, 0.7);
      cascade("x");
      add(preview, fadeMove(-16, 0), 0.2, 0.75);
      break;
    case 18:
      surface(fadeMove(0, 4), 0, 0.65);
      rows.forEach((r, i) => {
        const mid = (rows.length - 1) / 2;
        add(
          r,
          fadeMove(0, (i - mid) * 9),
          0.14 + (Math.abs(i - mid) / Math.max(mid, 1)) * 0.26,
          0.6
        );
      });
      add(preview, fadeMove(0, 8), 0.2, 0.76);
      break;
    case 19:
      surface(fadeMove(0, 7), 0, 0.58);
      add(preview, fadeMove(0, 9), 0.07, 0.61);
      add(form, fadeMove(0, 8), 0.23, 0.62);
      cascade("y", 0.3, 0.15, 0.55);
      break;
    case 20:
      surface(fadeMove(0, 5), 0, 0.55);
      add(form, fadeMove(0, -8), 0.03, 0.55);
      add(bar, fadeMove(0, 8), 0.15, 0.6);
      cascade("y", 0.23, 0.16, 0.6);
      add(preview, fadeMove(12, 0), 0.34, 0.66);
      break;
    case 21:
      add(rule, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], 0, 0.38);
      surface(
        [{ clipPath: "inset(0% 0% 100% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)" }],
        0.14,
        0.86
      );
      add(body, fadeMove(0, 10), 0.3, 0.7);
      break;
    case 22:
      surface([
        { clipPath: "inset(0% 0% 96% 96% round 18px)" },
        { clipPath: "inset(0% 0% 0% 0% round 0px)" },
      ]);
      add(body, fadeMove(10, -8), 0.25, 0.75);
      break;
    case 23:
      surface(fadeMove(0, -14), 0.05, 0.95);
      add(
        nav,
        [
          { opacity: 1, transform: "translateX(0px)" },
          { opacity: 0.12, transform: "translateX(-12px)" },
        ],
        0,
        0.5
      );
      add(form, fadeMove(22, 0), 0.13, 0.8);
      break;
    case 24:
      surface([
        { opacity: 0, transform: "translateY(12px) scale(.98)" },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ]);
      add(
        page,
        [{ transform: "scale(1) translateY(0px)" }, { transform: "scale(.985) translateY(12px)" }],
        0,
        1
      );
      break;
    case 25:
      surface(fadeMove(0, 18));
      add(header, [{ transform: "translateY(0px)" }, { transform: "translateY(-3px)" }], 0, 0.75);
      add(page, [{ transform: "translateY(0px)" }, { transform: "translateY(10px)" }], 0.06, 0.85);
      break;
    case 26:
      surface(fadeMove(0, 6), 0, 0.55);
      add(
        media,
        [
          { opacity: 0, transform: "scale(1.045)" },
          { opacity: 1, transform: "scale(1)" },
        ],
        0.12,
        0.7
      );
      add(text, fadeMove(0, 14), 0.29, 0.71);
      cascade("y", 0.1, 0.16, 0.58);
      break;
    case 27:
      surface([
        {
          opacity: 0,
          transform: "perspective(1400px) rotateY(-7deg) translateX(-12px)",
          transformOrigin: "left center",
        },
        {
          opacity: 1,
          transform: "perspective(1400px) rotateY(0deg) translateX(0px)",
          transformOrigin: "left center",
        },
      ]);
      break;
    case 28:
      surface([
        { opacity: 0, transform: "translateY(-19px)", offset: 0 },
        { opacity: 1, transform: "translateY(2px)", offset: 0.74 },
        { opacity: 1, transform: "translateY(0px)", offset: 1 },
      ]);
      break;
    case 29:
      surface(fadeMove(0, 3), 0, 0.38);
      add(
        form,
        [{ clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)" }],
        0.08,
        0.65
      );
      rows.forEach((r, i) =>
        add(
          r,
          [{ clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)" }],
          0.15 + (i / Math.max(rows.length - 1, 1)) * 0.25,
          0.6
        )
      );
      add(
        preview,
        [{ clipPath: "inset(0% 0% 0% 100%)" }, { clipPath: "inset(0% 0% 0% 0%)" }],
        0.23,
        0.77
      );
      break;
    case 30:
      add(rule, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], 0, 0.25);
      surface(
        [{ clipPath: "inset(0% 0% 100% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)" }],
        0.08,
        0.76
      );
      add(form, fadeMove(0, -10), 0.13, 0.54);
      cascade("y", 0.27, 0.19, 0.51);
      add(
        media,
        [
          { opacity: 0, transform: "scale(1.025)" },
          { opacity: 1, transform: "scale(1)" },
        ],
        0.35,
        0.65
      );
      add(text, fadeMove(0, 8), 0.41, 0.59);
      break;
  }
  return tracks;
}
export function animateSearch(root: HTMLElement, motion: SearchMotionId, opening: boolean) {
  const preset = SEARCH_MOTION_PRESETS.find((p) => p.id === motion);
  const animations: Animation[] = [];
  if (
    motion !== "none" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
    typeof root.animate === "function"
  ) {
    const active = preset ? SEARCH_MOTION_PRESETS.indexOf(preset) + 1 : 1;
    const total = preset ? (opening ? preset.openMs : preset.closeMs) : opening ? 240 : 180;
    for (const track of searchMotionTracks(root, active)) {
      let frames = track.frames.map((f) => ({ ...f }));
      if (!opening)
        frames = frames
          .reverse()
          .map((f) => (f.offset == null ? f : { ...f, offset: 1 - f.offset }));
      if (!opening && frames[0]) {
        const current = getComputedStyle(track.target);
        frames[0] = Object.fromEntries(
          Object.entries(frames[0]).map(([key, value]) => [
            key,
            key === "offset" ? value : (current as unknown as Record<string, string>)[key] || value,
          ])
        );
      }
      animations.push(
        track.target.animate(frames, {
          duration: total * track.span,
          delay: total * (opening ? track.start : Math.max(0, 1 - track.start - track.span)),
          easing: track.easing,
          fill: "both",
        })
      );
    }
  }
  return {
    finished: Promise.allSettled(animations.map((a) => a.finished)),
    cancel: () => animations.forEach((a) => a.cancel()),
  };
}
