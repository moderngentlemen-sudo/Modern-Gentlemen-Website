import { ArticleKicker, Byline, Dek, HeroImg } from "./primitives";
import { HeroVideo } from "./HeroVideo";
import type { ArticlePresentation, HeroVariant } from "@/lib/domain/articles";

interface HeroProps {
  variant: HeroVariant;
  kicker: string;
  title: string;
  dek?: string;
  byline: string;
  image?: string;
  videoUrl?: string;
  presentation?: ArticlePresentation;
}

/**
 * Article hero dispatcher — 9 variants selected by the article's template.
 * Full-bleed image heroes cancel the fixed-header reserve with -mt-[72px];
 * text heroes sit inside it with reduced top padding (prototype top − 72px).
 * All specs transcribed from design_files/MG Article.dc.html.
 */
export function ArticleHero(props: HeroProps) {
  const headerMode = props.presentation?.headerMode ?? "template";
  if (headerMode === "none") return null;
  if (headerMode === "titleOnly") return <HeroTitleOnly {...props} />;
  const variant: HeroVariant =
    headerMode === "standard"
      ? "contained"
      : headerMode === "large"
        ? "masthead"
        : headerMode === "largeMedia"
          ? "wide"
          : headerMode === "full"
            ? "full"
            : props.variant;

  switch (variant) {
    case "full":
      return <HeroFull {...props} />;
    case "contained":
      return <HeroContained {...props} />;
    case "cover":
      return <HeroCover {...props} />;
    case "wide":
      return <HeroWide {...props} />;
    case "portrait":
      return <HeroPortrait {...props} />;
    case "split":
      return <HeroSplit {...props} />;
    case "masthead":
      return <HeroMasthead {...props} />;
    case "video":
      return (
        <HeroVideo
          kicker={props.kicker}
          title={props.title}
          byline={props.byline}
          videoUrl={props.videoUrl ?? ""}
          poster={props.image}
          appearance={props.presentation?.appearance}
        />
      );
    case "centered":
    default:
      return <HeroCentered {...props} />;
  }
}

function HeroFull({ kicker, title, dek, byline, image, presentation }: HeroProps) {
  return (
    <section
      data-darkband
      {...appearanceData(presentation)}
      className="relative -mt-[72px] bg-[#0d0d0d] text-[#f4f4f4]"
    >
      <div data-hero-media className="relative h-[80vh] min-h-[540px] overflow-hidden">
        {image && <HeroImg src={image} />}
        <div data-scrim className="pointer-events-none absolute inset-0" />
      </div>
      <div className="absolute inset-x-0 bottom-0 px-6 pb-[60px] text-center">
        <div className="mx-auto max-w-[960px]">
          <ArticleKicker className="mb-[18px]">{kicker}</ArticleKicker>
          <h1
            data-title-xl
            className="font-grotesk font-semibold text-[74px] leading-[0.98] tracking-[-0.045em] text-balance"
          >
            {title}
          </h1>
          {dek && (
            <Dek className="mx-auto mt-[22px] max-w-[620px] text-[17px] min-[681px]:text-[21px] leading-[1.45] text-mg-fg/85">
              {dek}
            </Dek>
          )}
          <Byline className="mt-[26px] text-mg-fg/[0.62]">{byline}</Byline>
        </div>
      </div>
    </section>
  );
}

function HeroContained({ kicker, title, dek, byline, image, presentation }: HeroProps) {
  return (
    <section {...appearanceData(presentation)} className="mx-auto max-w-[1120px] px-6 pt-[48px]">
      <div className="max-w-[760px]">
        <ArticleKicker className="mb-4">{kicker}</ArticleKicker>
        <h1
          data-title-lg
          className="font-grotesk font-semibold text-[56px] leading-none tracking-[-0.04em] text-balance"
        >
          {title}
        </h1>
        {dek && (
          <Dek className="mt-5 max-w-[600px] text-[20px] leading-[1.45] text-mg-fg/70">{dek}</Dek>
        )}
        <Byline className="mt-[22px] text-mg-fg/60">{byline}</Byline>
      </div>
      {image && (
        <div data-hero-media className="relative mt-9 h-[52vh] min-h-[360px] overflow-hidden">
          <HeroImg src={image} />
        </div>
      )}
    </section>
  );
}

function HeroCover({ kicker, title, dek, byline, image, presentation }: HeroProps) {
  return (
    <section
      data-darkband
      {...appearanceData(presentation)}
      className="relative -mt-[72px] bg-[#0d0d0d] text-[#f4f4f4]"
    >
      <div data-hero-media className="relative h-[90vh] min-h-[600px] overflow-hidden">
        {image && <HeroImg src={image} />}
        <div data-scrim className="pointer-events-none absolute inset-0" />
      </div>
      <div
        className="absolute inset-x-0 bottom-0 pb-[56px]"
        style={{
          paddingInline: "max(24px, calc((100% - var(--layout-content-width)) / 2))",
        }}
      >
        <ArticleKicker className="mb-4">{kicker}</ArticleKicker>
        <h1
          data-title-xl
          className="max-w-[12ch] font-grotesk font-bold text-[108px] leading-[0.9] tracking-[-0.05em] text-balance"
        >
          {title}
        </h1>
        {dek && (
          <Dek className="mt-[22px] max-w-[520px] text-[17px] min-[681px]:text-[21px] leading-[1.4] text-mg-fg/85">
            {dek}
          </Dek>
        )}
        <Byline className="mt-[22px] text-mg-fg/[0.62]">{byline}</Byline>
      </div>
    </section>
  );
}

