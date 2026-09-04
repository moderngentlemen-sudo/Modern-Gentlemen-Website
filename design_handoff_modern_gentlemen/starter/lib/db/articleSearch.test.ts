import { describe, expect, it } from "vitest";

import { articleSearchVectorIsMissing } from "./articleSearch";

describe("articleSearchVectorIsMissing", () => {
  it.each(["42703", "PGRST204"])("recognises %s only for the article search column", (code) => {
    expect(
      articleSearchVectorIsMissing({ code, message: "articles.search_vector does not exist" })
    ).toBe(true);
    expect(articleSearchVectorIsMissing({ code, message: "another_column does not exist" })).toBe(
      false
    );
  });

  it("does not downgrade permission failures", () => {
    expect(articleSearchVectorIsMissing({ code: "42501", message: "permission denied" })).toBe(
      false
    );
  });
});
