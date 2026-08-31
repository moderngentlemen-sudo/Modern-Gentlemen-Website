import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as RateLimit from "./rateLimit";

const { insertFormSubmission, consumeRateLimit } = vi.hoisted(() => ({
  insertFormSubmission: vi.fn(),
  consumeRateLimit: vi.fn(),
}));

vi.mock("@/lib/db/public", () => ({ createPublicClient: () => ({}) }));
vi.mock("@/lib/db/repositories/forms", () => ({ insertFormSubmission }));
vi.mock("./rateLimit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  consumeRateLimit,
}));

import { submitPublicForm } from "./forms";

describe("submitPublicForm", () => {
  const good = {
    formKey: "contact-form",
    fields: { name: "Ada", email: "ada@example.com" },
    pagePath: "/contact",
    honeypot: "",
    identity: "203.0.113.8",
  };

  beforeEach(() => {
    insertFormSubmission.mockReset().mockResolvedValue(undefined);
    consumeRateLimit.mockReset().mockResolvedValue(true);
  });

  it("stores a normalised bounded submission", async () => {
    await expect(submitPublicForm(good)).resolves.toEqual({ ok: true });
    expect(insertFormSubmission).toHaveBeenCalledWith(expect.anything(), {
      formKey: "contact-form",
      payload: { name: "Ada", email: "ada@example.com" },
      pagePath: "/contact",
    });
  });

  it("spends both limits before validation", async () => {
    await submitPublicForm({ ...good, fields: {} });
    expect(consumeRateLimit).toHaveBeenCalledTimes(2);
    expect(insertFormSubmission).not.toHaveBeenCalled();
  });

  it("silently accepts a honeypot without writing", async () => {
    await expect(submitPublicForm({ ...good, honeypot: "spam" })).resolves.toEqual({ ok: true });
    expect(insertFormSubmission).not.toHaveBeenCalled();
  });

  it("does not expose storage errors", async () => {
    insertFormSubmission.mockRejectedValue(new Error("relation does not exist"));
    await expect(submitPublicForm(good)).resolves.toEqual({ ok: false, reason: "unavailable" });
  });
});
