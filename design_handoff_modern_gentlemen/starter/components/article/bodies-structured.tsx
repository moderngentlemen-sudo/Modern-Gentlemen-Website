import { BodyIntro } from "./primitives";
import { backgroundImageUrl } from "../ui/imageUrl";

/**
 * Structured body variants (data-driven). Demo content is fixed per variant,
 * transcribed verbatim from MG Article.dc.html renderVals(). Held in JS arrays
 * so apostrophes need no JSX escaping. Colours the prototype hardcoded to
 * #f4f4f4 use theme tokens here so the bodies read in both themes.
 */

/**
 * Background layers for the structured article bodies.
 *
 * `width` is the slot the layer covers at desktop: the photo-essay figures run
 * the width of the reading column, the three-up gallery cells are a third of
 * it, and the numbered list rows sit in a fixed 300px cell.
 */
const bg = (src: string, width: number) => ({ backgroundImage: backgroundImageUrl(src, width) });

// ── Interview / Ask ────────────────────────────────────────────────────────
const QA_INTERVIEW = [
  {
    q: "You turn down more work than you take. Why?",
    a: "Because a car you rush is a car you ruin. I’d rather do six properly than sixty badly. The list is long, but nobody on it is in a hurry — that’s how I know they’re the right people.",
  },
  {
    q: "How do you know when a restoration is finished?",
    a: "When it looks like nothing was ever wrong. The best work is invisible. If you can see where I’ve been, I haven’t finished.",
  },
  {
    q: "What have four decades taught you?",
    a: "That patience isn’t slowness. It’s paying attention for longer than most people are willing to. The hurry is where the mistakes live.",
  },
  {
    q: "Will anyone still do this in thirty years?",
    a: "Someone will. Fewer of us, but the good ones don’t vanish — they get quieter and more expensive. As they should.",
  },
];

export function BodyQa() {
  return (
    <article className="mx-auto max-w-[720px] px-6 pt-16 pb-10">
      <BodyIntro className="mb-10 text-[20px]">
        We spent a morning on the workshop floor with a man who shapes aluminium by hand and eye.
        What follows has been edited only for length.
      </BodyIntro>
      {QA_INTERVIEW.map((row) => (
        <div key={row.q} className="mb-[30px]">
          <p className="mb-3 font-grotesk font-medium text-[19px] leading-[1.4] tracking-[-0.01em] text-mg-accentSerif">
            {row.q}
          </p>
          <p className="font-grotesk font-light text-[18px] leading-[1.72] text-mg-fg/[0.86]">
            {row.a}
          </p>
        </div>
      ))}
    </article>
  );
}

const ASK = [
  {
    who: "FROM J. IN LEEDS",
    q: "Four-in-hand or half-Windsor?",
    a: "Four-in-hand, almost always. It’s slightly asymmetric, which reads as considered rather than corporate. Save the Windsor for a spread collar and a reason.",
  },
  {
    who: "FROM T. IN GLASGOW",
    q: "How many fragrances should a man own?",
    a: "Two. One quiet for daylight, one with more to say after six. A third only when you’ve worn the first two long enough to miss them.",
  },
  {
    who: "FROM R. IN BRISTOL",
    q: "When is it acceptable to break a style rule?",
    a: "Once you can state the rule precisely and say why it exists. Knowledge earns the exception; ignorance just looks like a mistake.",
  },
  {
    who: "FROM D. IN LONDON",
    q: "Brown shoes with a navy suit?",
    a: "Yes — it’s the most useful combination you own. Keep the brown rich and the polish honest.",
  },
];

export function BodyAsk() {
  return (
    <article className="mx-auto max-w-[720px] px-6 pt-[56px] pb-10">
      <BodyIntro className="mb-9 text-[20px]">
        Every week our editors answer the questions readers actually send. This week: knots,
        cologne, and when to break a rule.
      </BodyIntro>
      {ASK.map((row) => (
        <div key={row.who} className="mb-7 border-b border-mg-bd/10 pb-7">
          <div className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-mg-fg/60">
            {row.who}
          </div>
          <p className="mb-3 font-grotesk font-medium text-[20px] leading-[1.35] tracking-[-0.015em] text-mg-fg">
            {row.q}
          </p>
          <p className="font-grotesk font-light text-[17px] leading-[1.7] text-mg-fg/[0.82]">
            {row.a}
          </p>
        </div>
      ))}
    </article>
  );
}

