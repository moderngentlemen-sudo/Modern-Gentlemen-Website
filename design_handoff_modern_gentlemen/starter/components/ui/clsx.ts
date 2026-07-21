/** Tiny classnames joiner — drop in favor of `clsx`/`cn` if the repo has one. */
export function clsx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
