import { clsx } from "../ui/clsx";
import Image from "next/image";

/** Red mono kicker "{CATEGORY} · NO. {issue}" — bright accent, all heroes. */
export function ArticleKicker({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx("font-mono text-[11px] uppercase tracking-[0.26em] text-[#ff4d5e]", className)}>{children}</div>;
}

/** Muted mono byline "WORDS · {AUTHOR} · {read} READ [· PHOTOGRAPHY · …]". */
export function Byline({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx("font-mono text-[10px] uppercase tracking-[0.18em]", className)}>{children}</div>;
}

/** Serif-italic dek/standfirst. Size + color set by the caller. */
export function Dek({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={clsx("font-serif italic text-pretty", className)}>{children}</p>;
}

/** Absolute cover image for a hero media band. */
export function HeroImg({ src }: { src: string }) {
  return <Image src={src} alt="" fill priority sizes="100vw" className="object-cover" />;
}

/** Muted lead-in paragraph used by several structured bodies. */
export function BodyIntro({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={clsx("font-grotesk font-light leading-[1.7] text-mg-fg/70 text-pretty", className)}>{children}</p>;
}

/** Inline centered pull-quote (Prose body) — matches PullQuote's look, inline. */
export function InlinePullQuote({ quote }: { quote: string }) {
  return (
    <blockquote className="my-[48px] text-center font-serif italic text-[34px] leading-[1.25] text-mg-fg">
      <span className="text-mg-accent">&ldquo;</span>
      {quote}
      <span className="text-mg-accent">&rdquo;</span>
    </blockquote>
  );
}

/** Author card at the foot of the Prose body. */
export function AuthorCard({ author, initial }: { author: string; initial: string }) {
  return (
    <div className="mt-[52px] flex items-center gap-[18px] border-t border-mg-bd/[0.12] pt-7">
      <div className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-full bg-mg-accent font-grotesk font-medium text-[18px] text-white">
        {initial}
      </div>
      <div>
        <div className="font-grotesk font-medium text-[15px] text-mg-fg">{author}</div>
        <div className="mt-[3px] font-serif italic text-[13px] leading-[1.5] text-mg-fg/55">
          Contributing editor, on style, stewardship, and the considered life.
        </div>
      </div>
    </div>
  );
}