// ── Spec comparison ─────────────────────────────────────────────────────────
const SPEC: {
  label: string;
  kind: "header" | "row" | "verdict";
  cells: [string, string, string];
}[] = [
  { label: "MODEL", kind: "header", cells: ["THE FIELD", "THE DRESS", "THE DIVER"] },
  { label: "Case", kind: "row", cells: ["38mm steel", "36mm steel", "40mm steel"] },
  { label: "Movement", kind: "row", cells: ["Automatic", "Manual", "Automatic"] },
  { label: "Water resist.", kind: "row", cells: ["100m", "30m", "300m"] },
  { label: "Wears best", kind: "row", cells: ["Everywhere", "Black tie", "Off the cuff"] },
  { label: "The verdict", kind: "verdict", cells: ["The one", "The heirloom", "The tool"] },
];

export function BodySpec() {
  return (
    <article className="mx-auto max-w-[960px] px-6 pt-[56px] pb-10">
      <BodyIntro className="mb-9 max-w-[640px] text-[20px]">
        Three watches, one honest question: which earns the place on your wrist for the next decade?
        We put them side by side.
      </BodyIntro>
      <div data-specwrap className="overflow-x-auto border border-mg-bd/[0.12]">
        {SPEC.map((r) => (
          <div
            key={r.label}
            data-specrow
            className="grid grid-cols-[minmax(120px,1.4fr)_minmax(94px,1fr)_minmax(94px,1fr)_minmax(94px,1fr)] items-center gap-4 border-b border-mg-bd/[0.08] p-[16px_22px] last:border-b-0"
          >
            <div
              className={
                r.kind === "header"
                  ? "font-mono text-[10px] tracking-[0.04em] text-mg-fg/60"
                  : r.kind === "verdict"
                    ? "font-mono text-[11px] tracking-[0.04em] text-mg-accentSerif"
                    : "font-mono text-[11px] tracking-[0.04em] text-mg-fg/[0.85]"
              }
            >
              {r.label}
            </div>
            {r.cells.map((c, i) => (
              <div
                key={i}
                className={
                  "font-grotesk text-[14px] " +
                  (r.kind === "header"
                    ? "text-mg-fg/60"
                    : r.kind === "verdict"
                      ? "text-mg-fg"
                      : "text-mg-fg/80")
                }
              >
                {c}
              </div>
            ))}
          </div>
        ))}
      </div>
    </article>
  );
}

// ── Photo essay / Gallery ───────────────────────────────────────────────────
const PHOTOS = [
  {
    src: "/images/film-workshop.jpg",
    cap: "FIG. 01 — The floor at 06:40, before the tools warmed.",
  },
  {
    src: "/images/film-tailor.jpg",
    cap: "FIG. 02 — Forty years of muscle memory, one panel at a time.",
  },
  {
    src: "/images/film-watchmaker.jpg",
    cap: "FIG. 03 — The last light check before the doors opened.",
  },
];

export function BodyPhoto() {
  return (
    <article className="mx-auto max-w-[1000px] px-6 pt-[56px] pb-10">
      <BodyIntro className="mb-10 max-w-[640px] text-[21px]">
        Dawn at the coachbuilder’s. Photographed over one quiet morning, before the tools warmed and
        the phones started.
      </BodyIntro>
      {PHOTOS.map((p) => (
        <figure key={p.cap} className="mb-11">
          <div
            className="h-[64vh] min-h-[420px] bg-[#0d0d0d] bg-cover bg-center"
            style={bg(p.src, 1200)}
          />
          <figcaption className="mt-3.5 font-mono text-[12px] tracking-[0.12em] text-mg-fg/60">
            {p.cap}
          </figcaption>
        </figure>
      ))}
    </article>
  );
}

const GALLERY = [
  { src: "/images/style-mono.jpg", cap: "THE OVERCOAT" },
  { src: "/images/watch-gear.jpg", cap: "THE CHRONOGRAPH" },
  { src: "/images/grooming.jpg", cap: "THE KIT" },
  { src: "/images/hero-cover.jpg", cap: "THE MACHINE" },
  { src: "/images/film-tailor.jpg", cap: "THE CLOTH" },
  { src: "/images/film-watchmaker.jpg", cap: "THE MOVEMENT" },
];

