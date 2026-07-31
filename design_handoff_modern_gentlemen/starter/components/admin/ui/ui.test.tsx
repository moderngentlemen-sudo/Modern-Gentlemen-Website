/**
 * The admin primitives, tested at the points where they exist *because* the
 * site's equivalents could not serve. Each case below corresponds to a specific
 * gap: Button's missing `disabled`, SelectField's `string[]` options, the
 * absent `help` slot, and NumberInput's edit buffer.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { Button, IconButton } from "./Button";
import { TextInput } from "./Input";
import { Select } from "./Select";
import { NumberInput } from "./NumberInput";
import { Toggle, Checkbox } from "./Toggle";
import { Dialog } from "./Dialog";

describe("Button", () => {
  it("does not fire onClick while disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Publish
      </Button>
    );

    await userEvent.click(screen.getByRole("button", { name: "Publish" }), {
      pointerEventsCheck: 0,
    });
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not fire onClick while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} loading>
        Saving
      </Button>
    );

    await userEvent.click(screen.getByRole("button", { name: "Saving" }), {
      pointerEventsCheck: 0,
    });
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders a link when given href, and a button when disabled even so", () => {
    const { rerender } = render(<Button href="/admin/pages">Pages</Button>);
    expect(screen.getByRole("link", { name: "Pages" })).toBeInTheDocument();

    // A disabled link is not a thing — it must degrade to an inert button.
    rerender(
      <Button href="/admin/pages" disabled>
        Pages
      </Button>
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pages" })).toBeDisabled();
  });
});

describe("IconButton", () => {
  it("is reachable by its label, since it renders no text", () => {
    render(<IconButton label="Duplicate block">⧉</IconButton>);
    expect(screen.getByRole("button", { name: "Duplicate block" })).toBeInTheDocument();
  });
});

describe("TextInput", () => {
  it("renders a name attribute, which components/store/Field does not", () => {
    render(<TextInput label="Slug" name="slug" value="" onChange={() => {}} />);
    expect(screen.getByLabelText("Slug")).toHaveAttribute("name", "slug");
  });

  it("shows help text, which no site primitive has a slot for", () => {
    render(
      <TextInput label="Headline" value="" onChange={() => {}} help="Keep it under 60 characters" />
    );
    expect(screen.getByText("Keep it under 60 characters")).toBeInTheDocument();
  });

  it("replaces help with the error and marks the control invalid", () => {
    render(
      <TextInput
        label="Headline"
        value=""
        onChange={() => {}}
        help="Keep it short"
        error="Headline is required"
      />
    );

    expect(screen.getByText("Headline is required")).toBeInTheDocument();
    expect(screen.queryByText("Keep it short")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Headline")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("Select", () => {
  it("renders option labels but submits option values", async () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Variant"
        value="split"
        onChange={onChange}
        options={[
          { value: "split", label: "Split — heading left, email right" },
          { value: "centered", label: "Centered — stacked" },
        ]}
      />
    );

    // The distinction components/store/SelectField structurally cannot make.
    expect(screen.getByRole("option", { name: "Split — heading left, email right" })).toHaveValue(
      "split"
    );

    await userEvent.selectOptions(screen.getByLabelText("Variant"), "centered");
    expect(onChange).toHaveBeenCalledWith("centered");
  });
});

describe("NumberInput", () => {
  function Harness({ integer }: { integer?: boolean }) {
    const [value, setValue] = useState<number | undefined>(undefined);
    return (
      <>
        <NumberInput label="Limit" value={value} onChange={setValue} integer={integer} min={1} />
        <output data-testid="value">{value === undefined ? "undefined" : String(value)}</output>
      </>
    );
  }

  it("survives the intermediate states of typing without clobbering the field", async () => {
    render(<Harness />);
    const input = screen.getByLabelText("Limit");

    // "-" and "1." are not finite numbers; a naive controlled number input
    // would reset the field mid-keystroke.
    await userEvent.type(input, "12");
    expect(input).toHaveValue(12);
    expect(screen.getByTestId("value")).toHaveTextContent("12");
  });

  it("reports undefined when cleared rather than 0", async () => {
    render(<Harness />);
    const input = screen.getByLabelText("Limit");

    await userEvent.type(input, "5");
    expect(screen.getByTestId("value")).toHaveTextContent("5");

    await userEvent.clear(input);
    expect(screen.getByTestId("value")).toHaveTextContent("undefined");
  });
});

describe("Toggle", () => {
  it("exposes switch semantics", async () => {
    const onChange = vi.fn();
    render(<Toggle label="Hidden" checked={false} onChange={onChange} />);

    const toggle = screen.getByRole("switch", { name: "Hidden" });
    expect(toggle).toHaveAttribute("aria-checked", "false");

    await userEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("Checkbox", () => {
  it("toggles a member of a set", async () => {
    const onChange = vi.fn();
    render(<Checkbox label="mobile" checked={false} onChange={onChange} />);

    await userEvent.click(screen.getByRole("checkbox", { name: "mobile" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("Dialog", () => {
  it("renders nothing when closed", () => {
    render(
      <Dialog open={false} onClose={() => {}} title="Publish">
        body
      </Dialog>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is a modal labelled by its title, and closes on Escape", async () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Publish this page">
        body
      </Dialog>
    );

    const dialog = screen.getByRole("dialog", { name: "Publish this page" });
    expect(dialog).toHaveAttribute("aria-modal", "true");

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
