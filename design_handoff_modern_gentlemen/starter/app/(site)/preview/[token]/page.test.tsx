import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { categoryDocumentSections } from "@/lib/demo/category-sections";
import { getCategory, slugify } from "@/lib/demo/editorial";
import { DOCUMENT_CONTENT_TYPE } from "@/lib/blocks/templateContent";

const mocks = vi.hoisted(() => ({
  resolvePreview: vi.fn(),
  getPublishedPreviewContext: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/preview/test-token" }));
vi.mock("@/lib/services/preview", () => ({ resolvePreview: mocks.resolvePreview }));
vi.mock("@/lib/services/rateLimit", () => ({ clientIdentity: () => "test" }));
vi.mock("@/lib/services/patterns", () => ({ expandPatternRefs: async (tree: unknown) => tree }));
vi.mock("@/lib/services/publicContent", () => ({
  expandPublicPatterns: async (tree: unknown) => tree,
  getPublishedPreviewContext: mocks.getPublishedPreviewContext,
  soleFramedDocument: async () => null,
  composePublishedDocument: async () => null,
}));
vi.mock("@/lib/services/publicTheme", () => ({ getPublishedThemeSettings: vi.fn() }));
vi.mock("@/lib/services/bindingSources", async () => ({
  supabaseBindingSources: (await import("@/lib/blocks/sources/demo")).demoBindingSources,
}));
vi.mock("@/components/PagePresentation", () => ({
  PagePresentation: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("./PreviewBar", () => ({ PreviewBar: () => null }));

import PreviewPage from "./page";

const categoryId = "00000000-0000-4000-8000-000000000001";
const sections = categoryDocumentSections("style").filter((block) =>
  ["featuredLead", "articleGrid"].includes(block._type)
);

beforeEach(() => {
  mocks.getPublishedPreviewContext.mockResolvedValue({ title: "Style", sections });
});

describe("preview article bindings", () => {
  for (const variant of ["category", "template area", "framed category"] as const) {
    it(`renders working story links for a ${variant}`, async () => {
      mocks.resolvePreview.mockResolvedValue({
        entityType: variant === "category" ? "category" : "template",
        entityId: categoryId,
        expiresAt: "2099-01-01T00:00:00Z",
        data:
          variant === "category"
            ? { sections }
            : {
                areas: {
                  main:
                    variant === "template area"
                      ? sections
                      : [{ _key: "content", _type: DOCUMENT_CONTENT_TYPE, settings: {} }],
                },
              },
        context:
          variant === "framed category" ? { entityType: "category", entityId: categoryId } : {},
      });

      render(
        await PreviewPage({
          params: Promise.resolve({ token: "test-token" }),
          searchParams: Promise.resolve({}),
        })
      );

      const title = getCategory("style")!.lead.title;
      expect(screen.getByText(title)).toBeVisible();
      expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toContain(
        `/article/${slugify(title)}`
      );
      expect(screen.getAllByRole("link").every((link) => !!link.getAttribute("href"))).toBe(true);
    });
  }
});