export function BodyGallery() {
  return (
    <article className="mx-auto max-w-[1120px] px-6 pt-[56px] pb-10">
      <BodyIntro className="mb-8 max-w-[600px] text-[20px]">
        A visual index of the season’s objects — everything here earns its place, nothing here
        shouts.
      </BodyIntro>
      <div data-gal className="grid grid-cols-3 gap-3.5">
        {GALLERY.map((g) => (
          <figure key={g.cap} data-galcell className="overflow-hidden">
            <div className="h-[300px] bg-[#0d0d0d] bg-cover bg-center" style={bg(g.src, 640)} />
            <figcaption className="px-1 pt-3 font-mono text-[10px] tracking-[0.12em] text-mg-fg/60">
              {g.cap}
            </figcaption>
          </figure>
        ))}
      </div>
    </article>
  );
}

// ── The List ────────────────────────────────────────────────────────────────
const LIST = [
  {
    rank: "1",
    tag: "WATCHES",
    name: "The Everyday Field Watch",
    blurb: "One watch that suits the office, the weekend and everything careless in between.",
    src: "/images/watch-gear.jpg",
  },
  {
    rank: "2",
    tag: "STYLE",
    name: "The Unstructured Blazer",
    blurb: "The single most useful thing you can add to a wardrobe of jeans and shirts.",
    src: "/images/style-mono.jpg",
  },
  {
    rank: "3",
    tag: "GROOMING",
    name: "Cedar & Vetiver, 50ml",
    blurb: "Quiet in daylight, warmer by evening. The scent people ask about but can’t place.",
    src: "/images/grooming.jpg",
  },
  {
    rank: "4",
    tag: "ACCESSORIES",
    name: "The Full-Grain Card Holder",
    blurb: "It will look better in five years than it does today. Buy the brown.",
    src: "/images/film-tailor.jpg",
  },
  {
    rank: "5",
    tag: "CULTURE",
    name: "A Weekend Without a Screen",
    blurb: "Free, and the hardest thing on this list to actually do.",
    src: "/images/hero-cover.jpg",
  },
];

