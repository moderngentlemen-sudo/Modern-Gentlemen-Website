/**
 * What the app needs from the cloud, as one small interface. The Supabase
 * implementation (`supabaseApi.ts`) is the real one; `fakeApi.ts` is an
 * in-memory stand-in for tests and test builds. Nothing outside `src/cloud`
 * talks to Supabase directly.
 */
import type { SignatureDoc } from "../core/types";
import type { CardData } from "../core/digitalCard";
import type { LiveRow } from "../core/liveBanner";
import type { SuggestRequest } from "../core/aiSuggest";

export interface CloudUser {
  id: string;
  email?: string;
  name?: string;
}

export interface RemoteMeta {
  id: string;
  revision: number;
  deleted: boolean;
}

export interface RemoteDoc extends RemoteMeta {
  doc: SignatureDoc;
}

/** Result of a conditional write: `conflict` when the expected revision was stale. */
export type WriteResult = { ok: true; revision: number } | { ok: false; conflict: true };

export interface CloudApi {
  readonly kind: "supabase" | "fake";

  // Auth
  getUser(): Promise<CloudUser | null>;
  onAuthChange(fn: (user: CloudUser | null) => void): () => void;
  signInWithEmail(email: string, redirectTo: string): Promise<void>;
  signInWithGoogle(redirectTo: string): Promise<void>;
  signOut(): Promise<void>;

  // Signatures
  listMeta(): Promise<RemoteMeta[]>;
  fetchDocs(ids: string[]): Promise<RemoteDoc[]>;
  insertDoc(doc: SignatureDoc): Promise<WriteResult>;
  /** Write only if the row is still at `expected`; tombstone with `deleted`. */
  updateDoc(id: string, expected: number, doc: SignatureDoc | null, deleted?: boolean): Promise<WriteResult>;

  // Preferences (saved profile, brand kit, my templates…)
  getPrefs(): Promise<Record<string, unknown>>;
  putPrefs(prefs: Record<string, unknown>): Promise<void>;

  // Files (the user's own folder in the image bucket)
  /** Upload once; an existing object at the same path counts as success. Returns its public URL. */
  upload(path: string, blob: Blob, mime: string): Promise<string>;
  download(path: string): Promise<Blob | null>;

  /** Remove the account and everything stored in it (images, signatures, cards). */
  deleteAccount(): Promise<void>;

  // Digital cards behind short links
  saveCard(slug: string, signatureId: string, data: CardData): Promise<{ ok: true } | { ok: false; taken: true }>;
  cardSlugFor(signatureId: string): Promise<string | null>;
  getCard(slug: string): Promise<CardData | null>;

  // Live banners (scheduled / rotating, optional click counts)
  /** Base URL emails use for live banners (`<base>/banner/<slug>/img|go`). */
  liveBase(): string;
  saveLiveBanner(row: LiveBannerRow): Promise<void>;
  /** Clicks per banner item (-1 = the fallback) since `sinceDays` ago. */
  bannerClicks(slug: string, sinceDays: number): Promise<Record<number, number>>;

  /** AI design suggestions (raw; validate with core/aiSuggest). */
  suggestDesigns(request: SuggestRequest): Promise<{ ok: true; data: unknown } | { ok: false; error: SuggestError }>;
}

export type SuggestError = "not_configured" | "limit" | "sign_in" | "declined" | "busy" | "failed";

export interface LiveBannerRow extends LiveRow {
  slug: string;
  signatureId: string;
  blockId: string;
  track: boolean;
}

export class CloudError extends Error {}
