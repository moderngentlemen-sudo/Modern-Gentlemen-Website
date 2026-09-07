import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FontPicker } from "./FontPicker";

describe("font picker", () => {
  it("searches by name and filters by category without dropping the current font", () => {
    const change = vi.fn();
    render(
      <FontPicker label="Font family" value="systemSerif" onChange={change} sample="My own text" />
    );
    fireEvent.change(screen.getByLabelText("Search fonts"), { target: { value: "Lora" } });
    expect(screen.getByRole("option", { name: "Lora" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "System serif" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Font category"), { target: { value: "Monospace" } });
    expect(screen.queryByRole("option", { name: "Lora" })).toBeNull();
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Font preview")).toHaveTextContent("My own text");
  });
  it("saves favourites on this device and allows restoring inheritance", () => {
    localStorage.removeItem("mg-builder-font-favourites");
    const change = vi.fn();
    render(<FontPicker label="Font family" value="google:Lora" onChange={change} />);
    fireEvent.click(screen.getByRole("button", { name: "Favourite this font" }));
    expect(JSON.parse(localStorage.getItem("mg-builder-font-favourites")!)).toEqual([
      "google:Lora",
    ]);
    fireEvent.click(screen.getByLabelText("Favourites on this device"));
    expect(screen.getByText(/1 matching fonts/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Font family"), { target: { value: "" } });
    expect(change).toHaveBeenCalledWith("");
  });
});
