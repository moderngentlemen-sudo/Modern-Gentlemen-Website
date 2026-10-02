import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MG_SIGNATURE_SECTIONS, signatureType } from "@/lib/blocks/mgSignatureSections";
import { newBlockNode } from "@/components/admin/builder/node";
import { signaturePreview } from "@/components/admin/builder/signaturePreview";
import { collectMediaReferences } from "@/lib/blocks/media";
import { normalizeBlock } from "@/lib/blocks/normalize";
import { validateBlock } from "@/lib/blocks/validate";
import { SectionRenderer } from "@/components/SectionRenderer";
import { blockCatalogFor } from "./registry";

afterEach(cleanup);

describe("MG signature collection integration", () => {
  it("offers all 24 sections in the existing page, category and template libraries", () => {
    expect(MG_SIGNATURE_SECTIONS).toHaveLength(24);
    for (const document of ["page", "category", "template", "article"]) {
      const catalog = blockCatalogFor(document);
      for (const { id } of MG_SIGNATURE_SECTIONS)
        expect(catalog.some(({ type }) => type === signatureType(id))).toBe(true);
    }
  });

  it.each(MG_SIGNATURE_SECTIONS)(
    "$id inserts, serializes, validates and renders authored content",
    ({ id }) => {
      const node = newBlockNode(signatureType(id));
      node.settings = {
        ...normalizeBlock(node),
        title: "An authored title",
        intro: "An authored introduction",
        image: "/images/style-mono.jpg",
        imageAlt: "Authored feature description",
        cta: { label: "Explore this story", href: "/articles" },
        tone: "dark",
        spacing: "compact",
        imagePosition: "top",
        items: [
          {
            title: "Authored entry",
            text: "An authored answer",
            meta: "Authored label",
            detail: "Authored detail",
            image: "/images/watch-gear.jpg",
            alt: "Authored entry description",
            href: "/article/example",
          },
        ],
      };
      const restored = JSON.parse(JSON.stringify(node));
      expect(validateBlock(restored).ok).toBe(true);
      const { container } = render(<SectionRenderer sections={[restored]} />);
      expect(screen.getByRole("heading", { name: "An authored title" })).toBeInTheDocument();
      expect(screen.getByText("An authored introduction")).toBeInTheDocument();
      expect(screen.getByAltText("Authored feature description")).toBeInTheDocument();
      expect(screen.getByAltText("Authored entry description")).toBeInTheDocument();
      expect(screen.getByText("An authored answer")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Explore this story/ })).toHaveAttribute(
        "href",
        "/articles"
      );
      expect(container.querySelector("section")).toHaveAttribute("data-tone", "dark");
      expect(container.querySelector("section")).toHaveAttribute("data-spacing", "compact");
      expect(container.querySelector("section")).toHaveAttribute("data-focal", "top");
      expect(
        collectMediaReferences([restored])
          .map(({ url }) => url)
          .sort()
      ).toEqual(["/images/style-mono.jpg", "/images/watch-gear.jpg"]);
    }
  );

  it("keeps preview images and edits to one insertion out of other saved sections", () => {
    for (const { id } of MG_SIGNATURE_SECTIONS) {
      const one = newBlockNode(signatureType(id));
      const two = newBlockNode(signatureType(id));
      expect(collectMediaReferences([one])).toEqual([]);
      expect(one._key).not.toBe(two._key);
      const entries = one.settings?.items as { title: string }[];
      entries[0].title = "Edited only here";
      expect((two.settings?.items as { title: string }[])[0].title).not.toBe("Edited only here");
    }
    expect(signaturePreview("mgSignature_residence")).toHaveProperty("image");
  });

  it("refuses executable destinations, preserves text as text and always discloses partner content", () => {
    const node = newBlockNode(signatureType("brandPerspective"));
    node.settings = {
      ...node.settings,
      title: "<img onerror=alert(1)>",
      disclosure: "",
      cta: { label: "Unsafe action", href: "javascript:alert(1)" },
      items: [{ title: "Unsafe entry", href: "//untrusted.example/path" }],
    };
    const { container } = render(<SectionRenderer sections={[node]} />);
    expect(screen.getByText("Partner story")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "<img onerror=alert(1)>" })).toBeInTheDocument();
    expect(container.querySelectorAll("a, img")).toHaveLength(0);
  });

  it("uses native disclosures for interviews and real headers for comparisons", () => {
    const interview = newBlockNode(signatureType("inGoodCompany"));
    const comparison = newBlockNode(signatureType("collectorComparison"));
    const { container } = render(<SectionRenderer sections={[interview, comparison]} />);
    expect(container.querySelectorAll("details > summary")).toHaveLength(3);
    expect(screen.getByRole("table")).toHaveAccessibleName("A closer comparison.");
    expect(screen.getAllByRole("columnheader")).toHaveLength(4);
    expect(screen.getAllByRole("rowheader")).toHaveLength(3);
  });
});
