/**
 * The control registry.
 *
 * The contract being protected: every one of the eleven runtime field kinds
 * renders an editable control, nested paths address the right value, and an
 * issue lands on the control that caused it and no other.
 */

import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { field, options, type Field } from "@/lib/blocks/fields";
import type { BindingQuery } from "@/lib/blocks/binding";
import type { BlockIssue } from "@/lib/blocks/validate";

import { BindingEditor } from "./BindingEditor";
import { FieldControl, type ControlContext } from "./FieldControl";
import {
  countIssuesAtOrBelow,
  hasNestedIssues,
  issuesFor,
  stripTreePrefix,
  toBlockRelative,
} from "./issues";

function makeCtx(
  value: unknown,
  issues: BlockIssue[] = []
): ControlContext & { writes: unknown[][] } {
  const writes: unknown[][] = [];
  const state = { root: value };

  return {
    writes,
    issues,
    read: (path) => {
      let current: unknown = state.root;
      for (const segment of path.slice(1)) {
        if (current === null || typeof current !== "object") return undefined;
        current = (current as Record<string | number, unknown>)[segment];
      }
      return path.length === 1 ? state.root : current;
    },
    write: (path, next) => writes.push([path.join("."), next]),
    clear: (path) => writes.push([path.join("."), "<cleared>"]),
    listAdd: (path, item) => writes.push([`add:${path.join(".")}`, item]),
    listRemove: (path, index) => writes.push([`remove:${path.join(".")}`, index]),
    listMove: (path, from, to) => writes.push([`move:${path.join(".")}`, [from, to]]),
  };
}

function renderField(f: Field, value: unknown, issues: BlockIssue[] = []) {
  const ctx = makeCtx(value, issues);
  render(<FieldControl name="target" field={f} path={["target"]} ctx={ctx} />);
  return ctx;
}

describe("every runtime field kind renders a control", () => {
  const cases: [string, Field, unknown][] = [
    ["text", field.text({ label: "Headline" }), "Hello"],
    ["textarea", field.textarea({ label: "Standfirst" }), "Body"],
    ["richText", field.richText({ label: "Body" }), "Rich"],
    ["url", field.url({ label: "Link" }), "/article/x"],
    ["image", field.image({ label: "Cover" }), "/images/a.jpg"],
    ["video", field.video({ label: "Clip" }), "https://x/y.mp4"],
    ["select", field.select({ label: "Variant", options: options("a", "b") }), "a"],
    ["number", field.number({ label: "Limit" }), 4],
    ["boolean", field.boolean({ label: "Featured" }), true],
  ];

  it.each(cases)("%s", (_kind, f, value) => {
    renderField(f, value);
    expect(screen.getByLabelText(f.label)).toBeInTheDocument();
  });

  it("group renders its members, at depth", () => {
    const f = field.group({
      label: "Media",
      fields: { kind: field.text({ label: "Kind" }), src: field.text({ label: "Source" }) },
    });
    renderField(f, { kind: "image", src: "/a.jpg" });

    expect(screen.getByLabelText("Kind")).toHaveValue("image");
    expect(screen.getByLabelText(/^Source/)).toHaveValue("/a.jpg");
  });

  it("list renders one row per item", () => {
    const f = field.list({
      label: "Stories",
      itemLabel: "story",
      of: { title: field.text({ label: "Title" }) },
    });
    renderField(f, [{ title: "One" }, { title: "Two" }]);

    expect(screen.getAllByLabelText("Title")).toHaveLength(2);
    expect(screen.getByText(/story 1/i)).toBeInTheDocument();
  });
});

describe("help and required", () => {
  it("renders a field's help text", () => {
    renderField(field.text({ label: "Headline", help: "Under 60 characters" }), "");
    expect(screen.getByText("Under 60 characters")).toBeInTheDocument();
  });

  it("marks a required field", () => {
    renderField(field.text({ label: "Headline", required: true }), "");
    expect(screen.getByText("*")).toBeInTheDocument();
  });
});

