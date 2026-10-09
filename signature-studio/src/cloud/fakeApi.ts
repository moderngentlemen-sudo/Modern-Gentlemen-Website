/**
 * In-memory cloud for unit tests and test builds. Mirrors the database rules
 * that matter to sync: per-user rows, revision checks, tombstones, unique slugs.
 * With `persistKey` it survives reloads (stored in localStorage), which lets
 * an end-to-end test play "a second device".
 */
import type { SignatureDoc } from "../core/types";
import type { CardData } from "../core/digitalCard";
import type { SuggestRequest } from "../core/aiSuggest";
import { CloudError, type CloudApi, type CloudUser, type LiveBannerRow, type RemoteDoc, type WriteResult } from "./api";

interface Row {
  doc: SignatureDoc;
  revision: number;
  deleted: boolean;
}

interface FakeState {
  session: CloudUser | null;
  docs: Record<string, Record<string, Row>>;
  prefs: Record<string, Record<string, unknown>>;
  files: Record<string, { mime: string; data: string }>;
  cards: Record<string, { owner: string; signatureId: string; data: CardData }>;
  banners?: Record<string, LiveBannerRow & { owner: string }>;
  clicks?: { slug: string; item: number; at: number }[];
}

const empty = (): FakeState => ({ session: null, docs: {}, prefs: {}, files: {}, cards: {}, banners: {}, clicks: [] });

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

export class FakeApi implements CloudApi {
  readonly kind = "fake" as const;
  private state: FakeState;
  private listeners = new Set<(u: CloudUser | null) => void>();
  /** Count of writes, for tests. */
  writes = 0;

  constructor(private persistKey?: string) {
    let saved: FakeState | null = null;
    try {
      saved = persistKey ? (JSON.parse(localStorage.getItem(persistKey) ?? "null") as FakeState | null) : null;
    } catch {
      saved = null;
    }
    this.state = saved ?? empty();
  }

  private save() {
    if (this.persistKey) localStorage.setItem(this.persistKey, JSON.stringify(this.state));
  }

  private me(): string {
    if (!this.state.session) throw new CloudError("Not signed in");
    return this.state.session.id;
  }

  private rows() {
    return (this.state.docs[this.me()] ??= {});
  }

  /** Test helper: change a row as if another device had. */
  remoteEdit(id: string, change: (doc: SignatureDoc) => void) {
    const row = this.rows()[id];
    change(row.doc);
    row.revision++;
    this.save();
  }

  async getUser() {
    return this.state.session;
  }

