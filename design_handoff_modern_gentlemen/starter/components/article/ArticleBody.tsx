import type { BodyVariant } from "@/lib/domain/articles";
import {
  BodyProse,
  BodyEssay,
  BodyLetter,
  BodyFilm,
  BodyProfile,
  BodyReview,
} from "./bodies-prose";
import {
  BodyQa,
  BodyAsk,
  BodySpec,
  BodyPhoto,
  BodyGallery,
  BodyList,
  BodySteps,
  BodyRegimen,
  BodyTimeline,
  BodyRundown,
  BodyManifesto,
} from "./bodies-structured";

interface Props {
  variant: BodyVariant;
  author: string;
  authorInitial: string;
  issue: string;
}

/** Article body dispatcher — 17 variants selected by the article's template. */
export function ArticleBody({ variant, author, authorInitial, issue }: Props) {
  switch (variant) {
    case "prose":
      return <BodyProse author={author} authorInitial={authorInitial} />;
    case "essay":
      return <BodyEssay />;
    case "letter":
      return <BodyLetter author={author} />;
    case "qa":
      return <BodyQa />;
    case "ask":
      return <BodyAsk />;
    case "profile":
      return <BodyProfile />;
    case "review":
      return <BodyReview />;
    case "spec":
      return <BodySpec />;
    case "photo":
      return <BodyPhoto />;
    case "gallery":
      return <BodyGallery />;
    case "film":
      return <BodyFilm />;
    case "list":
      return <BodyList />;
    case "steps":
      return <BodySteps />;
    case "regimen":
      return <BodyRegimen />;
    case "timeline":
      return <BodyTimeline />;
    case "rundown":
      return <BodyRundown issue={issue} />;
    case "manifesto":
      return <BodyManifesto />;
    default:
      return <BodyProse author={author} authorInitial={authorInitial} />;
  }
}