function HeroWide({ kicker, title, dek, byline, image, presentation }: HeroProps) {
  return (
    <section
      data-darkband
      {...appearanceData(presentation)}
      className="relative -mt-[72px] bg-[#0d0d0d] text-[#f4f4f4]"
    >
      <div data-hero-media className="relative h-[62vh] min-h-[440px] overflow-hidden">
        {image && <HeroImg src={image} />}
        <div data-scrim className="pointer-events-none absolute inset-0" />
      </div>
      <div className="relative mx-auto -mt-[90px] max-w-[900px] px-6 text-center">
        <ArticleKicker className="mb-4">{kicker}</ArticleKicker>
        <h1
          data-title-xl
          className="font-grotesk font-semibold text-[64px] leading-[0.98] tracking-[-0.045em] text-balance"
        >
          {title}
        </h1>
        {dek && (
          <Dek className="mx-auto mt-5 max-w-[560px] text-[20px] leading-[1.45] text-mg-fg/[0.82]">
            {dek}
          </Dek>
        )}
        <Byline className="mt-5 text-mg-fg/60">{byline}</Byline>
      </div>
    </section>
  );
}

function HeroPortrait({ kicker, title, byline, image, presentation }: HeroProps) {
  return (
    <section
      data-darkband
      {...appearanceData(presentation)}
      className="relative -mt-[72px] bg-[#0d0d0d] text-[#f4f4f4]"
    >
      <div data-hero-media className="relative h-[74vh] min-h-[520px] overflow-hidden">
        {image && <HeroImg src={image} />}
        <div data-scrim className="pointer-events-none absolute inset-0" />
      </div>
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[1120px] px-6 pb-[54px]">
        <ArticleKicker className="mb-4">{kicker}</ArticleKicker>
        <h1
          data-title-lg
          className="max-w-[16ch] font-grotesk font-semibold text-[62px] leading-[0.98] tracking-[-0.045em] text-balance"
        >
          {title}
        </h1>
        <Byline className="mt-5 text-mg-fg/[0.62]">{byline}</Byline>
      </div>
    </section>
  );
}

function HeroSplit({ kicker, title, dek, byline, image, presentation }: HeroProps) {
  return (
    <section
      data-split
      {...appearanceData(presentation)}
      className="mx-auto grid max-w-[var(--layout-content-width)] grid-cols-1 items-center gap-[48px] pt-[48px] pb-5 min-[821px]:grid-cols-2"
      style={{
        paddingInline: "max(24px, calc((100% - var(--layout-content-width)) / 2))",
      }}
    >
      <div>
        <ArticleKicker className="mb-4">{kicker}</ArticleKicker>
        <h1
          data-title-lg
          className="font-grotesk font-semibold text-[60px] leading-[0.98] tracking-[-0.045em] text-balance"
        >
          {title}
        </h1>
        {dek && <Dek className="mt-5 text-[20px] leading-[1.45] text-mg-fg/[0.72]">{dek}</Dek>}
        <Byline className="mt-[22px] text-mg-fg/60">{byline}</Byline>
      </div>
      {image && (
        <div data-splitimg className="relative h-[60vh] min-h-[440px] overflow-hidden">
          <HeroImg src={image} />
        </div>
      )}
    </section>
  );
}

function HeroMasthead({ kicker, title, dek, byline, presentation }: HeroProps) {
  return (
    <section
      {...appearanceData(presentation)}
      className="mx-auto max-w-[900px] px-6 pt-[78px] pb-2"
    >
      <div className="mb-[30px] h-[3px] w-[54px] bg-mg-accent" />
      <ArticleKicker className="mb-5">{kicker}</ArticleKicker>
      <h1
        data-title-xl
        className="font-grotesk font-semibold text-[72px] leading-none tracking-[-0.045em] text-balance"
      >
        {title}
      </h1>
      {dek && (
        <Dek className="mt-[26px] max-w-[640px] text-[23px] leading-[1.45] text-mg-fg/75">
          {dek}
        </Dek>
      )}
      <Byline className="mt-[26px] border-t border-mg-bd/[0.12] pt-[22px] text-mg-fg/60">
        {byline}
      </Byline>
    </section>
  );
}

function HeroCentered({ kicker, title, dek, byline, presentation }: HeroProps) {
  return (
    <section
      {...appearanceData(presentation)}
      className="mx-auto max-w-[820px] px-6 pt-[78px] pb-2 text-center"
    >
      <ArticleKicker className="mb-5">{kicker}</ArticleKicker>
      <h1
        data-title-lg
        className="font-grotesk font-semibold text-[60px] leading-none tracking-[-0.04em] text-balance"
      >
        {title}
      </h1>
      {dek && (
        <Dek className="mx-auto mt-6 max-w-[560px] text-[22px] leading-[1.45] text-mg-fg/75">
          {dek}
        </Dek>
      )}
      <Byline className="mt-6 text-mg-fg/60">{byline}</Byline>
    </section>
  );
}

function HeroTitleOnly({ title, presentation }: HeroProps) {
  return (
    <section
      {...appearanceData(presentation)}
      className="mx-auto max-w-[1000px] px-6 pt-[78px] pb-4 text-center"
    >
      <h1
        data-title-xl
        className="font-grotesk text-[72px] font-semibold leading-none tracking-[-0.045em] text-balance"
      >
        {title}
      </h1>
    </section>
  );
}

function appearanceData(presentation: ArticlePresentation | undefined) {
  return presentation?.appearance && presentation.appearance !== "template"
    ? { "data-article-appearance": presentation.appearance }
    : {};
}
