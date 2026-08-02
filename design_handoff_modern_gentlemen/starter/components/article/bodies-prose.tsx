import { HeroImg, InlinePullQuote, AuthorCard } from "./primitives";

/**
 * Narrative body variants (prose reading column). Body *content* is fixed per
 * variant (demo data), transcribed verbatim from MG Article.dc.html — the
 * prototype's own model. Prose/Letter take the article's author for their
 * author card / sign-off.
 */

const BODY = "font-grotesk font-light text-mg-fg/[0.86]";

export function BodyProse({ author, authorInitial }: { author: string; authorInitial: string }) {
  return (
    <article className="mx-auto max-w-[720px] px-6 pt-[72px] pb-10">
      <div data-body className={`${BODY} text-[19px] leading-[1.72]`}>
        <p data-lede>
          There is a particular kind of composure that belongs to the man who is never rushed. He
          arrives before the room fills, orders without hurry, and leaves the impression that time
          is something he keeps rather than chases. It is not a trick of the diary. It is a
          discipline — and, increasingly, a rarity.
        </p>
        <p>
          We have confused speed with seriousness. The faster the reply, the more we assume it
          matters; the busier the calendar, the more important the man. But urgency is cheap, and it
          flatters no one for long. What endures is the opposite instinct: the willingness to move
          deliberately, to let a thing take the time it actually requires.
        </p>
        <h2 className="mt-11 mb-[18px] font-grotesk font-semibold text-[30px] leading-[1.1] tracking-[-0.03em] text-mg-fg">
          Patience as a Material
        </h2>
        <p>
          Consider the objects that outlast us — a well-made watch, a hand-welted shoe, a car built
          to be kept rather than replaced. None of them were made quickly. Their quality is
          inseparable from the hours poured into them, and we recognise it instantly, even when we
          cannot name what we are looking at.
        </p>
        <figure data-figure className="my-10 -mx-10">
          <div className="relative h-[420px] overflow-hidden">
            <HeroImg src="/images/film-workshop.jpg" />
          </div>
          <figcaption className="mt-3 text-center font-mono text-[11px] tracking-[0.14em] text-mg-fg/40">
            Slow work, kept honest — the coachbuilder&apos;s floor, unhurried.
          </figcaption>
        </figure>
        <InlinePullQuote quote="The gentleman who arrives early has already decided that his attention is worth protecting." />
        <p>
          To arrive early is to refuse the small panic that governs most days. It buys a margin — a
          few unclaimed minutes in which to notice the room, gather a thought, and greet the person
          in front of you as if they were the only appointment that mattered. That margin is the
          whole point.
        </p>
        <p>
          None of this requires a slower world. It requires a slower self, held steady inside a fast
          one. Choose the things worth waiting for, give them the hours they deserve, and let
          everything else move at whatever speed it likes.
        </p>
      </div>
      <AuthorCard author={author} initial={authorInitial} />
    </article>
  );
}

export function BodyEssay() {
  return (
    <article className="mx-auto max-w-[740px] px-6 pt-16 pb-10">
      <div data-body className={`${BODY} text-[19px] leading-[1.74]`}>
        <p data-lede>
          The fastest car on the road is rarely the most interesting one in the room. Somewhere
          between the spec sheet and the driveway, we started mistaking acceleration for character —
          as if a machine&apos;s worth could be read off a stopwatch.
        </p>
        <p>
          It cannot. The cars that hold us are the ones that ask something of the driver: a
          heel-and-toe downshift, a corner taken on trust, an engine that rewards patience rather
          than punishing hesitation. Speed is a number. Involvement is a relationship.
        </p>
        <h2 className="mt-[46px] mb-4 font-grotesk font-semibold text-[28px] leading-[1.12] tracking-[-0.03em] text-mg-fg">
          The tyranny of the number
        </h2>
        <p>
          Zero to sixty has become the only figure anyone quotes, and it flatters the wrong virtues.
          It rewards mass, electronics and grip — never feel, never sound, never the slow bloom of
          confidence that comes from knowing a machine well.
        </p>
        <h2 className="mt-[46px] mb-4 font-grotesk font-semibold text-[28px] leading-[1.12] tracking-[-0.03em] text-mg-fg">
          In praise of the slow car, driven fast
        </h2>
        <p>
          Give a man a modest car and an honest road and he will find more joy than any hypercar
          offers in traffic. The lesson travels well beyond driving: the good life is not the
          quickest one. It is the one you are actually present for.
        </p>
      </div>
    </article>
  );
}

export function BodyLetter({ author }: { author: string }) {
  return (
    <article className="mx-auto max-w-[680px] px-6 pt-[56px] pb-10">
      <div data-body className={`${BODY} text-[20px] leading-[1.8]`}>
        <p>Dear reader,</p>
        <p>
          We started Modern Gentlemen with a small, stubborn belief: that taste is not nostalgia,
          and that caring about how things are made is not the same as living in the past. This
          issue is our argument for that belief, told through the men and workshops who prove it
          every day.
        </p>
        <p>
          You will find no life hacks here. No ten-step routines, no productivity gospel. Only a few
          things worth doing properly, described as honestly as we know how. If a single page sends
          you to the barber you&apos;ve been meaning to try, or the watchmaker who services rather
          than sells, it will have done its job.
        </p>
        <p>Read it slowly. That is rather the point.</p>
      </div>
      <div className="mt-10">
        <div className="font-serif italic text-[34px] leading-none text-mg-fg">{author}</div>
        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-mg-fg/50">
          Editor-in-Chief · Modern Gentlemen
        </div>
      </div>
    </article>
  );
}