describe("writing values", () => {
  it("writes a text edit at its own path", async () => {
    const ctx = renderField(field.text({ label: "Headline" }), "");
    await userEvent.type(screen.getByLabelText("Headline"), "A");
    expect(ctx.writes).toContainEqual(["target", "A"]);
  });

  it("clears an optional field rather than writing an empty string", async () => {
    // "" satisfies z.string(), so writing it would persist a present value
    // where the component expected undefined and its own fallback.
    const ctx = renderField(field.text({ label: "Kicker" }), "X");
    await userEvent.clear(screen.getByLabelText("Kicker"));
    expect(ctx.writes).toContainEqual(["target", "<cleared>"]);
  });

  it("writes a nested group member at a dotted path", async () => {
    const f = field.group({ label: "CTA", fields: { label: field.text({ label: "Label" }) } });
    const ctx = renderField(f, { label: "" });

    // One character: the fake context records writes without applying them, so
    // the controlled input never accumulates and each keystroke writes alone.
    await userEvent.type(screen.getByLabelText("Label"), "G");
    expect(ctx.writes).toContainEqual(["target.label", "G"]);
  });

  it("formats a rich-text selection without changing its storage type", async () => {
    const ctx = renderField(field.richText({ label: "Body" }), "Rich");
    const editor = screen.getByLabelText("Body") as HTMLTextAreaElement;
    editor.setSelectionRange(0, 4);

    await userEvent.click(screen.getByRole("button", { name: "Bold" }));

    expect(ctx.writes).toContainEqual(["target", "**Rich**"]);
  });

  it("addresses a list item by index", async () => {
    const f = field.list({
      label: "Stories",
      of: { title: field.text({ label: "Title" }) },
    });
    const ctx = renderField(f, [{ title: "" }, { title: "" }]);

    await userEvent.type(screen.getAllByLabelText("Title")[1], "Z");
    expect(ctx.writes).toContainEqual(["target.1.title", "Z"]);
  });
});

describe("list repeater", () => {
  const objectList = field.list({
    label: "Stories",
    itemLabel: "story",
    of: { title: field.text({ label: "Title" }) },
    min: 1,
    max: 2,
  });

  it("seeds a new object row from the declared defaults only", async () => {
    // List items are validated with .strict() at publish, so an extra seeded
    // key would produce an issue the editor never typed.
    const f = field.list({
      label: "Stories",
      of: { title: field.text({ label: "Title", default: "Untitled" }) },
    });
    const ctx = renderField(f, []);

    await userEvent.click(screen.getByRole("button", { name: /add item/i }));
    expect(ctx.writes).toContainEqual(["add:target", { title: "Untitled" }]);
  });

  it("disables Add at max", () => {
    renderField(objectList, [{ title: "a" }, { title: "b" }]);
    expect(screen.getByRole("button", { name: /add story/i })).toBeDisabled();
  });

  it("disables Remove at min", () => {
    renderField(objectList, [{ title: "a" }]);
    expect(screen.getByRole("button", { name: /remove story 1/i })).toBeDisabled();
  });

  it("moves an item", async () => {
    const ctx = renderField(objectList, [{ title: "a" }, { title: "b" }]);
    await userEvent.click(screen.getByRole("button", { name: /move story 2 up/i }));
    expect(ctx.writes).toContainEqual(["move:target", [1, 0]]);
  });

  it("handles a scalar list, where `of` is a Field rather than a FieldSet", async () => {
    const f = field.list({
      label: "Slugs",
      itemLabel: "slug",
      of: field.text({ label: "Slug" }),
    });
    const ctx = renderField(f, ["one", "two"]);

    expect(screen.getAllByLabelText("Slug")).toHaveLength(2);
    await userEvent.type(screen.getAllByLabelText("Slug")[0], "!");
    expect(ctx.writes.some(([path]) => path === "target.0")).toBe(true);
  });
});

