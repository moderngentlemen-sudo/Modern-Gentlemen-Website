import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StudioCanvas, StudioElement } from "./StudioCanvas";

describe("Studio public renderer", () => {
  it("renders readable, escaped content and proportional geometry without an editor iframe", () => {
    const html = renderToStaticMarkup(
      <StudioCanvas width={760} height={480} sectionId="studio-intro" color="#ffffff">
        <StudioElement
          kind="text"
          text={'<script>alert("x")</script>'}
          x={76}
          y={38}
          w={380}
          h={76}
          canvasWidth={760}
        />
      </StudioCanvas>
    );
    expect(html).toContain("left:10cqw");
    expect(html).toContain("width:50cqw");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("iframe");
  });
  it("limits automatic themes to light neutral sections and protects colored controls", () => {
    const adaptive = renderToStaticMarkup(
      <StudioCanvas color="#fff">
        <StudioElement kind="button" fill="#c8102e" color="#fff" text="Join" />
      </StudioCanvas>
    );
    expect(adaptive).toContain('data-studio-theme="adaptive"');
    expect(adaptive).toContain('data-studio-fixed-palette="true"');
    for (const props of [
      { color: "#0d0d0d" },
      { color: "#e8e2d6" },
      { color: "#fff", gradient: "linear-gradient(90deg,#fff,#000)" },
    ]) {
      expect(renderToStaticMarkup(<StudioCanvas {...props} />)).toContain(
        'data-studio-theme="fixed"'
      );
    }
  });
  it("keeps fractional divider thickness and a real section link", () => {
    const html = renderToStaticMarkup(
      <>
        <StudioElement kind="divider" thickness={0.25} canvasWidth={100} color="#14141480" />
        <StudioElement kind="button" href="#studio-intro" text="Read more" />
      </>
    );
    expect(html).toContain("height:0.25cqw");
    expect(html).toContain('href="#studio-intro"');
    expect(html).toContain('role="separator"');
  });
});