  onAuthChange(fn: (u: CloudUser | null) => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  private setSession(u: CloudUser | null) {
    this.state.session = u;
    this.save();
    this.listeners.forEach((fn) => fn(u));
  }

  async signInWithEmail(email: string) {
    this.setSession({ id: `user-${email.toLowerCase()}`, email });
  }

  async signInWithGoogle() {
    this.setSession({ id: "user-google", email: "google.user@example.com", name: "Google User" });
  }

  async signOut() {
    this.setSession(null);
  }

  async listMeta() {
    return Object.entries(this.rows()).map(([id, r]) => ({ id, revision: r.revision, deleted: r.deleted }));
  }

  async fetchDocs(ids: string[]): Promise<RemoteDoc[]> {
    const rows = this.rows();
    return ids.filter((id) => rows[id]).map((id) => ({ id, revision: rows[id].revision, deleted: rows[id].deleted, doc: structuredClone(rows[id].doc) }));
  }

  async insertDoc(doc: SignatureDoc): Promise<WriteResult> {
    const rows = this.rows();
    if (rows[doc.id]) return { ok: false, conflict: true };
    rows[doc.id] = { doc: structuredClone(doc), revision: 1, deleted: false };
    this.writes++;
    this.save();
    return { ok: true, revision: 1 };
  }

  async updateDoc(id: string, expected: number, doc: SignatureDoc | null, deleted = false): Promise<WriteResult> {
    const row = this.rows()[id];
    if (!row || row.revision !== expected) return { ok: false, conflict: true };
    if (doc) row.doc = structuredClone(doc);
    row.deleted = deleted;
    row.revision++;
    this.writes++;
    this.save();
    return { ok: true, revision: row.revision };
  }

  async getPrefs() {
    return structuredClone(this.state.prefs[this.me()] ?? {});
  }

  async putPrefs(prefs: Record<string, unknown>) {
    this.state.prefs[this.me()] = structuredClone(prefs);
    this.save();
  }

  async upload(path: string, blob: Blob, mime: string) {
    const key = `${this.me()}/${path}`;
    if (!this.state.files[key]) {
      this.state.files[key] = { mime, data: await toDataUrl(blob) };
      this.save();
    }
    return `https://fake-cloud.invalid/${key}`;
  }

  async download(path: string) {
    const f = this.state.files[`${this.me()}/${path}`];
    return f ? (await fetch(f.data)).blob() : null;
  }

  async deleteAccount() {
    const me = this.me();
    delete this.state.docs[me];
    delete this.state.prefs[me];
    for (const k of Object.keys(this.state.files)) if (k.startsWith(`${me}/`)) delete this.state.files[k];
    for (const [s, c] of Object.entries(this.state.cards)) if (c.owner === me) delete this.state.cards[s];
    this.setSession(null);
  }

  async saveCard(slug: string, signatureId: string, data: CardData) {
    const me = this.me();
    const taken = this.state.cards[slug];
    if (taken && !(taken.owner === me && taken.signatureId === signatureId)) return { ok: false as const, taken: true as const };
    for (const [s, c] of Object.entries(this.state.cards)) if (c.owner === me && c.signatureId === signatureId && s !== slug) delete this.state.cards[s];
    this.state.cards[slug] = { owner: me, signatureId, data: structuredClone(data) };
    this.save();
    return { ok: true as const };
  }

  async cardSlugFor(signatureId: string) {
    const me = this.me();
    return Object.entries(this.state.cards).find(([, c]) => c.owner === me && c.signatureId === signatureId)?.[0] ?? null;
  }

  async getCard(slug: string) {
    return this.state.cards[slug]?.data ?? null;
  }

  /** Test builds serve this path themselves (see tests/e2e). */
  liveBase() {
    return `${location.origin}/__live`;
  }

  async saveLiveBanner(r: LiveBannerRow) {
    const me = this.me();
    const banners = (this.state.banners ??= {});
    const had = banners[r.slug];
    if (had && had.owner !== me) throw new CloudError("That banner belongs to someone else");
    banners[r.slug] = { ...structuredClone(r), owner: me };
    this.save();
  }

  async bannerClicks(slug: string, sinceDays: number) {
    const me = this.me();
    if (this.state.banners?.[slug]?.owner !== me) return {};
    const since = Date.now() - sinceDays * 86_400_000;
    const out: Record<number, number> = {};
    for (const c of this.state.clicks ?? []) if (c.slug === slug && c.at >= since) out[c.item] = (out[c.item] ?? 0) + 1;
    return out;
  }

  /** Test helper: what the public endpoint would record. */
  recordClick(slug: string, item: number) {
    (this.state.clicks ??= []).push({ slug, item, at: Date.now() });
    this.save();
  }

  /** Deterministic stand-in: three other templates, the first with a new accent and serif headings. */
  async suggestDesigns(request: SuggestRequest) {
    this.me();
    const others = request.templates.filter((t) => t.id !== request.current.template).slice(0, 3);
    return {
      ok: true as const,
      data: {
        suggestions: others.map((t, i) => ({
          templateId: t.id,
          title: `Direction ${i + 1}`,
          why: `A ${t.category.toLowerCase()} look for a ${request.role || "professional"}.`,
          accent: i === 0 ? "#0f766e" : request.current.accent,
          headingFont: i === 0 ? "playfair" : request.current.headingFont,
          bodyFont: request.current.bodyFont,
        })),
      },
    };
  }
}
