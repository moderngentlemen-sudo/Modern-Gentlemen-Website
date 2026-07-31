import { describe, expect, it } from "vitest";
import {
  EMPTY_PERMISSIONS,
  ForbiddenError,
  PERMISSIONS,
  PermissionSet,
  UnauthenticatedError,
} from "./permissions";

describe("PermissionSet", () => {
  const set = new PermissionSet(["page.read", "page.write", "media.read"]);

  it("reports held permissions", () => {
    expect(set.has("page.write")).toBe(true);
  });

  it("denies permissions that were not granted", () => {
    expect(set.has("page.publish")).toBe(false);
  });

  it("denies everything when empty", () => {
    expect(EMPTY_PERMISSIONS.has("page.read")).toBe(false);
    expect(EMPTY_PERMISSIONS.size).toBe(0);
  });

  describe("hasAny", () => {
    it("is true when one of several is held", () => {
      expect(set.hasAny("page.publish", "page.read")).toBe(true);
    });

    it("is false when none are held", () => {
      expect(set.hasAny("product.write", "theme.publish")).toBe(false);
    });

    it("is false with no arguments — an empty requirement grants nothing", () => {
      expect(set.hasAny()).toBe(false);
    });
  });

  describe("assert", () => {
    it("passes silently when held", () => {
      expect(() => set.assert("page.read")).not.toThrow();
    });

    it("throws ForbiddenError naming the missing permission", () => {
      expect(() => set.assert("page.publish")).toThrow(ForbiddenError);
      try {
        set.assert("page.publish");
      } catch (err) {
        expect((err as ForbiddenError).permission).toBe("page.publish");
        expect((err as Error).message).toContain("page.publish");
      }
    });
  });

  it("ignores unknown permission strings from the database", () => {
    // A stale row must not widen the typed surface.
    const withJunk = new PermissionSet(["page.read", "totally.made.up"]);
    expect(withJunk.toArray()).toEqual(["page.read"]);
  });

  it("deduplicates overlapping grants from multiple roles", () => {
    const overlapping = new PermissionSet(["page.read", "page.read", "media.read"]);
    expect(overlapping.size).toBe(2);
  });

  it("returns permissions in catalogue order, not insertion order", () => {
    const shuffled = new PermissionSet(["media.read", "page.read"]);
    expect(shuffled.toArray()).toEqual(["page.read", "media.read"]);
  });
});

describe("permission catalogue", () => {
  it("has no duplicates", () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });

  it("uses resource.action shape throughout", () => {
    for (const p of PERMISSIONS) expect(p).toMatch(/^[a-z]+\.[a-z]+$/);
  });
});

describe("auth errors", () => {
  it("are distinguishable by name for error handling", () => {
    expect(new ForbiddenError("page.read").name).toBe("ForbiddenError");
    expect(new UnauthenticatedError().name).toBe("UnauthenticatedError");
  });
});
