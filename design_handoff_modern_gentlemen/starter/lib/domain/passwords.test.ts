import { describe, expect, it } from "vitest";

import {
  MAX_PASSWORD_BYTES,
  MIN_PASSWORD_LENGTH,
  passwordByteLength,
  passwordProblem,
  passwordSchema,
} from "./passwords";

const GOOD = "correct horse battery staple";

describe("passwordSchema", () => {
  it("accepts a long passphrase", () => {
    expect(passwordSchema.safeParse(GOOD).success).toBe(true);
  });

  it("refuses one shorter than the minimum", () => {
    expect(passwordSchema.safeParse("a".repeat(MIN_PASSWORD_LENGTH - 1)).success).toBe(false);
    expect(passwordSchema.safeParse("a".repeat(MIN_PASSWORD_LENGTH)).success).toBe(true);
  });

  it("refuses one that is only whitespace", () => {
    expect(passwordSchema.safeParse(" ".repeat(MIN_PASSWORD_LENGTH + 4)).success).toBe(false);
  });
});

/**
 * The byte cap is the half most likely to be "tidied" away by someone who reads
 * it as an arbitrary limit, so it is tested in the units that actually matter.
 * bcrypt truncates at 72 bytes and says nothing, so anything past it is stored
 * but never protects the account.
 */
describe("the bcrypt byte ceiling", () => {
  it("counts bytes, not characters", () => {
    // Each of these is one character and four bytes.
    const emoji = "🔐".repeat(20);
    expect(emoji.length).toBeLessThan(MAX_PASSWORD_BYTES);
    expect(passwordByteLength(emoji)).toBe(80);
    expect(passwordSchema.safeParse(emoji).success).toBe(false);
  });

  it("accepts exactly the ceiling and refuses one byte more", () => {
    expect(passwordSchema.safeParse("a".repeat(MAX_PASSWORD_BYTES)).success).toBe(true);
    expect(passwordSchema.safeParse("a".repeat(MAX_PASSWORD_BYTES + 1)).success).toBe(false);
  });

  it("explains that the tail would be ignored rather than just refusing", () => {
    const result = passwordSchema.safeParse("a".repeat(MAX_PASSWORD_BYTES + 1));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toMatch(/silently ignored/);
  });
});

describe("passwordProblem", () => {
  it("passes a valid, matching pair", () => {
    expect(passwordProblem(GOOD, GOOD)).toBeNull();
  });

  it("reports a mismatch", () => {
    expect(passwordProblem(GOOD, `${GOOD}!`)).toMatch(/do not match/);
  });

  it("prefers the specific complaint over the mismatch", () => {
    // Both wrong: too short AND mismatched. The length is the actionable one.
    expect(passwordProblem("short", "different")).toMatch(/at least/);
  });
});
