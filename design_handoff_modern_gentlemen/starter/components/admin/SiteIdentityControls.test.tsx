import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DEFAULT_SITE_IDENTITY } from "@/lib/domain/siteIdentity";
import { SiteIdentityControls } from "./SiteIdentityControls";

vi.mock("@/app/(admin)/admin/media/actions", () => ({
  uploadAssetAction: vi.fn(),
}));

describe("Appearance Studio favicon and identity controls", () => {
  it("previews the official MG favicon with no additional media records", () => {
    const { container } = render(
      <SiteIdentityControls
        value={DEFAULT_SITE_IDENTITY}
        onChange={() => {}}
        canBrowse={false}
        canUpload={false}
      />
    );
    expect(screen.getByLabelText("Browser tab favicon preview")).toBeInTheDocument();
    expect(screen.getByLabelText("Favicon image URL")).toHaveValue("/site-icon.svg");
    expect(container.querySelector('img[src="/site-icon.svg"]')).not.toBeNull();
    for (const button of screen.getAllByRole("button", { name: "Browse library" })) {
      expect(button).toBeDisabled();
    }
  });

  it("edits the site name without publishing and can restore the approved favicon", () => {
    const update = vi.fn();
    render(
      <SiteIdentityControls
        value={{ ...DEFAULT_SITE_IDENTITY, faviconUrl: "/custom.png" }}
        onChange={update}
        canBrowse={false}
        canUpload={false}
      />
    );
    fireEvent.change(screen.getByLabelText("Site name"), { target: { value: "MG Editorial" } });
    expect(update).toHaveBeenCalledWith({
      ...DEFAULT_SITE_IDENTITY,
      faviconUrl: "/custom.png",
      siteName: "MG Editorial",
    });
    fireEvent.click(screen.getByRole("button", { name: "Restore MG icon" }));
    expect(update).toHaveBeenCalledWith(DEFAULT_SITE_IDENTITY);
  });
});
