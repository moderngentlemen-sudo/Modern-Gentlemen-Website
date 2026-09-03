import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { HERO_STUDIO_PRESETS } from "./heroStudioPresets";
import { SECTION_STUDIO_PRESETS } from "./sectionStudioPresets";

const designSource = readFileSync(
  join(__dirname, "../../../design_files/Modern Gentlemen Section Library.dc.html"),
  "utf8"
);
const compatibilityMap = readFileSync(join(__dirname, "../../../MODULE_MAP.md"), "utf8");

const sourceModules = [...designSource.matchAll(/id="lib-(\d+)"/g)].map((match) => match[1]);
const sourceCommentModules = [...designSource.matchAll(/<!-- =+\s+(\d+)\s+—\s+.+?\s+=+ -->/g)].map(
  (match) => match[1]
);

const nativePresets = [
  ...HERO_STUDIO_PRESETS.map((preset) => ({
    module: preset.module,
    reference: `heroStudio.${preset.value}`,
  })),
  ...SECTION_STUDIO_PRESETS.filter(([, module]) => Number(module) <= 125).map(
    ([value, module]) => ({ module, reference: `sectionStudio.${value}` })
  ),
].sort((left, right) => Number(left.module) - Number(right.module));

const ledgerRows = compatibilityMap.split("\n").flatMap((line) => {
  const match = /^\|\s*(\d+)\s*\|.+?\|\s*`((?:hero|section)Studio\.[^`]+)`\s*\|\s*(\w+)\s*\|$/.exec(
    line
  );
  return match ? [{ module: match[1], reference: match[2], status: match[3] }] : [];
});

describe("Section Library inventory", () => {
  it("matches every checked-in source module to one native preset", () => {
    expect(sourceModules).toHaveLength(125);
    expect(sourceCommentModules).toEqual(sourceModules);
    expect(sourceModules).toEqual([
      ...Array.from({ length: 99 }, (_, index) => String(index + 1).padStart(2, "0")),
      ...Array.from({ length: 26 }, (_, index) => String(index + 100)),
    ]);
    expect(nativePresets.map((preset) => preset.module)).toEqual(sourceModules);
  });

  it("keeps the compatibility ledger aligned with native preset identifiers", () => {
    expect(ledgerRows).toHaveLength(145);
    for (const preset of nativePresets) {
      expect(ledgerRows.find((row) => Number(row.module) === Number(preset.module))).toMatchObject({
        reference: preset.reference,
        status: "Native",
      });
    }
  });

  it("labels the 20 brief-derived CMS modules as additive platform presets", () => {
    const supplemental = SECTION_STUDIO_PRESETS.filter(([, module]) => Number(module) >= 126);
    expect(supplemental.map(([, module]) => module)).toEqual(
      Array.from({ length: 20 }, (_, index) => String(index + 126))
    );
    expect(ledgerRows.filter((row) => Number(row.module) >= 126).map((row) => row.status)).toEqual(
      Array.from({ length: 20 }, () => "Platform")
    );
  });
});
