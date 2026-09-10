import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorialArticle } from "./EditorialArticle";
vi.mock("@/components/ui/MediaImage", () => ({
  MediaImage: ({ src, alt }: { src: string; alt: string }) => (
    <span data-image={src} aria-label={alt} />
  ),
}));
afterEach(cleanup);
const article = {
  slug: "real-article",
  title: "An authored headline",
  dek: "An authored introduction",
  image: "/cover.jpg",
  author: "Editorial team",
};
describe("article collection", () => {
  it("uses the supplied article body and builds its reading index from actual headings", () => {
    render(
      <EditorialArticle article={article} design={{ preset: "long-read" }}>
        <h2>First real chapter</h2>
        <p>Actual article content.</p>
      </EditorialArticle>
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(article.title);
    expect(screen.getByRole("link", { name: /First real chapter/ })).toHaveAttribute(
      "href",
      `#${screen.getByRole("heading", { level: 2 }).id}`
    );
    expect(screen.getByText("Actual article content.")).toBeVisible();
  });
  it("loads a genuine privacy-enhanced YouTube iframe only after play and releases it on close", async () => {
    render(
      <EditorialArticle
        article={{
          ...article,
          media: { kind: "embed", embedUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ" },
        }}
        design={{ preset: "immersive" }}
      />
    );
    expect(document.querySelector("iframe")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Play on YouTube/ }));
    expect(document.querySelector("iframe")?.src).toBe(
      "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ?autoplay=1&playsinline=1"
    );
    expect(document.querySelector("iframe")).toHaveAttribute("allowfullscreen");
    await userEvent.click(screen.getByRole("button", { name: /Close player/ }));
    expect(document.querySelector("iframe")).toBeNull();
  });
  it("keeps image gallery navigation and reading size controls functional", async () => {
    render(
      <EditorialArticle
        preview
        article={{
          ...article,
          media: {
            kind: "gallery",
            gallery: [
              { url: "/one.jpg", kind: "image" },
              { url: "/two.jpg", kind: "image" },
            ],
          },
        }}
        design={{ preset: "photo-essay" }}
      >
        <p>Article text</p>
      </EditorialArticle>
    );
    await userEvent.click(screen.getByRole("button", { name: "Next photograph" }));
    expect(screen.getByText("2 / 2")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: /Larger type/ }));
    expect(screen.getByRole("button", { name: /Regular type/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