export function BodyFilm() {
  const credits = [
    { label: "Directed by", value: "D. Whitfield" },
    { label: "Runtime", value: "12:04" },
    { label: "Series", value: "MG Film · No. 12" },
  ];
  return (
    <article className="mx-auto max-w-[820px] px-6 pt-[60px] pb-10">
      <div data-body className={`${BODY} text-[19px] leading-[1.72]`}>
        <p data-lede>
          Twelve minutes on the last men shaping aluminium by hand. No narration, no music
          you&apos;ll remember — just the sound of a craft that refuses to be hurried.
        </p>
        <p>
          We filmed across three mornings and cut almost none of it. What you&apos;re watching is
          roughly the pace of the work itself, which was rather the point.
        </p>
      </div>
      <div className="mt-9 grid grid-cols-3 gap-5 border-t border-mg-bd/[0.12] pt-[26px]">
        {credits.map((c) => (
          <div key={c.label}>
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-mg-fg/45">
              {c.label}
            </div>
            <div className="mt-1.5 font-grotesk font-medium text-[15px] text-mg-fg">{c.value}</div>
          </div>
        ))}
      </div>
    </article>
  );
}

export function BodyProfile() {
  const stats = [
    { k: "CRAFT", v: "Coachbuilder" },
    { k: "BASED", v: "The Cotswolds" },
    { k: "PRACTISING SINCE", v: "1984" },
    { k: "COMMISSIONS / YR", v: "Six, at most" },
  ];
  return (
    <article className="mx-auto grid max-w-[1120px] grid-cols-1 items-start gap-[48px] px-6 pt-[56px] pb-10 min-[821px]:grid-cols-[260px_1fr]">
      <aside className="flex flex-col gap-px overflow-hidden border border-mg-bd/[0.09] bg-mg-bd/[0.09] min-[821px]:sticky min-[821px]:top-[90px]">
        {stats.map((s) => (
          <div key={s.k} className="bg-mg-surface p-[18px_20px]">
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-mg-fg/45">
              {s.k}
            </div>
            <div className="mt-1.5 font-grotesk font-medium text-[17px] text-mg-fg">{s.v}</div>
          </div>
        ))}
      </aside>
      <div data-body className={`${BODY} text-[19px] leading-[1.72]`}>
        <p data-lede>
          He works in a shed that smells of linseed and hot metal, in a village most maps forget.
          For four decades he has restored the cars other people gave up on — and turned away more
          commissions than he has accepted.
        </p>
        <p>
          &ldquo;A car tells you how it wants to be saved,&rdquo; he says, without looking up.
          &ldquo;Your job is to listen and not to hurry it.&rdquo; It is a philosophy that has made
          him quietly famous among the people who matter and comfortably invisible to everyone else.
        </p>
        <p>
          What he sells is not speed or shine. It is continuity — the sense that an object can
          outlive the hands that made it, and the hands that saved it, and still mean something to
          whoever comes next.
        </p>
      </div>
    </article>
  );
}

export function BodyReview() {
  return (
    <article className="mx-auto max-w-[760px] px-6 pt-[56px] pb-10">
      <div className="mb-10 grid grid-cols-[1fr_auto] items-center gap-6 border border-mg-bd/[0.12] bg-mg-surface p-[26px_30px]">
        <div>
          <div className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[#ff4d5e]">
            The Verdict
          </div>
          <div className="font-serif italic text-[19px] leading-[1.4] text-mg-fg/[0.82]">
            Beautifully made and quietly confident — a keeper, not a talking point.
          </div>
        </div>
        <div className="flex-shrink-0 text-center">
          <div className="font-grotesk font-semibold text-[52px] leading-none tracking-[-0.04em] text-mg-accent">
            8.6
          </div>
          <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-mg-fg/40">
            Out of 10
          </div>
        </div>
      </div>
      <div className="mb-9 grid grid-cols-2 gap-4">
        <div className=" border border-mg-bd/10 p-[20px_22px]">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#4ade80]">
            For
          </div>
          <div className="font-grotesk font-light text-[15px] leading-[1.7] text-mg-fg/80">
            Beautifully finished. Ages honestly. The kind of thing you stop noticing you own, in the
            best way.
          </div>
        </div>
        <div className=" border border-mg-bd/10 p-[20px_22px]">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#ff4d5e]">
            Against
          </div>
          <div className="font-grotesk font-light text-[15px] leading-[1.7] text-mg-fg/80">
            Priced for patience. The waiting list is real, and the colours you actually want are
            always the slow ones.
          </div>
        </div>
      </div>
      <div data-body className={`${BODY} text-[19px] leading-[1.72]`}>
        <p data-lede>
          We lived with it for a month before writing a word — the only honest way to review
          anything meant to last years. The first impression flatters; the fourth week tells the
          truth.
        </p>
        <p>
          It passed. Not because it is flawless, but because its flaws are the interesting kind —
          the compromises of something made with a point of view rather than a focus group. You buy
          it once. That is rather the review.
        </p>
      </div>
    </article>
  );
}
