import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CatalogProvider } from "@/lib/catalog/CatalogProvider";
import { DEFAULT_SEARCH_APPEARANCE, type SearchLayoutId } from "@/lib/domain/searchPresets";
import SearchCollection from "./SearchCollection";
vi.mock("@/components/ui/MediaImage", () => ({
  MediaImage: ({ src }: { src: string }) => <span data-image={src} />,
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
  }: {
    children: React.ReactNode;
    href: string;
    onClick: () => void;
  }) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
}));
const product = {
  slug: "collection-watch",
  name: "Collection Watch",
  cat: "Watches",
  catLabel: "Watches",
  price: 18500,
  tag: "" as const,
  material: "Steel",
  blurb: "A considered everyday watch.",
  story: "",
  specs: [["Case", "38 mm"]] as [string, string][],
  images: ["/watch.jpg"],
};
const editorial = {
  title: "Collection Test Story",
  tag: "Watches",
  meta: "5 MIN",
  href: "/article/collection-test-story",
  img: "/story.jpg",
  excerpt: "An actual result excerpt.",
};
beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ results: [editorial] }) }))
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function open(layout: SearchLayoutId = "preview-on-demand", onClose = vi.fn()) {
  return render(
    <CatalogProvider products={[product]}>
      <SearchCollection
        settings={{ ...DEFAULT_SEARCH_APPEARANCE, layout, motion: "none", debounceMs: 80 }}
        onClose={onClose}
      />
    </CatalogProvider>
  );
}
describe("live search collection", () => {
  it("populates a studio preview with real results and makes on-demand differences visible", async () => {
    render(
      <CatalogProvider products={[product]}>
        <SearchCollection
          settings={{
            ...DEFAULT_SEARCH_APPEARANCE,
            layout: "compare-alongside",
            motion: "none",
            debounceMs: 80,
          }}
          onClose={vi.fn()}
          previewQuery="collection preview"
        />
      </CatalogProvider>
    );
    expect(screen.getByRole("searchbox")).toHaveValue("collection preview");
    expect(
      await screen.findByRole("region", { name: "Preview: Collection Test Story" })
    ).toBeVisible();
    expect(screen.getByText(editorial.excerpt)).toBeVisible();
    expect(screen.getByRole("link", { name: /Read article/ })).toHaveAttribute(
      "href",
      editorial.href
    );
  });
  it("fetches no results or preview images until requested, then supports real editorial and store previews", async () => {
    open();
    expect(fetch).not.toHaveBeenCalled();
    expect(document.querySelector("[data-image]")).toBeNull();
    await userEvent.type(screen.getByRole("searchbox"), "collection");
    const story = await screen.findByRole("button", { name: /Collection Test Story/ });
    expect(document.querySelector("[data-image]")).toBeNull();
    await userEvent.click(story);
    expect(screen.getByRole("link", { name: /Read article/ })).toHaveAttribute(
      "href",
      editorial.href
    );
    expect(screen.getByText(editorial.excerpt)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: /Collection Watch/ }));
    expect(screen.getByRole("link", { name: /View product/ })).toHaveAttribute(
      "href",
      "/product/collection-watch"
    );
    expect(screen.getByRole("searchbox")).toHaveValue("collection");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("keeps words first images opt-in and fullscreen focus reversible", async () => {
    const view = open("words-first");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "collection words" } });
    await userEvent.click(await screen.findByRole("button", { name: /Collection Test Story/ }));
    expect(document.querySelector("[data-image]")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Reveal image" }));
    expect(document.querySelector('[data-image="/story.jpg"]')).not.toBeNull();
    view.unmount();
    open("focus");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "collection focus" } });
    await userEvent.click(await screen.findByRole("button", { name: /Collection Test Story/ }));
    expect(document.querySelector('[data-focused="true"]')).not.toBeNull();
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Preview: Collection Test Story" })).toHaveFocus()
    );
    await userEvent.click(screen.getByRole("button", { name: "Back to results" }));
    expect(document.querySelector('[data-focused="true"]')).toBeNull();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Collection Test Story/ })).toHaveFocus()
    );
  });
  it("switches light mode and closes once on Escape with reduced motion", async () => {
    const onClose = vi.fn();
    open("atelier", onClose);
    const button = screen.getByRole("button", { name: /Switch search to/ });
    await userEvent.click(button);
    expect(document.querySelector('[data-appearance="dark"]')).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
  it("aborts superseded requests and refuses a stale result even if the transport resolves late", async () => {
    let firstResolve: ((data: unknown) => void) | undefined;
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, options: { signal: AbortSignal }) => {
        signals.push(options.signal);
        return url.includes("stale-one")
          ? new Promise((resolve) => {
              firstResolve = resolve;
            })
          : Promise.resolve({
              ok: true,
              json: async () => ({ results: [{ ...editorial, title: "Latest result" }] }),
            });
      })
    );
    open();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "stale-one" } });
    await waitFor(() => expect(signals).toHaveLength(1));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "latest-two" } });
    await screen.findByRole("button", { name: /Latest result/ });
    expect(signals[0].aborted).toBe(true);
    firstResolve?.({ ok: true, json: async () => ({ results: [editorial] }) });
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Collection Test Story/ })
      ).not.toBeInTheDocument()
    );
  });
});
