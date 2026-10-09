/**
 * Picks the cloud backend. Accounts are optional: with no Supabase settings
 * (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY) the app stays local-only and
 * hides every account feature. Test builds can opt into the fake backend.
 */
import type { CloudApi } from "./api";
import { FakeApi } from "./fakeApi";
import { SupabaseApi } from "./supabaseApi";
import { TEST_HOST_ENABLED } from "../lib/url";

export const FAKE_CLOUD_FLAG = "signet.fakeCloud";

function pick(): CloudApi | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (url && key) return new SupabaseApi(url, key);
  try {
    if (TEST_HOST_ENABLED && localStorage.getItem(FAKE_CLOUD_FLAG)) return new FakeApi("signet.fakeCloud.db");
  } catch {
    // Storage blocked: stay local-only.
  }
  return null;
}

export const cloud: CloudApi | null = pick();
export const cloudEnabled = !!cloud;
