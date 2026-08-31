import { describe, expect, it } from "vitest";

import { MAX_FORM_VALUE_LENGTH, normaliseFormSubmission } from "./forms";

describe("normaliseFormSubmission", () => {
  it("normalises a bounded submission", () => {
    expect(
      normaliseFormSubmission({
        formKey: " Contact-Form ",
        fields: { name: "  Ada  ", accepted: true },
        pagePath: "/contact",
      })
    ).toEqual({
      formKey: "contact-form",
      payload: { name: "Ada", accepted: true },
      pagePath: "/contact",
    });
  });

  it.each(["__proto__", "constructor", "prototype", "not-valid!"])(
    "rejects unsafe field name %s",
    (name) => {
      expect(
        normaliseFormSubmission({ formKey: "contact", fields: { [name]: "x" }, pagePath: null })
      ).toBeNull();
    }
  );

  it("rejects empty, oversized and nested payloads", () => {
    expect(normaliseFormSubmission({ formKey: "contact", fields: {}, pagePath: null })).toBeNull();
    expect(
      normaliseFormSubmission({
        formKey: "contact",
        fields: { note: "x".repeat(MAX_FORM_VALUE_LENGTH + 1) },
        pagePath: null,
      })
    ).toBeNull();
    expect(
      normaliseFormSubmission({
        formKey: "contact",
        fields: { nested: { value: "x" } },
        pagePath: null,
      })
    ).toBeNull();
  });
});
