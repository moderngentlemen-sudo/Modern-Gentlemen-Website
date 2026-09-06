import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SECTION_STUDIES } from "@/lib/blocks/sectionStudies";
import { MGDesignStudio, SectionStudyView } from "@/components/sections/SectionStudies";
import { StudioDesignPicker } from "./StudioDesignPicker";

afterEach(cleanup);

it.each(SECTION_STUDIES)("studio design %s exactly reproduces the legacy renderer", (id) => {
  const study = SECTION_STUDIES.find(([value]) => value === id)!;
  const props = {
    title: "Keep my heading",
    intro: "My description",
    image: "/images/style-mono.jpg",
    items: [{ title: "My entry" }],
  };
  expect(renderToStaticMarkup(<MGDesignStudio {...props} variant={id} />)).toBe(
    renderToStaticMarkup(<SectionStudyView {...props} study={study} />)
  );
});
it("offers all 36 choices and changes only the variant", () => {
  const onChange = vi.fn();
  render(<StudioDesignPicker kind="studies" value="01" onChange={onChange} />);
  expect(screen.getAllByRole("option")).toHaveLength(36);
  fireEvent.change(screen.getByLabelText("Studio design"), { target: { value: "31" } });
  expect(onChange).toHaveBeenCalledWith("31");
  expect(onChange).toHaveBeenCalledTimes(1);
});
it("previews only the selected coming-soon design on demand", () => {
  function Harness() {
    const [value, setValue] = useState("01");
    return <StudioDesignPicker kind="comingSoon" value={value} onChange={setValue} allowBlank />;
  }
  const { container } = render(<Harness />);
  expect(screen.getAllByRole("option")).toHaveLength(22);
  expect(container.querySelector("[data-coming-soon]")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Preview design" }));
  fireEvent.change(screen.getByLabelText("Coming soon design"), { target: { value: "20" } });
  expect(container.querySelectorAll("[data-coming-soon]")).toHaveLength(1);
  expect(container.querySelector("[data-coming-soon]")?.getAttribute("data-coming-soon")).toBe(
    "20"
  );
});
it("prevents changing a locked design", () => {
  render(<StudioDesignPicker kind="studies" value="01" onChange={vi.fn()} disabled />);
  expect((screen.getByLabelText("Studio design") as HTMLSelectElement).disabled).toBe(true);
});
