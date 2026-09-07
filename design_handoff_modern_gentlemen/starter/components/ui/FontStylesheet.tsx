import { libraryFontStylesheet } from "@/lib/domain/fontLibrary";

/** React hoists/deduplicates matching stylesheets; legacy fonts emit no node. */
export function FontStylesheet({ font }: { font?: string }) {
  const href = libraryFontStylesheet(font);
  return href ? <link rel="stylesheet" href={href} precedence="builder-fonts" /> : null;
}
