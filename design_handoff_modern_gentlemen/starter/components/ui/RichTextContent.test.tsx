import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RichTextContent } from "./RichTextContent";

describe("RichTextContent", () => {
  it("keeps an existing plain-text value as a paragraph", () => {
    render(<RichTextContent value={"First line\nSecond line"} />);

    expect(screen.getByText(/First line/).tagName).toBe("P");
    expect(screen.getByText(/First line/)).toHaveTextContent("First line Second line");
  });

  it("renders the bounded block and inline vocabulary", () => {
    render(
      <RichTextContent
        value={
          "## The heading\n\nA **bold** and *considered* line.\n\n> A quotation\n\n- One\n- Two"
        }
      />
    );

    expect(screen.getByRole("heading", { level: 2, name: "The heading" })).toBeInTheDocument();
    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.getByText("considered").tagName).toBe("EM");
    expect(screen.getByText("A quotation").tagName).toBe("BLOCKQUOTE");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("renders safe links and degrades an unsafe link to text", () => {
    render(
      <RichTextContent
        value={"[Journal](/journal) [Source](https://example.com) [No](javascript:alert)"}
      />
    );

    expect(screen.getByRole("link", { name: "Journal" })).toHaveAttribute("href", "/journal");
    expect(screen.getByRole("link", { name: "Source" })).toHaveAttribute(
      "href",
      "https://example.com"
    );
    expect(screen.getByText("No")).not.toHaveAttribute("href");
  });
});