export function BodyList() {
  return (
    <article className="mx-auto max-w-[820px] px-6 pt-[56px] pb-10">
      <BodyIntro className="mb-10 max-w-[600px] text-[20px]">
        Five things we’d buy again without hesitating — ranked, argued, and photographed on the desk
        that tested them.
      </BodyIntro>
      <div className="flex flex-col gap-[22px]">
        {LIST.map((it) => (
          <div
            key={it.rank}
            data-listrow
            className="grid grid-cols-[300px_1fr] items-center gap-6 overflow-hidden border border-mg-bd/10 bg-mg-surface"
          >
            <div
              data-listimg
              className="h-full min-h-[180px] bg-[#0d0d0d] bg-cover bg-center"
              style={bg(it.src, 640)}
            />
            <div className="p-[22px_26px_22px_0] max-[820px]:px-[22px]">
              <div className="flex items-center gap-3">
                <span className="font-grotesk font-semibold text-[30px] leading-none tracking-[-0.04em] text-mg-accentInk">
                  {it.rank}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-mg-fg/60">
                  {it.tag}
                </span>
              </div>
              <h3 className="mt-2.5 font-grotesk font-medium text-[22px] leading-[1.15] tracking-[-0.02em] text-mg-fg">
                {it.name}
              </h3>
              <p className="mt-2 font-grotesk font-light text-[14.5px] leading-[1.6] text-mg-fg/[0.62]">
                {it.blurb}
              </p>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

// ── Field Guide (Steps) ─────────────────────────────────────────────────────
const STEPS = [
  {
    n: "1",
    title: "Buy navy or charcoal, first",
    body: "Both are quiet enough to wear often and forgiving enough to dress up or down. Colour and pattern come later, once you own a suit you actually reach for.",
  },
  {
    n: "2",
    title: "Fit the shoulders, tailor the rest",
    body: "The shoulder is the one thing a tailor can’t fix. Everything else — sleeves, waist, hem — is adjustable, so let it be a touch generous off the rack.",
  },
  {
    n: "3",
    title: "Half-canvassed is the honest middle",
    body: "Fully fused is disposable; fully bespoke is years away. Half-canvassed drapes properly and lasts, without pretending to be something it isn’t.",
  },
  {
    n: "4",
    title: "Trousers break, or they don’t",
    body: "A single slight break reads modern and considered. Ask for it, then leave the shop and live in them before you touch anything again.",
  },
  {
    n: "5",
    title: "Ignore the trend forecast",
    body: "Lapel widths drift by millimetres and mean nothing. Buy classic proportions and you’ll never own a suit that looks like a specific year.",
  },
];

export function BodySteps() {
  return (
    <article className="mx-auto max-w-[720px] px-6 pt-[56px] pb-10">
      <BodyIntro className="mb-11 text-[20px]">
        Buying a first proper suit is simpler than the shops make it feel. Five steps, in order, and
        one thing to ignore entirely.
      </BodyIntro>
      <div className="flex flex-col">
        {STEPS.map((s) => (
          <div
            key={s.n}
            className="grid grid-cols-[auto_1fr] gap-[22px] border-t border-mg-bd/10 py-6"
          >
            <div className="flex h-[44px] w-[44px] flex-shrink-0 items-center justify-center rounded-full border border-mg-accent font-grotesk font-medium text-[17px] text-mg-accentInk">
              {s.n}
            </div>
            <div>
              <h3 className="mt-1.5 font-grotesk font-medium text-[21px] leading-[1.2] tracking-[-0.02em] text-mg-fg">
                {s.title}
              </h3>
              <p className="mt-2.5 font-grotesk font-light text-[16px] leading-[1.65] text-mg-fg/70">
                {s.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

// ── The Regimen ─────────────────────────────────────────────────────────────
const REGIMEN = [
  {
    time: "0:00",
    step: "Cleanse",
    note: "Lukewarm water, a pea of gentle wash. Thirty seconds, no scrubbing.",
    tag: "STEP 01",
  },
  {
    time: "2:00",
    step: "Treat",
    note: "A single active — vitamin C by day, retinol by night. Never both.",
    tag: "STEP 02",
  },
  {
    time: "4:00",
    step: "Moisturise",
    note: "While the skin’s still damp. A little on the neck, which everyone forgets.",
    tag: "STEP 03",
  },
  {
    time: "6:00",
    step: "Protect",
    note: "SPF, every morning, weather regardless. This is the whole game.",
    tag: "STEP 04",
  },
];

export function BodyRegimen() {
  return (
    <article className="mx-auto max-w-[720px] px-6 pt-[56px] pb-10">
      <BodyIntro className="mb-10 text-[20px]">
        Seven honest minutes, four products, done before the coffee’s cold. The short regimen that
        actually holds.
      </BodyIntro>
      <div className="flex flex-col gap-px overflow-hidden border border-mg-bd/[0.09] bg-mg-bd/[0.09]">
        {REGIMEN.map((r) => (
          <div
            key={r.tag}
            className="grid grid-cols-[78px_1fr_auto] items-center gap-[18px] bg-mg-surface p-[20px_24px]"
          >
            <div className="font-grotesk font-semibold text-[26px] leading-none tracking-[-0.03em] text-mg-accentInk">
              {r.time}
            </div>
            <div>
              <div className="font-grotesk font-medium text-[17px] tracking-[-0.015em] text-mg-fg">
                {r.step}
              </div>
              <div className="mt-1 font-grotesk font-light text-[14px] leading-[1.5] text-mg-fg/60">
                {r.note}
              </div>
            </div>
            <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-mg-fg/60">
              {r.tag}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

// ── A Brief History (Timeline) ──────────────────────────────────────────────
const TIMELINE = [
  {
    year: "1816",
    title: "The first chronograph",
    body: "Built to time horse races — a stopwatch that dropped ink to mark the seconds, hence the name: “time writer.”",
  },
  {
    year: "1913",
    title: "It reaches the wrist",
    body: "The wristwatch chronograph arrives, and with it the idea that timing should travel with the man, not the instrument.",
  },
  {
    year: "1963",
    title: "Born on the grid",
    body: "Motorsport makes the chronograph iconic — the tachymeter bezel becomes shorthand for speed and competence alike.",
  },
  {
    year: "1969",
    title: "The automatic movement",
    body: "Self-winding chronographs end the daily ritual of the crown, and the complication becomes something you simply wear.",
  },
  {
    year: "Today",
    title: "Useful, still",
    body: "Most owners never time a lap. They keep it because it does one thing beautifully — the definition of a good object.",
  },
];

export function BodyTimeline() {
  return (
    <article className="mx-auto max-w-[760px] px-6 pt-[56px] pb-10">
      <BodyIntro className="mb-11 text-[20px]">
        How a stopwatch bolted to a wrist became the most quietly useful object a man can own. Five
        moments that mattered.
      </BodyIntro>
      <div className="flex flex-col">
        {TIMELINE.map((t) => (
          <div key={t.year} className="grid grid-cols-[110px_1fr] gap-[26px] pb-[30px]">
            <div className="font-grotesk font-semibold text-[22px] leading-none tracking-[-0.02em] text-mg-accentInk">
              {t.year}
            </div>
            <div className="relative border-l border-mg-bd/[0.14] pb-1 pl-6">
              <span className="absolute -left-[5px] top-1.5 h-[9px] w-[9px] rounded-full bg-mg-accent" />
              <h3 className="font-grotesk font-medium text-[20px] leading-[1.2] tracking-[-0.015em] text-mg-fg">
                {t.title}
              </h3>
              <p className="mt-2 font-grotesk font-light text-[15px] leading-[1.65] text-mg-fg/[0.68]">
                {t.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

// ── The Rundown ─────────────────────────────────────────────────────────────
const RUNDOWN = [
  {
    tag: "STYLE",
    title: "The overcoat is back, properly",
    body: "Not the cropped thing — a real one, mid-calf, in a cloth heavy enough to hang. Buy it before the weather makes you.",
  },
  {
    tag: "WATCH",
    title: "A quiet re-issue worth watching",
    body: "A 1960s field watch returns at 38mm, on a strap, without a press release. The good ones rarely shout.",
  },
  {
    tag: "CULTURE",
    title: "A film about doing one thing well",
    body: "Twelve minutes on a coachbuilder’s floor. Watch it with your phone in another room.",
  },
  {
    tag: "SHOP",
    title: "The card holder we keep restocking",
    body: "It sells out because it deserves to. Full grain, brown, better with age.",
  },
];

export function BodyRundown({ issue }: { issue: string }) {
  return (
    <article className="mx-auto max-w-[760px] px-6 pt-[56px] pb-10">
      <div className="mb-[26px] font-mono text-[10px] uppercase tracking-[0.2em] text-mg-fg/60">
        FILED {issue} · 4 things worth your attention
      </div>
      <div className="flex flex-col">
        {RUNDOWN.map((r) => (
          <div
            key={r.tag}
            className="grid grid-cols-[auto_1fr] gap-[18px] border-t border-mg-bd/10 py-[22px]"
          >
            <span className="pt-[5px] font-mono text-[11px] uppercase tracking-[0.14em] text-mg-accentInk">
              {r.tag}
            </span>
            <div>
              <h3 className="font-grotesk font-medium text-[20px] leading-[1.25] tracking-[-0.015em] text-mg-fg">
                {r.title}
              </h3>
              <p className="mt-2 font-grotesk font-light text-[15.5px] leading-[1.62] text-mg-fg/70">
                {r.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

// ── Manifesto ───────────────────────────────────────────────────────────────
const MANIFESTO = [
  "Buy fewer things, and buy them properly.",
  "Speed is cheap. Attention is the luxury.",
  "The best objects outlive the hands that made them.",
  "Considered, not hurried — it was always the better way.",
];

export function BodyManifesto() {
  return (
    <article className="mx-auto max-w-[900px] px-6 pt-16 pb-10 text-center">
      <div className="flex flex-col gap-11">
        {MANIFESTO.map((m) => (
          <p
            key={m}
            data-manrow
            className="font-serif italic text-[40px] leading-[1.24] text-mg-fg"
          >
            {m}
          </p>
        ))}
      </div>
    </article>
  );
}
