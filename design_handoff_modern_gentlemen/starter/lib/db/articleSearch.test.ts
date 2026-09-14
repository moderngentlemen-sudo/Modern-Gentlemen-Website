import { describe, expect, it } from "vitest";

import { articlePrefixQuery, articleSearchVectorIsMissing } from "./articleSearch";

describe("articlePrefixQuery", () => {
  it.each([
    ["spee cons", "'spee':* & 'cons':*"],
    ["  SLOW-car, café 42! ", "'slow':* & 'car':* & 'café':* & '42':*"],
    ["slow slow", "'slow':*"],
    ["be", "'be':*"],
    ["speed' | !car:*", "'speed':* & 'car':*"],
    ["' | ! & :*", ""],
    ["", ""],
  ])("turns %j into literal word prefixes", (input, expected) => {
    expect(articlePrefixQuery(input)).toBe(expected);
  });
});

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

  it("requires the exact missing prefix column before using the compatibility read", () => {
    expect(
      articleSearchVectorIsMissing(
        { code: "42703", message: "articles.search_prefix_vector does not exist" },
        "search_prefix_vector"
      )
    ).toBe(true);
    expect(
      articleSearchVectorIsMissing(
        { code: "42703", message: "articles.search_vector does not exist" },
        "search_prefix_vector"
      )
    ).toBe(false);
    expect(
      articleSearchVectorIsMissing(
        { code: "42501", message: "permission denied for search_prefix_vector" },
        "search_prefix_vector"
      )
    ).toBe(false);
  });
});
