/**
 * The media surfaces that carry a rule rather than just markup.
 *
 * Three contracts are worth protecting here: the grid says when an image has no
 * alt text, the picker degrades to a plain URL box outside the admin layout,
 * and the details panel will not offer a delete for an asset something is
 * using.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CENTRE } from "@/lib/domain/media";
import type { AssetUsageView, AssetView } from "@/lib/services/media";
import { ok } from "@/app/(admin)/admin/_lib/action-result";

import { MediaUrlControl } from "../fields/MediaUrlControl";
import { AssetDetails } from "./AssetDetails";
import { MediaGrid } from "./MediaGrid";
import { MediaPickerProvider } from "./MediaPickerContext";

function makeAsset(overrides: Partial<AssetView> = {}): AssetView {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    folderId: null,
    bucket: "media",
    storagePath: "2026/08/ab12-hero.jpg",
    externalUrl: null,
    kind: "image",
    mimeType: "image/jpeg",
    fileName: "hero.jpg",
    byteSize: 2048,
    width: 1600,
    height: 900,
    durationMs: null,
    placeholder: null,
    title: null,
    altText: "A cover",
    caption: null,
    credit: null,
    focalPoint: CENTRE,
    checksum: "abc",
    createdAt: "2026-08-02T00:00:00Z",
    tags: [],
    url: "https://p.supabase.co/storage/v1/object/public/media/2026/08/ab12-hero.jpg",
    ...overrides,
  };
}

describe("MediaGrid", () => {
  it("surfaces tags while scanning the grid", () => {
    render(
      <MediaGrid
        assets={[makeAsset({ tags: [{ id: "tag-1", slug: "campaign", label: "Campaign" }] })]}
        onSelect={() => {}}
      />
    );
    expect(screen.getByText("Campaign")).toBeInTheDocument();
  });

  it("flags an image with no alt text, where an editor scanning forty will see it", () => {
    render(<MediaGrid assets={[makeAsset({ altText: null })]} onSelect={() => {}} />);
    expect(screen.getByText("No alt text")).toBeInTheDocument();
  });

  it("says nothing about alt text once it is set", () => {
    render(<MediaGrid assets={[makeAsset()]} onSelect={() => {}} />);
    expect(screen.queryByText("No alt text")).not.toBeInTheDocument();
  });

  it("does not ask a video for alt text", () => {
    render(
      <MediaGrid
        assets={[makeAsset({ kind: "video", altText: null, mimeType: "video/mp4" })]}
        onSelect={() => {}}
      />
    );
    expect(screen.queryByText("No alt text")).not.toBeInTheDocument();
  });

  it("hands the whole asset back on select, not just its id", async () => {
    const onSelect = vi.fn();
    const asset = makeAsset();
    render(<MediaGrid assets={[asset]} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith(asset);
  });
});

describe("MediaUrlControl", () => {
  it("is a plain URL box with no provider above it — exactly the Phase 4 control", () => {
    render(<MediaUrlControl kind="image" label="Image" value="" onChange={() => {}} />);

    expect(screen.getByLabelText("Image")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Browse library" })).not.toBeInTheDocument();
  });

  it("offers the library once a provider is mounted", () => {
    render(
      <MediaPickerProvider search={async () => ok({ assets: [], total: 0 })}>
        <MediaUrlControl kind="image" label="Image" value="" onChange={() => {}} />
      </MediaPickerProvider>
    );

    expect(screen.getByRole("button", { name: "Browse library" })).toBeInTheDocument();
  });

  it("writes the picked asset's URL into the field", async () => {
    const onChange = vi.fn();
    const asset = makeAsset();

    render(
      <MediaPickerProvider search={async () => ok({ assets: [asset], total: 1 })}>
        <MediaUrlControl kind="image" label="Image" value="" onChange={onChange} />
      </MediaPickerProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: "Browse library" }));
    // The dialog debounces its first search by 200ms.
    const option = await screen.findByRole("button", { name: /hero\.jpg/ }, { timeout: 3000 });
    await userEvent.click(option);

    expect(onChange).toHaveBeenCalledWith(asset.url);
  });

  it("keeps the browse affordance out of a disabled control", () => {
    render(
      <MediaPickerProvider search={async () => ok({ assets: [], total: 0 })}>
        <MediaUrlControl kind="image" label="Image" value="" onChange={() => {}} disabled />
      </MediaPickerProvider>
    );

    expect(screen.queryByRole("button", { name: "Browse library" })).not.toBeInTheDocument();
  });
});

describe("AssetDetails", () => {
  const noUsages: AssetUsageView[] = [];
  const oneUsage: AssetUsageView[] = [
    {
      id: "22222222-2222-4222-8222-222222222222",
      entityType: "page",
      entityId: "33333333-3333-4333-8333-333333333333",
      fieldPath: "sections.hero1.media.image",
      title: "Home",
      href: "/admin/pages/33333333-3333-4333-8333-333333333333",
    },
  ];

  function actions(usages: AssetUsageView[]) {
    return {
      update: vi.fn(async () => ok(makeAsset())),
      remove: vi.fn(async () => ok(undefined)),
      usages: vi.fn(async () => ok(usages)),
    };
  }

  it("will not offer to delete an asset something is using", async () => {
    render(
      <AssetDetails
        asset={makeAsset()}
        actions={actions(oneUsage)}
        canWrite
        canDelete
        onUpdated={() => {}}
        onDeleted={() => {}}
        onMessage={() => {}}
      />
    );

    // The panel is collapsed by default; the state it guards is what matters.
    await userEvent.click(await screen.findByRole("button", { name: /Danger/ }));
    expect(await screen.findByRole("button", { name: "Delete asset" })).toBeDisabled();
    expect(screen.getByText(/This asset is in use/)).toBeInTheDocument();
  });

  it("saves comma-separated tags as structured metadata", async () => {
    const assetActions = actions(noUsages);
    render(
      <AssetDetails
        asset={makeAsset()}
        actions={assetActions}
        canWrite
        canDelete={false}
        onUpdated={() => {}}
        onDeleted={() => {}}
        onMessage={() => {}}
      />
    );

    await userEvent.type(screen.getByLabelText("Tags"), "Campaign, Homepage");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(assetActions.update).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ["Campaign", "Homepage"] })
    );
  });

  it("allows the delete once nothing references it", async () => {
    render(
      <AssetDetails
        asset={makeAsset()}
        actions={actions(noUsages)}
        canWrite
        canDelete
        onUpdated={() => {}}
        onDeleted={() => {}}
        onMessage={() => {}}
      />
    );

    expect(await screen.findByText(/Nothing references this asset/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Danger/ }));
    expect(screen.getByRole("button", { name: "Delete asset" })).toBeEnabled();
  });

  it("points at where the asset is used, so the refusal is actionable", async () => {
    render(
      <AssetDetails
        asset={makeAsset()}
        actions={actions(oneUsage)}
        canWrite
        canDelete
        onUpdated={() => {}}
        onDeleted={() => {}}
        onMessage={() => {}}
      />
    );

    expect(await screen.findByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/admin/pages/33333333-3333-4333-8333-333333333333"
    );
    expect(screen.getByText("sections.hero1.media.image")).toBeInTheDocument();
  });

  it("hides the delete section entirely from someone who cannot delete", async () => {
    render(
      <AssetDetails
        asset={makeAsset()}
        actions={actions(noUsages)}
        canWrite
        canDelete={false}
        onUpdated={() => {}}
        onDeleted={() => {}}
        onMessage={() => {}}
      />
    );

    expect(await screen.findByText(/Nothing references this asset/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Danger/ })).not.toBeInTheDocument();
  });
});
