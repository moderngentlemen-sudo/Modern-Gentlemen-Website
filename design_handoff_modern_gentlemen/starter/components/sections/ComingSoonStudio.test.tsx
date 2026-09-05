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

afterEach(cleanup);

describe("Coming-soon page designs", () => {
  it.each(COMING_SOON_DESIGNS)(
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
      expect(collectMediaReferences(sections)).toEqual([]);
      sections[0].settings!.title = "Changed";
      expect(comingSoonSections(variant)[0].settings!.title).toBe("Coming soon");
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
