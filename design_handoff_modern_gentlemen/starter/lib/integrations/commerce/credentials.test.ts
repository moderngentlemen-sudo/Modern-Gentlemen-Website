import { afterEach, describe, expect, it } from "vitest";

import { adapterFor, isCredentialRef, resolveCredential } from "./index";
import { AdapterError } from "./types";

/**
 * `credentials_ref` is a string an operator types into a form, and resolving it
 * means indexing `process.env` with it. The `FEED_` rule is what keeps that from
 * being an exfiltration primitive, so it gets a test rather than only a comment.
 */
describe("resolveCredential", () => {
  const added: string[] = [];

  function setEnv(name: string, value: string) {
    process.env[name] = value;
    added.push(name);
  }

  afterEach(() => {
    for (const name of added.splice(0)) delete process.env[name];
  });

  it("resolves a FEED_-prefixed variable", () => {
    setEnv("FEED_TEST_TOKEN", "s3cret");
    expect(resolveCredential("FEED_TEST_TOKEN")).toBe("s3cret");
  });

  it("returns null when the source names no credential", () => {
    expect(resolveCredential(null)).toBeNull();
    expect(resolveCredential("")).toBeNull();
  });

  /**
   * The case the prefix exists for: without it, an operator with
   * `integration.write` could point a source at the service-role key and have
   * the run send it as a bearer token to a URL they also control.
   */
  it("refuses to read a variable outside the FEED_ namespace", () => {
    setEnv("SUPABASE_SERVICE_ROLE_KEY", "would-be-leaked");
    expect(() => resolveCredential("SUPABASE_SERVICE_ROLE_KEY")).toThrow(AdapterError);
    expect(() => resolveCredential("NEXT_PUBLIC_SUPABASE_URL")).toThrow(/FEED_/);
  });

  it("refuses a lookalike that only starts with the prefix", () => {
    expect(isCredentialRef("FEED_OK")).toBe(true);
    expect(isCredentialRef("FEEDX_TOKEN")).toBe(false);
    expect(isCredentialRef("feed_token")).toBe(false);
    expect(isCredentialRef("FEED_TOKEN; rm -rf")).toBe(false);
  });

  it("says which variable is missing rather than failing silently", () => {
    expect(() => resolveCredential("FEED_ABSENT")).toThrow(/FEED_ABSENT is not set/);
  });
});

describe("adapterFor", () => {
  it("serves the XML feed adapter", () => {
    expect(adapterFor("xml_feed").kind).toBe("xml_feed");
  });

  it("explains that a native source has nothing to import from", () => {
    expect(() => adapterFor("native")).toThrow(/no feed to import from/);
  });

  it("refuses a kind with no adapter yet", () => {
    expect(() => adapterFor("shopify")).toThrow(/not implemented|No adapter/);
  });
});
