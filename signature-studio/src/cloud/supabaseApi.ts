/** The real cloud: a separate Signet Supabase project (never the website's database). */
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { SignatureDoc } from "../core/types";
import type { CardData } from "../core/digitalCard";
import type { SuggestRequest } from "../core/aiSuggest";
import { CloudError, type CloudApi, type CloudUser, type LiveBannerRow, type SuggestError, type RemoteDoc, type RemoteMeta, type WriteResult } from "./api";

export const BUCKET = "signet-images";

const toUser = (u: User | null | undefined): CloudUser | null =>
  u
    ? { id: u.id, email: u.email ?? undefined, name: (u.user_metadata?.full_name as string | undefined) ?? (u.user_metadata?.name as string | undefined) }
    : null;

function check<T>(r: { data: T; error: { message: string; code?: string } | null }): T {
  if (r.error) throw new CloudError(r.error.message);
  return r.data;
}

export class SupabaseApi implements CloudApi {
  readonly kind = "supabase" as const;
  private sb: SupabaseClient;

  constructor(
    private url: string,
    key: string,
  ) {
    this.sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } });
  }

  private async uid(): Promise<string> {
    const u = await this.getUser();
    if (!u) throw new CloudError("Not signed in");
    return u.id;
  }

  async getUser() {
    const { data } = await this.sb.auth.getSession();
    return toUser(data.session?.user);
  }

  onAuthChange(fn: (user: CloudUser | null) => void) {
    const { data } = this.sb.auth.onAuthStateChange((_e, session) => fn(toUser(session?.user)));
    return () => data.subscription.unsubscribe();
  }

  async signInWithEmail(email: string, redirectTo: string) {
    const { error } = await this.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    if (error) throw new CloudError(error.message);
  }

  async signInWithGoogle(redirectTo: string) {
    const { error } = await this.sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) throw new CloudError(error.message);
  }

  async signOut() {
    await this.sb.auth.signOut();
  }

  async listMeta(): Promise<RemoteMeta[]> {
    return check(await this.sb.from("signatures").select("id, revision, deleted")) as RemoteMeta[];
  }

  async fetchDocs(ids: string[]): Promise<RemoteDoc[]> {
    if (!ids.length) return [];
    return check(await this.sb.from("signatures").select("id, revision, deleted, doc").in("id", ids)) as RemoteDoc[];
  }

  async insertDoc(doc: SignatureDoc): Promise<WriteResult> {
    const r = await this.sb.from("signatures").insert({ id: doc.id, doc }).select("revision").single();
    if (r.error?.code === "23505") return { ok: false, conflict: true };
    return { ok: true, revision: check(r)!.revision as number };
  }

  async updateDoc(id: string, expected: number, doc: SignatureDoc | null, deleted = false): Promise<WriteResult> {
    const patch = doc ? { doc, deleted } : { deleted };
    const rows = check(await this.sb.from("signatures").update(patch).eq("id", id).eq("revision", expected).select("revision")) ?? [];
    return rows.length ? { ok: true, revision: rows[0].revision as number } : { ok: false, conflict: true };
  }

  async getPrefs() {
    const uid = await this.uid();
    const row = check(await this.sb.from("profiles").select("prefs").eq("id", uid).maybeSingle());
    return (row?.prefs as Record<string, unknown> | undefined) ?? {};
  }

  async putPrefs(prefs: Record<string, unknown>) {
    const uid = await this.uid();
    check(await this.sb.from("profiles").update({ prefs }).eq("id", uid));
  }

  async upload(path: string, blob: Blob, mime: string) {
    const full = `${await this.uid()}/${path}`;
    const { error } = await this.sb.storage.from(BUCKET).upload(full, blob, { contentType: mime, upsert: false, cacheControl: "31536000" });
    // Content-addressed paths: "already exists" means the same bytes are already there.
    if (error && !/exists|duplicate/i.test(error.message)) throw new CloudError(error.message);
    return this.sb.storage.from(BUCKET).getPublicUrl(full).data.publicUrl;
  }

  async download(path: string) {
    const { data, error } = await this.sb.storage.from(BUCKET).download(`${await this.uid()}/${path}`);
    return error ? null : data;
  }

  async deleteAccount() {
    const uid = await this.uid();
    const bucket = this.sb.storage.from(BUCKET);
    for (const folder of ["o", "s"]) {
      for (;;) {
        const { data, error } = await bucket.list(`${uid}/${folder}`, { limit: 1000 });
        if (error) throw new CloudError(error.message);
        if (!data?.length) break;
        const { error: rm } = await bucket.remove(data.map((f) => `${uid}/${folder}/${f.name}`));
        if (rm) throw new CloudError(rm.message);
        if (data.length < 1000) break;
      }
    }
    const { error } = await this.sb.rpc("delete_my_account");
    if (error) throw new CloudError(error.message);
    await this.sb.auth.signOut();
  }

  async saveCard(slug: string, signatureId: string, data: CardData) {
    const uid = await this.uid();
    const mine = check(await this.sb.from("cards").select("slug").eq("owner", uid).eq("signature_id", signatureId).maybeSingle());
    const r = mine
      ? await this.sb.from("cards").update({ slug, data }).eq("owner", uid).eq("signature_id", signatureId)
      : await this.sb.from("cards").insert({ slug, signature_id: signatureId, data });
    if (r.error?.code === "23505") return { ok: false as const, taken: true as const };
    check(r);
    return { ok: true as const };
  }

  async cardSlugFor(signatureId: string) {
    const uid = await this.uid();
    const row = check(await this.sb.from("cards").select("slug").eq("owner", uid).eq("signature_id", signatureId).maybeSingle());
    return (row?.slug as string | undefined) ?? null;
  }

  async getCard(slug: string) {
    const row = check(await this.sb.from("cards").select("data").eq("slug", slug).maybeSingle());
    return (row?.data as CardData | undefined) ?? null;
  }

  liveBase() {
    return `${this.url.replace(/\/$/, "")}/functions/v1`;
  }

  async saveLiveBanner(r: LiveBannerRow) {
    check(
      await this.sb.from("live_banners").upsert({
        slug: r.slug,
        signature_id: r.signatureId,
        block_id: r.blockId,
        mode: r.mode,
        items: r.items,
        fallback: r.fallback,
        track: r.track,
      }),
    );
  }

  async bannerClicks(slug: string, sinceDays: number) {
    const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString();
    const rows = check(await this.sb.from("banner_clicks").select("item").eq("slug", slug).gte("at", since).limit(10000));
    const out: Record<number, number> = {};
    for (const r of rows as { item: number }[]) out[r.item] = (out[r.item] ?? 0) + 1;
    return out;
  }

  async suggestDesigns(request: SuggestRequest) {
    const { data, error } = await this.sb.functions.invoke("suggest-layout", { body: { request } });
    if (!error) return { ok: true as const, data };
    // The function answers with { error: "<reason>" } and a status; read it if we can.
    let reason: SuggestError = "failed";
    try {
      const body = (await (error as { context?: Response }).context?.json()) as { error?: string } | undefined;
      if (body?.error && ["not_configured", "limit", "sign_in", "declined", "busy"].includes(body.error)) reason = body.error as SuggestError;
    } catch {
      /* keep "failed" */
    }
    return { ok: false as const, error: reason };
  }
}
