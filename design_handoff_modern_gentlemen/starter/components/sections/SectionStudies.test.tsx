import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SECTION_STUDIES, sectionStudyType } from "@/lib/blocks/sectionStudies";
import { sectionStudyManifests } from "@/lib/blocks/manifests/sectionStudies";
import { collectMediaReferences } from "@/lib/blocks/media";
import { validateBlock } from "@/lib/blocks/validate";
import { newBlockNode } from "@/components/admin/builder/node";
import { studyPreview } from "@/components/admin/builder/studyPreview";
import { blockCatalogFor } from "./registry";
import { SectionStudyView } from "./SectionStudies";
import { StudySignup } from "./StudySignup";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MG section studies", () => {
  it("preserves the 36 approved identifiers, distinct layouts and searchable labels", () => {
    expect(SECTION_STUDIES.map(([id]) => id)).toEqual(
      Array.from({ length: 36 }, (_, i) => String(i + 1).padStart(2, "0"))
    );
    expect(new Set(SECTION_STUDIES.map(([, , layout]) => layout)).size).toBe(36);
    for (const documentType of ["page", "article", "template", "category"]) {
      const catalog = blockCatalogFor(documentType);
      for (const [id, name] of SECTION_STUDIES)
        expect(catalog).toContainEqual(
          expect.objectContaining({ type: sectionStudyType(id), label: `MG Study ${id} · ${name}` })
        );
    }
  });

  it.each(SECTION_STUDIES)(
    "%s renders edited content, media and responsive settings",
    (id, name, layout, tone) => {
      const study = SECTION_STUDIES.find(([value]) => value === id)!;
      const { container } = render(
        <SectionStudyView
          study={study}
          title="Authored heading"
          intro="Authored description"
          image="/images/style-mono.jpg"
          imageAlt="Tailoring"
          mobileOrder="imageFirst"
          imagePosition="top"
          items={[
            {
              title: "Authored story",
              text: "Story text",
              image: "/images/watch-gear.jpg",
              alt: "Watch",
              href: "/articles",
            },
          ]}
          cta={{ label: "Browse stories", href: "/articles" }}
        />
      );
      const section = container.querySelector("section");
      expect(section).toHaveAttribute("data-mg-study", id);
      expect(section).toHaveAttribute("data-layout", layout);
      expect(section).toHaveAttribute("data-tone", tone);
      expect(section).toHaveAttribute("data-mobile-order", "imageFirst");
      expect(section).toHaveAttribute("data-image-position", "top");
      expect(screen.getByRole("heading", { name: "Authored heading" })).toBeInTheDocument();
      expect(screen.queryByText(name)).not.toBeInTheDocument();
      expect(screen.getByAltText("Tailoring")).toHaveAttribute("sizes");
      expect(screen.getByRole("link", { name: /Browse stories/ })).toHaveAttribute(
        "href",
        "/articles"
      );
      if (layout !== "correspondence")
        expect(screen.getByRole("link", { name: /Authored story/ })).toHaveAttribute(
          "href",
          "/articles"
        );
      else expect(screen.getByRole("textbox", { name: "Email address" })).toBeInTheDocument();
    }
  );

  it.each(SECTION_STUDIES)(
    "%s inserts clean data and keeps illustrative previews out of publication",
    (id) => {
      const type = sectionStudyType(id);
      const node = newBlockNode(type);
      expect(validateBlock(node).ok).toBe(true);
      expect(collectMediaReferences([node])).toEqual([]);
      const preview = studyPreview(type);
      expect(preview.intro).toContain("Illustrative preview");
      expect(JSON.stringify(node)).not.toContain("/images/");
      expect(JSON.stringify(node)).not.toContain("Illustrative preview");
      const manifest = sectionStudyManifests[type];
      expect(manifest.strictSchema.safeParse({ ...node.settings, ...preview }).success).toBe(true);
    }
  );

  it("keeps legacy previews unchanged", () => {
    expect(studyPreview("heroCoverStar")).toEqual({});
    expect(studyPreview("sectionStudio")).toEqual({});
  });

  it("does not render unsafe action destinations", () => {
    render(
      <SectionStudyView
        study={SECTION_STUDIES[0]}
        title="Safe links"
        cta={{ label: "Unsafe CTA", href: "javascript:alert(1)" }}
        items={[{ title: "Unsafe story", href: "//untrusted.example" }]}
      />
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Unsafe story")).toBeInTheDocument();
  });

  it("tracks every selected asset and allows intentionally empty entry lists", () => {
    const node = newBlockNode("mgStudy01");
    node.settings = {
      ...node.settings,
      image: "/primary.jpg",
      items: [{ title: "Story", image: "/entry.jpg" }],
    };
    expect(collectMediaReferences([node]).map(({ fieldPath }) => fieldPath)).toEqual([
      "image",
      "items.0.image",
    ]);
    const { container } = render(
      <SectionStudyView study={SECTION_STUDIES[0]} title="Empty collection" items={[]} />
    );
    expect(container.querySelector("ol")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("section")).toHaveAttribute("data-has-image", "false");
  });

  it("rejects unsupported settings and does not offer discarded entries on the newsletter", () => {
    const manifest = sectionStudyManifests.mgStudy31;
    expect(manifest.fields).not.toHaveProperty("items");
    expect(manifest.bindable).toEqual([]);
    expect(
      manifest.strictSchema.safeParse({ ...manifest.insertDefaults, mobileOrder: "invented" })
        .success
    ).toBe(false);
  });
});

describe("study newsletter signup", () => {
  it.each([400, 429, 500])("reports HTTP %s without falsely claiming success", async (status) => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status });
    vi.stubGlobal("fetch", fetchMock);
    render(<StudySignup />);
    fireEvent.change(screen.getByRole("textbox", { name: "Email address" }), {
      target: { value: "reader@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/newsletter",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "reader@example.com", source: "newsletter" }),
      })
    );
  });

  it("waits for the real service response before showing success", async () => {
    let resolve: (value: { ok: boolean }) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((done) => {
            resolve = done;
          })
      )
    );
    render(<StudySignup buttonLabel="Join the dispatch" />);
    fireEvent.change(screen.getByRole("textbox", { name: "Email address" }), {
      target: { value: "reader@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Join the dispatch" }));
    expect(screen.getByRole("button", { name: "Submitting…" })).toBeDisabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    resolve({ ok: true });
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
  });
});
