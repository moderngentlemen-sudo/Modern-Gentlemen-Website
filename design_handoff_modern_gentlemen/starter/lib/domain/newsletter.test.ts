import { describe, expect, it } from "vitest";

import {
  isPlausibleEmail,
  isSubscriberSource,
  MAX_EMAIL_LENGTH,
  normaliseEmail,
  subscriberCsv,
  SUBSCRIBER_SOURCES,
  SUBSCRIBER_STATUSES,
} from "./newsletter";

describe("normaliseEmail", () => {
  it("lowercases and trims", () => {
    expect(normaliseEmail("  Reader@Example.COM ")).toBe("reader@example.com");
  });

  it("keeps a plus tag, because removing it merges mailboxes on purpose kept apart", () => {
    // `+tag` is how people track who sold their address. Stripping it silently
    // defeats that and collapses two mailboxes their owner meant to separate.
    expect(normaliseEmail("reader+mg@example.com")).toBe("reader+mg@example.com");
  });

  it("keeps dots, because they are provider-defined rather than ours to remove", () => {
    // Gmail treats a.b@ and ab@ as one mailbox; RFC 5321 says the local part
    // belongs to the provider. Normalising here would be a guess about a
    // provider we do not know.
    expect(normaliseEmail("a.b@example.com")).toBe("a.b@example.com");
  });

  it("is idempotent", () => {
    const once = normaliseEmail(" A@B.com ");
    expect(normaliseEmail(once)).toBe(once);
  });
});

describe("isPlausibleEmail", () => {
  it.each([
    "reader@example.com",
    "reader+mg@example.com",
    "a.b@sub.example.co.uk",
    "  Reader@Example.com  ",
  ])("accepts %s", (value) => {
    expect(isPlausibleEmail(value)).toBe(true);
  });

  it.each([
    ["", "empty"],
    ["reader", "no @"],
    ["@example.com", "no local part"],
    ["reader@", "no domain"],
    ["reader@example", "no dot in the domain"],
    ["reader@.com", "domain starts with a dot"],
    ["reader@example.", "domain ends with a dot"],
    ["reader@ex..ample.com", "consecutive dots"],
    ["read er@example.com", "whitespace inside"],
  ])("rejects %s (%s)", (value) => {
    expect(isPlausibleEmail(value)).toBe(false);
  });

  it("rejects an address longer than the RFC 5321 path limit", () => {
    const long = `${"a".repeat(MAX_EMAIL_LENGTH)}@example.com`;
    expect(long.length).toBeGreaterThan(MAX_EMAIL_LENGTH);
    expect(isPlausibleEmail(long)).toBe(false);
    // And the boundary itself is accepted, so the cap is a cap and not an
    // off-by-one that quietly rejects a legal address.
    const exact = `${"a".repeat(MAX_EMAIL_LENGTH - "@example.com".length)}@example.com`;
    expect(exact.length).toBe(MAX_EMAIL_LENGTH);
    expect(isPlausibleEmail(exact)).toBe(true);
  });

  it("is deliberately permissive about the local part", () => {
    // ⚠️ Asserted so nobody "tightens" this later without deciding to. A
    // stricter validator rejects addresses that work; the confirmation email is
    // the only real test, which is what double opt-in is for.
    expect(isPlausibleEmail("o'brien@example.com")).toBe(true);
    expect(isPlausibleEmail("weird!#$%@example.com")).toBe(true);
  });
});

describe("the stored vocabularies", () => {
  it("recognises exactly the sources the CHECK constraint allows", () => {
    // `0024` spells the same three values in SQL. A source this accepts and the
    // constraint refuses would be a 500 on a live form.
    expect([...SUBSCRIBER_SOURCES]).toEqual(["newsletter", "ctaBand", "unknown"]);
    for (const source of SUBSCRIBER_SOURCES) expect(isSubscriberSource(source)).toBe(true);
  });

  it("refuses anything else, so an unknown source falls back rather than throwing", () => {
    expect(isSubscriberSource("footer")).toBe(false);
    expect(isSubscriberSource(null)).toBe(false);
    expect(isSubscriberSource(undefined)).toBe(false);
  });

  it("keeps `pending` first, because it is the only status anything writes today", () => {
    // Nothing sends a confirmation email, so nothing may claim `confirmed`.
    expect(SUBSCRIBER_STATUSES[0]).toBe("pending");
    expect([...SUBSCRIBER_STATUSES]).toEqual(["pending", "confirmed", "unsubscribed"]);
  });
});

describe("subscriberCsv", () => {
  it("quotes portable rows and keeps honest lifecycle fields", () => {
    expect(
      subscriberCsv([
        {
          email: "reader@example.com",
          source: "newsletter",
          status: "pending",
          createdAt: "2026-09-03T12:00:00.000Z",
          confirmedAt: null,
        },
      ])
    ).toBe(
      'email,source,status,created_at,confirmed_at\r\n"reader@example.com","newsletter","pending","2026-09-03T12:00:00.000Z",""\r\n'
    );
  });

  it("neutralises spreadsheet formulas in public input", () => {
    const csv = subscriberCsv([
      {
        email: "=IMPORTXML@example.com",
        source: "ctaBand",
        status: "pending",
        createdAt: "now",
        confirmedAt: null,
      },
    ]);
    expect(csv).toContain('"\'=IMPORTXML@example.com"');
  });
});
