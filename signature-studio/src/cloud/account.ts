/**
 * The signed-in account and cloud sync, wired to the app's local storage.
 * Sync runs after sign-in, a couple of seconds after any local change, when
 * the connection comes back, and every few minutes while the app is open.
 * Signing out keeps this device's signatures; they just stop syncing.
 */
import { create } from "zustand";
import type { SignatureDoc } from "../core/types";
import { assetStore, docStore, syncStateStore } from "../storage/db";
import { hydrateSources } from "../store/assets";
import { goHome, localChangeListeners, toast, updatePrefs, useStudio } from "../store/editor";
import type { Prefs } from "../storage/db";
import { cloud } from "./index";
import type { CloudUser } from "./api";
import { emptySyncState, runSync, type LocalSide, type SyncState } from "./engine";
import { quickHash, stableStringify, SYNCED_PREFS } from "./plan";
import { cardDataFromDoc } from "../core/digitalCard";
import { cardShortUrl, makeSlug } from "../core/cardSlug";

export type SyncStatus = "off" | "idle" | "syncing" | "error" | "offline";

interface AccountState {
  ready: boolean;
  user: CloudUser | null;
  status: SyncStatus;
  lastSynced: number | null;
  error: string | null;
}

export const useAccount = create<AccountState>(() => ({ ready: !cloud, user: null, status: "off", lastSynced: null, error: null }));

const redirect = () => `${location.origin}/app`;

export async function signInWithEmail(email: string) {
  await cloud!.signInWithEmail(email.trim(), redirect());
}

export async function signInWithGoogle() {
  await cloud!.signInWithGoogle(redirect());
}

export async function signOut() {
  await cloud!.signOut();
  toast("Signed out. Your signatures stay on this device.", "info");
}

function localSide(userId: string): LocalSide {
  return {
    listDocs: () => docStore.list(),
    putDoc: (d) => docStore.put(d),
    removeDoc: (id) => docStore.remove(id),
    getAsset: (id) => assetStore.get(id),
    putAsset: (id, b) => assetStore.put(id, b),
    getState: async () => ({ ...emptySyncState(), ...((await syncStateStore.get<SyncState>(userId)) ?? {}) }),
    putState: (s) => syncStateStore.put(userId, s),
    getPrefs: () => useStudio.getState().prefs as unknown as Record<string, unknown>,
    setPrefs: (p) => {
      // Synced keys are replaced as a set, so a removal on another device removes here too.
      const patch = Object.fromEntries(SYNCED_PREFS.map((k) => [k, p[k]])) as Partial<Prefs>;
      updatingFromCloud = true;
      try {
        updatePrefs(patch);
      } finally {
        updatingFromCloud = false;
      }
    },
  };
}

/** Delete the account and its cloud data. This device keeps its own copies. */
export async function deleteAccount() {
  const user = useAccount.getState().user;
  await cloud!.deleteAccount();
  if (user) await syncStateStore.put(user.id, emptySyncState());
  useAccount.setState({ user: null, status: "off" });
  toast("Your account and everything stored in it were deleted. Signatures on this device are still here.", "success");
}

let running: Promise<void> | null = null;
let again = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let updatingFromCloud = false;

export function syncSoon(delay = 2000) {
  if (!cloud || !useAccount.getState().user || updatingFromCloud) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

export async function syncNow(): Promise<void> {
  const user = useAccount.getState().user;
  if (!cloud || !user) return;
  if (running) {
    again = true;
    return running;
  }
  if (!navigator.onLine) return void useAccount.setState({ status: "offline" });
  running = (async () => {
    useAccount.setState({ status: "syncing", error: null });
    const st = useStudio.getState();
    const openBefore = st.doc;
    try {
      const report = await runSync(cloud, localSide(user.id));
      applyReport(report.changed, report.removed, openBefore);
      await refreshCards();
      if (report.conflicts.length) toast(`Edited on two devices at once — kept both. Look for “${report.conflicts[0]}”.`, "info");
      useAccount.setState({ status: "idle", lastSynced: Date.now() });
    } catch (e) {
      useAccount.setState({ status: navigator.onLine ? "error" : "offline", error: e instanceof Error ? e.message : String(e) });
    } finally {
      running = null;
      if (again) {
        again = false;
        syncSoon(500);
      }
    }
  })();
  return running;
}

/** Show what sync wrote: refresh the list, and the open signature if nobody touched it meanwhile. */
function applyReport(changed: SignatureDoc[], removed: string[], openBefore: SignatureDoc | null) {
  if (!changed.length && !removed.length) return;
  const st = useStudio.getState();
  const byId = new Map(changed.map((d) => [d.id, d]));
  const docs = [...changed.filter((d) => !st.docs.some((x) => x.id === d.id)), ...st.docs.map((d) => byId.get(d.id) ?? d)].filter(
    (d) => !removed.includes(d.id),
  );
  useStudio.setState({ docs: docs.sort((a, b) => b.updatedAt - a.updatedAt) });
  void hydrateSources(changed.flatMap((d) => Object.keys(d.assets)));
  const open = st.doc;
  if (!open) return;
  if (removed.includes(open.id)) {
    goHome();
    toast("That signature was deleted on another device.", "info");
  } else if (byId.has(open.id) && open === openBefore) {
    useStudio.setState({ doc: byId.get(open.id)!, past: [], future: [] });
  }
}

/**
 * Give the signature's digital card a short link (/c/<slug>) and store its
 * contents behind it. Returns the link, or null when not signed in.
 */
export async function publishCard(doc: SignatureDoc, images: NonNullable<SignatureDoc["cardImages"]>): Promise<string | null> {
  if (!cloud || !useAccount.getState().user) return null;
  const data = cardDataFromDoc(doc, images);
  let slug = doc.cardSlug ?? (await cloud.cardSlugFor(doc.id)) ?? makeSlug(doc.details.name || doc.name);
  for (let i = 0; i < 4; i++) {
    const r = await cloud.saveCard(slug, doc.id, data);
    if (r.ok) {
      cardSent.set(doc.id, quickHash(stableStringify(data)));
      return cardShortUrl(location.origin, slug);
    }
    slug = makeSlug(doc.details.name || doc.name);
  }
  return null;
}

/** Last card contents sent per signature, so unchanged cards aren't re-sent. */
const cardSent = new Map<string, string>();

/** Short-link cards follow their signature: after a sync, send any card whose details changed. */
async function refreshCards() {
  for (const d of useStudio.getState().docs) {
    if (!d.cardSlug || !d.cardImages) continue;
    const data = cardDataFromDoc(d, d.cardImages);
    const h = quickHash(stableStringify(data));
    if (cardSent.get(d.id) === h) continue;
    const r = await cloud!.saveCard(d.cardSlug, d.id, data);
    if (r.ok) cardSent.set(d.id, h);
  }
}

/** Start listening for sign-in changes (once, at app start). */
export function startAccount() {
  if (!cloud) return;
  const onUser = (user: CloudUser | null) => {
    const prev = useAccount.getState().user;
    useAccount.setState({ user, ready: true, status: user ? "idle" : "off" });
    if (user && user.id !== prev?.id) void syncNow();
  };
  cloud.onAuthChange(onUser);
  void cloud.getUser().then(onUser);
  localChangeListeners.add(() => syncSoon());
  window.addEventListener("online", () => syncSoon(200));
  setInterval(() => document.visibilityState === "visible" && syncSoon(0), 3 * 60 * 1000);
}
