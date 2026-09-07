// Manual refresh only. Runtime builds never depend on the metadata endpoint.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { format } from "prettier";
const source = "https://fonts.google.com/metadata/fonts";
const raw = process.argv[2]
  ? readFileSync(process.argv[2], "utf8")
  : await (await fetch(source, { signal: AbortSignal.timeout(20000) })).text();
const data = JSON.parse(raw);
const families = data.familyMetadataList
  .map((font) => {
    if (!font.isOpenSource || !/^[A-Za-z0-9 .-]+$/.test(font.family))
      throw Error("Unexpected font metadata");
    const variants = Object.keys(font.fonts).sort(
      (a, b) => Number(a.endsWith("i")) - Number(b.endsWith("i")) || parseInt(a) - parseInt(b)
    );
    if (!variants.length || variants.some((v) => !/^(?:[1-9][0-9]{0,2}|1000)i?$/.test(v)))
      throw Error("Invalid variants");
    return [font.family, font.category, variants.join(",")];
  })
  .sort((a, b) => a[0].localeCompare(b[0], "en"));
if (families.length < 1000 || new Set(families.map((f) => f[0])).size !== families.length)
  throw Error("Incomplete catalogue");
const destination = new URL("../lib/domain/googleFonts.json", import.meta.url);
// Keep existing ids/variants reproducible. Changing old entries is a separate,
// reviewed operation; a provider catalogue refresh must not invalidate content.
const existing = existsSync(destination)
  ? JSON.parse(readFileSync(destination, "utf8")).families
  : [];
const merged = new Map(families.map((font) => [font[0], font]));
for (const font of existing) merged.set(font[0], font);
const combined = [...merged.values()].sort((a, b) => a[0].localeCompare(b[0], "en"));
writeFileSync(
  destination,
  await format(
    JSON.stringify({
      source,
      retrieved: new Date().toISOString().slice(0, 10),
      families: combined,
    }),
    { parser: "json" }
  )
);
console.log(`Saved ${combined.length} font families. Review the diff before committing.`);
