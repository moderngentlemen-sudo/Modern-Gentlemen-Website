/**
 * App state: the open signature (with undo/redo), the list of signatures,
 * editor UI state and preferences. Saving is automatic.
 */
import { create } from "zustand";
import { produce, type Draft } from "immer";
import type { SignatureDoc, Variant } from "../core/types";
import { defaultCard } from "../core/defaults";
import { docStore, prefStore, DEFAULT_PREFS, type Prefs } from "../storage/db";

export type Tab = "templates" | "details" | "images" | "social" | "design" | "addons" | "card" | "install";

export interface Toast {
  id: number;
  message: string;
  tone: "info" | "success" | "error";
  action?: { label: string; run: () => void };
}

interface State {
  view: "home" | "editor";
  docs: SignatureDoc[];
  doc: SignatureDoc | null;
  past: SignatureDoc[];
  future: SignatureDoc[];
  lastKey: string | null;
  lastTime: number;
  tab: Tab;
  variant: Variant;
  device: "desktop" | "mobile";
  darkPreview: boolean;
  fallbackFonts: boolean;
  saving: "saved" | "saving" | "error";
  prefs: Prefs;
  toasts: Toast[];
  dialog: null | "install" | "settings" | "crop" | "templates";
  dialogArg: string | null;
}

const LIMIT = 150;
const COALESCE = 900;
let toastSeq = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useStudio = create<State>(() => ({
  view: "home",
  docs: [],
  doc: null,
  past: [],
  future: [],
  lastKey: null,
  lastTime: 0,
  tab: "templates",
  variant: "full",
  device: "desktop",
  darkPreview: false,
  fallbackFonts: false,
  saving: "saved",
  prefs: DEFAULT_PREFS,
  toasts: [],
  dialog: null,
  dialogArg: null,
}));

const get = () => useStudio.getState();
const set = (p: Partial<State>) => useStudio.setState(p);

/** Edit the open signature. Rapid edits with the same key are one undo step. */
export function edit(recipe: (d: Draft<SignatureDoc>) => void, key?: string) {
  const { doc, past, lastKey, lastTime } = get();
  if (!doc) return;
  const next = produce(doc, recipe);
  if (next === doc) return;
  const now = Date.now();
  const coalesce = !!key && key === lastKey && now - lastTime < COALESCE;
  set({ doc: next, past: coalesce ? past : [...past.slice(-LIMIT + 1), doc], future: [], lastKey: key ?? null, lastTime: now });
  scheduleSave();
}

/** Change without an undo step (e.g. the verified-image cache). */
export function editSilently(recipe: (d: Draft<SignatureDoc>) => void) {
  const { doc } = get();
  if (!doc) return;
  const next = produce(doc, recipe);
  if (next !== doc) {
    set({ doc: next });
    scheduleSave();
  }
}

export function undo() {
  const { past, future, doc } = get();
  if (!past.length || !doc) return;
  const prev = { ...past[past.length - 1], published: doc.published, digitalCardUrl: doc.digitalCardUrl };
  set({ doc: prev, past: past.slice(0, -1), future: [doc, ...future], lastKey: null });
  scheduleSave();
}

export function redo() {
  const { past, future, doc } = get();
  if (!future.length || !doc) return;
  const next = { ...future[0], published: doc.published, digitalCardUrl: doc.digitalCardUrl };
  set({ doc: next, past: [...past, doc], future: future.slice(1), lastKey: null });
  scheduleSave();
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  set({ saving: "saving" });
  saveTimer = setTimeout(() => void flushSave(), 500);
}

export async function flushSave() {
  const { doc } = get();
  if (!doc) return;
  try {
    const saved = { ...doc, updatedAt: Date.now() };
    await docStore.put(saved);
    const docs = get().docs.filter((d) => d.id !== saved.id);
    set({ saving: "saved", docs: [saved, ...docs] });
  } catch {
    set({ saving: "error" });
    toast("Couldn't save in this browser. Export a backup from Settings.", "error");
  }
}

export async function loadAll() {
  const [docs, prefs] = await Promise.all([docStore.list(), prefStore.get()]);
  set({ docs: docs.map((d) => ({ ...d, card: { ...defaultCard(), ...d.card } })), prefs });
}

export function openDoc(doc: SignatureDoc, tab: State["tab"] = "details") {
  set({ doc, past: [], future: [], view: "editor", tab, variant: "full", lastKey: null });
  updatePrefs({ lastDocId: doc.id });
}

export async function createDoc(doc: SignatureDoc) {
  await docStore.put(doc);
  set({ docs: [doc, ...get().docs] });
  openDoc(doc, "details");
}

export async function deleteDoc(id: string) {
  await docStore.remove(id);
  set({ docs: get().docs.filter((d) => d.id !== id) });
  if (get().doc?.id === id) set({ doc: null, view: "home" });
}

export function goHome() {
  void flushSave();
  set({ view: "home", dialog: null });
}

export function updatePrefs(patch: Partial<Prefs>) {
  const prefs = { ...get().prefs, ...patch };
  set({ prefs });
  void prefStore.put(prefs);
}

export function toast(message: string, tone: Toast["tone"] = "info", action?: Toast["action"]) {
  const id = ++toastSeq;
  set({ toasts: [...get().toasts.slice(-2), { id, message, tone, action }] });
  setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), action ? 7000 : 3800);
}

export function ui(patch: Partial<State>) {
  set(patch);
}