describe("issues land on the control that caused them", () => {
  it("marks the offending control and no other", () => {
    const f = field.list({
      label: "Stories",
      of: { title: field.text({ label: "Title" }) },
    });
    renderField(
      f,
      [{ title: "" }, { title: "ok" }],
      [{ key: "k", type: "latestGrid", path: "target.0.title", message: "Title is required" }]
    );

    const inputs = screen.getAllByLabelText("Title");
    expect(inputs[0]).toHaveAttribute("aria-invalid", "true");
    expect(inputs[1]).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Title is required")).toBeInTheDocument();
  });
});

describe("issue path helpers", () => {
  const issues: BlockIssue[] = [
    { key: "k", type: "t", path: "items.0.title", message: "a" },
    { key: "k", type: "t", path: "items.10.title", message: "b" },
    { key: "k", type: "t", path: "headline", message: "c" },
  ];

  it("matches an exact path", () => {
    expect(issuesFor(issues, ["headline"]).map((i) => i.message)).toEqual(["c"]);
  });

  it("does not let items.1 claim items.10's issues", () => {
    // The trailing dot is what prevents the false prefix match.
    expect(hasNestedIssues(issues, ["items", 1])).toBe(false);
    expect(hasNestedIssues(issues, ["items", 10])).toBe(true);
  });

  it("counts issues at or below a path", () => {
    expect(countIssuesAtOrBelow(issues, ["items"])).toBe(2);
    expect(countIssuesAtOrBelow(issues, ["headline"])).toBe(1);
  });

  it("strips the tree prefix a service adds", () => {
    expect(stripTreePrefix("sections.items.0.title", "sections")).toBe("items.0.title");
  });

  it("maps a whole-block issue to the empty path, not to a control", () => {
    // validateDocumentPayload emits exactly the tree key when the issue is the
    // block itself rather than one of its fields.
    expect(stripTreePrefix("sections", "sections")).toBe("");
  });

  it("leaves a path from a different tree alone", () => {
    expect(stripTreePrefix("areas.main.headline", "sections")).toBe("areas.main.headline");
  });

  it("rewrites a whole set of issues", () => {
    expect(
      toBlockRelative(
        [{ key: "k", type: "t", path: "sections.headline", message: "m" }],
        "sections"
      )
    ).toEqual([{ key: "k", type: "t", path: "headline", message: "m" }]);
  });
});

describe("select", () => {
  it("offers a blank choice for an optional field", () => {
    renderField(field.select({ label: "Variant", options: options("a", "b") }), "a");
    expect(screen.getByRole("option", { name: "—" })).toBeInTheDocument();
  });

  it("omits the blank choice when the field is required", () => {
    renderField(
      field.select({ label: "Variant", options: options("a", "b"), required: true }),
      "a"
    );
    expect(screen.queryByRole("option", { name: "—" })).not.toBeInTheDocument();
  });
});

describe("boolean", () => {
  it("writes true and false", async () => {
    const ctx = renderField(field.boolean({ label: "Featured" }), false);
    await userEvent.click(screen.getByRole("switch", { name: "Featured" }));
    expect(ctx.writes).toContainEqual(["target", true]);
  });
});

describe("media", () => {
  it("previews an image once a value is present", () => {
    renderField(field.image({ label: "Cover" }), "/images/a.jpg");
    // A plain <img>: next/image would reject third-party demo URLs, which
    // next.config.mjs does not allow in remotePatterns.
    expect(document.querySelector("img")).toHaveAttribute("src", "/images/a.jpg");
  });

  it("shows no preview while the field is empty", () => {
    renderField(field.image({ label: "Cover" }), "");
    expect(document.querySelector("img")).toBeNull();
  });
});

describe("locked blocks", () => {
  it("disables every control", () => {
    const ctx = makeCtx("value");
    render(
      <FieldControl
        name="target"
        field={field.text({ label: "Headline" })}
        path={["target"]}
        ctx={{ ...ctx, disabled: true }}
      />
    );
    expect(screen.getByLabelText("Headline")).toBeDisabled();
  });
});

/**
 * The binding filter editor.
 *
 * `filter` is equality-only and both sources match with `===`, so the contract
 * this protects is entirely about **types**: `lead: "true"` and `issue: 40`
 * match nothing at all, and the block renders empty with no error anywhere.
 * Every assertion below is a way that outcome is made unreachable.
 */
