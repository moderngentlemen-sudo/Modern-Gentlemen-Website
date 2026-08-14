import { describe, expect, it } from "vitest";

import { FEED_TRANSFORMS } from "@/lib/domain/ingestion";
import { applyTransform, TRANSFORMS } from "./transforms";

/**
 * The conformance half of the split described in `lib/domain/ingestion.ts`: the
 * transform *names* are declared in the domain because the mapping schema
 * validates against them, the *functions* live here, and this is what stops the
 * two from drifting.
 *
 * It lives in this folder rather than beside the domain tests because
 * `lib/domain/**` is barred by ESLint from importing `lib/integrations/*` — and
 * unlike the `lib/blocks` override, that rule has no test-file exclusion. The
 * dependency only points one way, so the test belongs on this side of it.
 */
describe("the registry matches the declared vocabulary", () => {
  it("implements every declared transform and no others", () => {
    expect(Object.keys(TRANSFORMS).sort()).toEqual([...FEED_TRANSFORMS].sort());
  });
});

describe("pounds_to_pence", () => {
  const toPence = (value: unknown) => applyTransform("pounds_to_pence", value);

  it("converts a plain decimal", () => {
    expect(toPence("145.00")).toBe(14_500);
    expect(toPence("145.5")).toBe(14_550);
  });

  it("strips a currency symbol and thousands separators", () => {
    expect(toPence("£1,450.00")).toBe(145_000);
  });

  it("reads a comma as the decimal separator when it is used as one", () => {
    expect(toPence("1450,00")).toBe(145_000);
  });

  it("does not mistake a thousands comma for a decimal", () => {
    expect(toPence("1,450")).toBe(145_000);
  });

  it("handles a whole number of pounds", () => {
    expect(toPence("145")).toBe(14_500);
  });

  /**
   * The 25p bug PROGRESS.md records the cart making, in the other direction:
   * rounding has to happen on the pence figure, not the pounds one.
   */
  it("rounds to the nearest penny rather than the nearest pound", () => {
    expect(toPence("0.015")).toBe(2);
    expect(toPence("21.75")).toBe(2_175);
  });

  it("returns unparseable input untouched, so coercion reports the feed's own value", () => {
    expect(toPence("on request")).toBe("on request");
  });
});

describe("boolean_in_stock", () => {
  const stock = (value: unknown) => applyTransform("boolean_in_stock", value);

  it("reads the common affirmatives", () => {
    for (const word of ["true", "yes", "1", "In Stock", "available"]) {
      expect(stock(word)).toBe("in_stock");
    }
  });

  it("reads the common negatives", () => {
    for (const word of ["false", "no", "0", "Out of Stock", "sold out"]) {
      expect(stock(word)).toBe("out_of_stock");
    }
  });

  // Guessing here puts something on sale that nobody can ship.
  it("passes an unrecognised word through rather than guessing in_stock", () => {
    expect(stock("backordered")).toBe("backordered");
  });
});

describe("strip_html", () => {
  it("removes tags and collapses the whitespace they leave", () => {
    expect(applyTransform("strip_html", "<p>A jacket.</p><br/><p>In waxed cotton.</p>")).toBe(
      "A jacket. In waxed cotton."
    );
  });

  it("decodes the entities a CDATA block leaves behind", () => {
    expect(applyTransform("strip_html", "Barbour &amp; Sons &quot;Ashby&quot;")).toBe(
      'Barbour & Sons "Ashby"'
    );
  });
});

describe("split_commas", () => {
  it("splits one string into a list", () => {
    expect(applyTransform("split_commas", "NEW, LIMITED")).toEqual(["NEW", "LIMITED"]);
  });

  it("flattens rather than nesting when the path already matched several nodes", () => {
    expect(applyTransform("split_commas", ["NEW, LIMITED", "BESTSELLER"])).toEqual([
      "NEW",
      "LIMITED",
      "BESTSELLER",
    ]);
  });

  it("drops the empty entries a trailing comma leaves", () => {
    expect(applyTransform("split_commas", "NEW,")).toEqual(["NEW"]);
  });
});

describe("the simple transforms", () => {
  it("apply to every entry when a path matched several nodes", () => {
    expect(applyTransform("upper", ["a", "b"])).toEqual(["A", "B"]);
  });

  it("leave null alone", () => {
    expect(applyTransform("trim", null)).toBeNull();
  });

  it("truncate rather than round for integer", () => {
    expect(applyTransform("integer", "12.9")).toBe(12);
  });
});

describe("applyTransform", () => {
  it("is a no-op with no transform named", () => {
    expect(applyTransform(null, "value")).toBe("value");
  });

  /**
   * A name that validated on the way into the database but no longer exists
   * means the transform was removed after the mapping was saved. Importing the
   * untouched value and letting coercion judge it beats dropping the catalogue.
   */
  it("passes the value through for a name it does not know", () => {
    expect(applyTransform("shout", "value")).toBe("value");
  });
});
