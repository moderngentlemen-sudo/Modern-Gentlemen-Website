import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  EDITORIAL_COLLECTION,
  collectionType,
  collectionArticlePresets,
} from "@/lib/domain/editorialCollection";
import { collectionDraft } from "@/lib/blocks/editorialCollection";
import { collectMediaReferences } from "@/lib/blocks/media";
import { validateBlock } from "@/lib/blocks/validate";
import { normalizeBlock } from "@/lib/blocks/normalize";
import { newBlockNode } from "@/components/admin/builder/node";
import { SectionRenderer } from "@/components/SectionRenderer";
import { articlePresentationOf } from "@/lib/domain/articles";
import { articleDesignSchema } from "@/lib/domain/articleDesign";
import { blockCatalogFor } from "./registry";
import { EditorialCollection } from "./EditorialCollection";

describe("MG 90 collection", () => {
  it("ships a complete reference image for every numbered design", () => {
    for (const concept of EDITORIAL_COLLECTION) {
      const bytes = readFileSync(join(process.cwd(), "public", concept.reference.slice(1)));
      expect(bytes.length, concept.id).toBeGreaterThan(1000);
      expect(bytes.subarray(0, 4).toString(), concept.id).toBe("RIFF");
      expect(bytes.subarray(8, 12).toString(), concept.id).toBe("WEBP");
      expect(bytes.readUInt32LE(4), concept.id).toBe(bytes.length - 8);
    }
  });

  it("offers all 60 sections and 30 article structures in their relevant editors", () => {
    expect(EDITORIAL_COLLECTION).toHaveLength(90);
    expect(new Set(EDITORIAL_COLLECTION.map((c) => c.id)).size).toBe(90);
    expect(collectionArticlePresets).toHaveLength(30);
    const pages = blockCatalogFor("page").map((c) => c.type);
    const articles = blockCatalogFor("article").map((c) => c.type);
    for (const c of EDITORIAL_COLLECTION) {
      expect(articles).toContain(collectionType(c.id));
      expect(pages.includes(collectionType(c.id))).toBe(c.kind === "section");
    }
  });
  it.each(EDITORIAL_COLLECTION)(
    "$id survives creation, editing, serialization, validation and public rendering",
    (c) => {
      const draft = collectionDraft(
        c.id,
        c.kind === "article" ? "article" : "page",
        "An authored story",
        "authored-story"
      );
      const node = draft.sections[0];
      node.settings = {
        ...normalizeBlock(node),
        intro: "Authored opening paragraphs.",
        items: [
          {
            title: "An authored chapter",
            text: "A **meaningful** passage.",
            image: "/images/hero-cover.jpg",
            alt: "Authored photograph",
            href: "/article/authored-story",
          },
        ],
      };
      const restored = JSON.parse(JSON.stringify(node));
      expect(validateBlock(restored).ok).toBe(true);
      expect(collectMediaReferences([restored]).map((r) => r.url)).toContain(
        "/images/hero-cover.jpg"
      );
      const { container } = render(<SectionRenderer sections={[restored]} />);
      expect(container.querySelector(`[data-mg-collection="${c.id}"]`)).toBeInTheDocument();
      expect(screen.getByText("Authored opening paragraphs.")).toBeInTheDocument();
      if (c.id !== "11")
        expect(screen.getAllByAltText("Authored photograph").length).toBeGreaterThan(0);
      if (c.kind === "article") {
        const design = articlePresentationOf(draft).design;
        expect(articleDesignSchema.parse(design).preset).toBe(`collection-${c.id}`);
      }
    }
  );
  it("keeps reference mockups out of drafts and rejects mismatched document types", () => {
    for (const c of EDITORIAL_COLLECTION) {
      const node = newBlockNode(collectionType(c.id));
      expect(collectMediaReferences([node])).toEqual([]);
      expect(JSON.stringify(node)).not.toContain("/images/editorial-collection/");
    }
    expect(() => collectionDraft("61", "page", "Title", "slug")).toThrow();
    expect(() => collectionDraft("01", "article", "Title", "slug")).toThrow();
    expect(() => collectionDraft("99", "article", "Title", "slug")).toThrow();
  });
  it("filters authored categories and switches selected material details", () => {
    const entries = [
      { title: "First", meta: "North", text: "First answer" },
      { title: "Second", meta: "South", text: "Second answer" },
    ];
    const view = render(<EditorialCollection id="55" items={entries} />);
    fireEvent.click(screen.getByRole("button", { name: "South" }));
    expect(screen.queryByRole("heading", { name: "First" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Second" })).toBeInTheDocument();
    view.rerender(<EditorialCollection id="34" items={entries} />);
    fireEvent.click(screen.getByRole("button", { name: "Second" }));
    expect(screen.getByRole("heading", { name: "Second" })).toBeInTheDocument();
    expect(screen.getByText("Second answer")).toBeInTheDocument();
  });
  it("keeps chapter links unique and rejects executable destinations", () => {
    const entry = {
      title: "A chapter",
      text: "<script>alert(1)</script>",
      href: "javascript:alert(1)",
    };
    const { container } = render(
      <>
        <EditorialCollection id="86" items={[entry]} showIndex />
        <EditorialCollection id="90" items={[entry]} showIndex />
      </>
    );
    const links = screen.getAllByRole("link");
    expect(new Set(links.map((a) => a.getAttribute("href"))).size).toBe(2);
    for (const a of links)
      expect(container.querySelector(a.getAttribute("href")!)).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
  });
});