describe("binding filters", () => {
  /**
   * Stateful on purpose. `BindingEditor` is a controlled component, so a
   * harness that renders a fixed prop makes every keystroke land on the same
   * starting value — typing "040" into a box holding "039" produced "0390" and
   * the test failed for a reason that had nothing to do with the component.
   */
  function renderEditor(initial: Partial<BindingQuery>) {
    const onChange = vi.fn();

    function Harness() {
      const [query, setQuery] = useState(initial);
      return (
        <BindingEditor
          query={query}
          onChange={(next) => {
            onChange(next);
            setQuery(next);
          }}
        />
      );
    }

    render(<Harness />);
    return { onChange };
  }

  it("offers only the fields the chosen source actually has", async () => {
    renderEditor({ source: "products" });

    await userEvent.selectOptions(screen.getByLabelText("Add a filter"), "group");

    // `category` is an article fact; on products it would match nothing.
    const options = [...screen.getByLabelText("Add a filter").querySelectorAll("option")].map((o) =>
      o.getAttribute("value")
    );
    expect(options).not.toContain("category");
  });

  it("stores a boolean as a boolean, not as the string a select hands back", async () => {
    const { onChange } = renderEditor({ source: "articles" });

    await userEvent.selectOptions(screen.getByLabelText("Add a filter"), "lead");

    expect(onChange).toHaveBeenCalledWith({ source: "articles", filter: { lead: true } });
  });

  it("keeps a zero-padded issue a string", async () => {
    const { onChange } = renderEditor({ source: "articles", filter: { issue: "039" } });

    await userEvent.clear(screen.getByLabelText("Issue"));
    await userEvent.type(screen.getByLabelText("Issue"), "040");

    const last = onChange.mock.calls.at(-1)?.[0];
    expect(last.filter.issue).toBe("040");
    expect(typeof last.filter.issue).toBe("string");
  });

  it("does not store a filter that is still empty", async () => {
    const { onChange } = renderEditor({ source: "articles" });

    // Choosing a text field opens a row; until it holds a value there is
    // nothing to store, because `{ category: "" }` matches no row.
    await userEvent.selectOptions(screen.getByLabelText("Add a filter"), "category");

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Category")).toBeTruthy();
  });

  it("drops the key when a value is cleared, rather than storing an empty one", async () => {
    const { onChange } = renderEditor({ source: "articles", filter: { category: "style" } });

    await userEvent.clear(screen.getByLabelText("Category"));

    expect(onChange).toHaveBeenCalledWith({ source: "articles", filter: undefined });
  });

  it("clears the filter when the source changes, because the keys belong to the source", async () => {
    const { onChange } = renderEditor({ source: "articles", filter: { category: "style" } });

    await userEvent.selectOptions(screen.getByLabelText(/^Source/), "products");

    expect(onChange).toHaveBeenCalledWith({ source: "products", filter: undefined });
  });

  it("shows a stored key the vocabulary no longer knows, instead of dropping it", () => {
    renderEditor({ source: "articles", filter: { retired: "x" } });

    // Silently discarding part of a saved query on open is how an editor loses
    // work without being told.
    expect(screen.getByText(/retired: x — not a field of this source/)).toBeTruthy();
  });

  it("says what no filter means", () => {
    renderEditor({ source: "articles" });
    expect(screen.getByText(/Everything in the source, newest first/)).toBeTruthy();
  });

  it("lets an editor enable persisted fallback content", async () => {
    const onFallbackChange = vi.fn();
    render(
      <BindingEditor
        query={{ source: "articles" }}
        onChange={vi.fn()}
        fallbackAvailable
        fallbackEnabled={false}
        onFallbackChange={onFallbackChange}
      />
    );

    await userEvent.click(screen.getByRole("switch", { name: "Fallback content" }));

    expect(onFallbackChange).toHaveBeenCalledWith(true);
    expect(screen.getByText(/Switch to Literal to edit it/)).toBeTruthy();
  });
});
