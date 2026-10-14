import { describe, expect, it } from "vitest";
import { adminClient, anonClient } from "../support/fixtures";

const admin = adminClient();
const visitor = anonClient();

describe("site access control database boundary", () => {
  it("allows anonymous reads of ONLY the operational access key", async () => {
    const record = await visitor
      .from("site_settings")
      .select("key, value")
      .eq("key", "site-access-control")
      .single();
    expect(record.error).toBeNull();
    expect(record.data?.key).toBe("site-access-control");
    expect(record.data?.value).toMatchObject({ mode: "inherit" });

    const secretKey = "test-private-settings-" + Date.now();
    const inserted = await admin
      .from("site_settings")
      .insert({ key: secretKey, value: { private: true } });
    if (inserted.error) throw inserted.error;
    try {
      const hidden = await visitor
        .from("site_settings")
        .select("value")
        .eq("key", secretKey);
      expect(hidden.error).toBeNull();
      expect(hidden.data).toHaveLength(0);
    } finally {
      const cleaned = await admin.from("site_settings").delete().eq("key", secretKey);
      if (cleaned.error) throw cleaned.error;
    }
  });

  it("refuses anonymous changes even to the publicly readable key", async () => {
    const denied = await visitor
      .from("site_settings")
      .update({
        value: { mode: "public", scheduledPublicAt: null, version: 999 },
      })
      .eq("key", "site-access-control")
      .select("key");
    expect(denied.error).toBeNull();
    expect(denied.data).toHaveLength(0);
  });
});
