import { describe, expect, it } from "vitest";

import {
  AUTOSAVE_REVISION_INTERVAL_MS,
  BLOCK_TREE_KEY,
  DOCUMENT_TYPES,
  canTransition,
  isDocumentType,
  isPublished,
  isSchedulable,
  nextVersion,
  shouldWriteAutosaveRevision,
  statusesFor,
} from "./documents";

describe("document types", () => {
  it("recognises the four versioned entities and nothing else", () => {
    expect(isDocumentType("page")).toBe(true);
    // `categories` carries the same columns but is not independently
    // publishable, and 0010's allowlist leaves it out too.
    expect(isDocumentType("category")).toBe(false);
    expect(isDocumentType("")).toBe(false);
  });

  it("leaves `theme` out, even though 0017 puts it on the SQL allowlist", () => {
    // `theme_settings` carries every document column and `document_table()`
    // resolves it since 0017, so publish/rollback/history all work — but the
    // TypeScript union deliberately stays at five. `permissionFor` in
    // lib/services/documents.ts builds `${type}.${action}` and narrows it to
    // `Permission`; there is no `theme.delete`, so widening this union does not
    // typecheck, and forcing it would cascade into DOCUMENT_TABLES,
    // BLOCK_TREE_KEY, createPreview and the media_usages entity gate.
    // lib/services/theme.ts passes the literal "theme" to the RPC instead.
    expect(isDocumentType("theme")).toBe(false);
  });

  it("only lets pages and articles be scheduled", () => {
    // Mirrors schedulable_document_table(): templates have no scheduled_for
    // column and patterns have no 'scheduled' status.
    expect(isSchedulable("page")).toBe(true);
    expect(isSchedulable("article")).toBe(true);
    expect(isSchedulable("template")).toBe(false);
    expect(isSchedulable("pattern")).toBe(false);
  });

  it("omits 'scheduled' from the statuses a pattern can hold", () => {
    expect(statusesFor("pattern")).not.toContain("scheduled");
    expect(statusesFor("page")).toContain("scheduled");
  });

  it("names a block-tree key for every type", () => {
    for (const type of DOCUMENT_TYPES) expect(BLOCK_TREE_KEY).toHaveProperty(type);
    expect(BLOCK_TREE_KEY.page).toBe("sections");
    expect(BLOCK_TREE_KEY.pattern).toBe("blocks");
    // Templates hold named areas rather than one ordered list.
    expect(BLOCK_TREE_KEY.template).toBeNull();
  });
});

describe("canTransition", () => {
  it("allows the ordinary editing moves", () => {
    expect(canTransition("draft", "published")).toBe(true);
    expect(canTransition("published", "draft")).toBe(true);
    expect(canTransition("draft", "scheduled")).toBe(true);
    expect(canTransition("scheduled", "published")).toBe(true);
  });

  it("allows re-publishing an already published document", () => {
    expect(canTransition("published", "published")).toBe(true);
  });

  it("refuses to bring an archived document straight back online", () => {
    // Reopening it as a draft first is the point: someone should look at it.
    expect(canTransition("archived", "published")).toBe(false);
    expect(canTransition("archived", "draft")).toBe(true);
  });

  it("allows archiving from any live state", () => {
    expect(canTransition("draft", "archived")).toBe(true);
    expect(canTransition("published", "archived")).toBe(true);
    expect(canTransition("scheduled", "archived")).toBe(true);
  });
});

describe("nextVersion", () => {
  it("advances by one", () => {
    expect(nextVersion(0)).toBe(1);
    expect(nextVersion(41)).toBe(42);
  });

  it("refuses a version that could not have come from the database", () => {
    expect(() => nextVersion(-1)).toThrow(RangeError);
    expect(() => nextVersion(1.5)).toThrow(RangeError);
  });
});

describe("isPublished", () => {
  it("needs both the status and a payload", () => {
    expect(isPublished("published", { sections: [] })).toBe(true);
    // Status says published but nothing was ever written — treat as not live.
    expect(isPublished("published", null)).toBe(false);
    expect(isPublished("draft", { sections: [] })).toBe(false);
  });
});

describe("shouldWriteAutosaveRevision", () => {
  const now = new Date("2026-07-31T12:00:00Z");

  it("always takes the first checkpoint on a document with no history", () => {
    expect(shouldWriteAutosaveRevision(null, now)).toBe(true);
  });

  it("skips while a recent revision exists", () => {
    const oneMinuteAgo = new Date(now.getTime() - 60_000);
    expect(shouldWriteAutosaveRevision(oneMinuteAgo, now)).toBe(false);
  });

  it("writes once the interval has elapsed", () => {
    const stale = new Date(now.getTime() - AUTOSAVE_REVISION_INTERVAL_MS);
    expect(shouldWriteAutosaveRevision(stale, now)).toBe(true);
  });

  it("honours a caller-supplied interval", () => {
    const tenSecondsAgo = new Date(now.getTime() - 10_000);
    expect(shouldWriteAutosaveRevision(tenSecondsAgo, now, 5_000)).toBe(true);
    expect(shouldWriteAutosaveRevision(tenSecondsAgo, now, 30_000)).toBe(false);
  });
});
