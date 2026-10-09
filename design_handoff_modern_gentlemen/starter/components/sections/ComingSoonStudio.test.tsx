import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  COMING_SOON_DESIGNS,
  comingSoonSections,
  comingSoonTemplateAreas,
  type ComingSoonId,
} from "@/lib/blocks/comingSoon";
import { collectContentMarkers, applyTemplate } from "@/lib/blocks/templateContent";
import { validateDocumentPayload } from "@/lib/services/documents";
import { collectMediaReferences } from "@/lib/blocks/media";
import type { Json } from "@/lib/db/database.types";
import { ComingSoonStudio } from "./ComingSoonStudio";
import { isReelDesign } from "@/lib/blocks/comingSoonReel";

afterEach(cleanup);

describe("Coming-soon page designs", () => {
  // CS21 and the sizzle-reel designs (CS22–CS35) have their own suites.
  it.each(COMING_SOON_DESIGNS.filter(([id]) => id !== "21" && !isReelDesign(id)))(
    "CS%s renders editable content and defaults to its intended tone",
    (variant, _, tone) => {
      const { container } = render(
        <ComingSoonStudio
          variant={variant}
          title="Our next chapter"
          intro="Owner copy"
          image="/images/style-mono.jpg"
          imageAlt="Owner photograph"
          details={[{ title: "A note", text: "Custom detail" }]}
          signature="The editors"
          mobileOrder="imageFirst"
          imagePosition="top"
        />
      );
      expect(screen.getByRole("heading", { level: 1, name: "Our next chapter" })).toBeTruthy();
      expect(screen.getByAltText("Owner photograph")).toBeTruthy();
      expect(screen.getByText("Custom detail")).toBeTruthy();
      const section = container.querySelector("section")!;
      expect(section.dataset).toMatchObject({
        comingSoon: variant,
        tone,
        mobileOrder: "imageFirst",
        imagePosition: "top",
      });
      expect(screen.queryByRole("textbox")).toBeNull();
    }
  );
  it.each(COMING_SOON_DESIGNS)(
    "CS%s creates valid independent drafts and preserves assigned page content",
    (variant) => {
      const sections = comingSoonSections(variant);
      const starterTitle = sections[0].settings!.title;
      expect(validateDocumentPayload("page", { sections } as Json).issues).toEqual([]);
      const areas = comingSoonTemplateAreas(variant);
      expect(validateDocumentPayload("template", { areas } as Json).issues).toEqual([]);
      expect(collectContentMarkers(areas.main)).toHaveLength(1);
      const pageContent = [
        { _key: "authored", _type: "nativeText", settings: { text: "Keep my page content" } },
      ];
      expect(applyTemplate(areas.main, pageContent).some((node) => node._key === "authored")).toBe(
        true
      );
      // CS21 seeds its photograph, the reel designs their /public video; the rest seed no media.
      if (variant !== "21" && !isReelDesign(variant))
        expect(collectMediaReferences(sections)).toEqual([]);
      sections[0].settings!.title = "Changed";
      expect(comingSoonSections(variant)[0].settings!.title).toBe(starterTitle);
    }
  );
  it("rejects an unknown starter rather than creating an empty or wrong draft", () => {
    expect(() => comingSoonSections("99" as ComingSoonId)).toThrow("Unknown");
  });
  it("uses optional real signup and safe action links", () => {
    const { rerender } = render(
      <ComingSoonStudio showSignup cta={{ label: "Unsafe", href: "javascript:alert(1)" }} />
    );
    expect(screen.getByRole("textbox", { name: "Email address" })).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    rerender(<ComingSoonStudio cta={{ label: "Editorial", href: "/articles" }} />);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("link", { name: /Editorial/ }).getAttribute("href")).toBe("/articles");
  });
});

describe("Reel designs and the After Hours launch date", () => {
  it("counts down to the After Hours date when the reel's own is empty", () => {
    render(
      <ComingSoonStudio
        variant="22"
        title="Coming soon"
        reel={{ countdown: { target: "" } }}
        afterHours={{ countdown: { target: "2099-01-15T18:00:00-05:00" } } as never}
      />
    );
    expect(document.body.textContent).not.toMatch(/––/);
  });
});

describe("Coming-soon fonts", () => {
  it("adds nothing until a font is chosen, then re-fonts every design through the theme roles", () => {
    const { container, rerender } = render(<ComingSoonStudio variant="05" title="Soon" />);
    expect(container.querySelector("[data-coming-soon-fonts]")).toBeNull();
    for (const variant of ["05", "21", "28"]) {
      rerender(
        <ComingSoonStudio
          variant={variant}
          title="Soon"
          fonts={{ heading: "webfont:brand-serif", label: "google:Lora", body: "not-a-font" }}
        />
      );
      const wrapper = container.querySelector<HTMLElement>("[data-coming-soon-fonts]")!;
      expect(wrapper.style.getPropertyValue("--font-heading")).toBe(
        "var(--mg-webfont-brand-serif,var(--font-body))"
      );
      expect(wrapper.style.getPropertyValue("--font-label")).toContain('"Lora"');
      expect(wrapper.style.getPropertyValue("--font-body")).toBe("");
      expect(wrapper.style.display).toBe("contents");
    }
  });
});
