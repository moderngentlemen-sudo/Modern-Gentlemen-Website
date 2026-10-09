/**
 * Digital business card: a shareable, interactive web page generated from the
 * signature. Everything the page needs is compressed into the link itself
 * (no server or database). Images are referenced by their public URLs.
 */
import type { SignatureDoc, SocialPlatform } from "./types";
import { normalizeWebUrl } from "../lib/url";

export interface CardData {
  v: 1;
  n: string; // name
  t?: string; // title
  c?: string; // company
  p?: string; // phone
  m?: string; // mobile
  e?: string; // email
  w?: string; // website
  a?: string; // address
  s?: [SocialPlatform, string][];
  f?: string; // front image URL
  b?: string; // back image URL
  ph?: string; // photo URL
  ac?: string; // accent colour
  bk?: string; // booking URL
}

export function cardDataFromDoc(doc: SignatureDoc, urls: { front?: string; back?: string; photo?: string }): CardData {
  const d = doc.details;
  const opt = (v: string) => (v.trim() ? v.trim() : undefined);
  return {
    v: 1,
    n: d.name.trim(),
    t: opt(d.title),
    c: opt(d.company),
    p: opt(d.phone),
    m: opt(d.mobile),
    e: opt(d.email),
    w: d.website.trim() ? normalizeWebUrl(d.website) : undefined,
    a: opt(d.address),
    s: doc.socials.filter((s) => s.url.trim()).map((s) => [s.platform, /^https?:\/\//i.test(s.url) ? s.url : `https://${s.url}`]),
    f: urls.front,
    b: urls.back,
    ph: urls.photo,
    ac: doc.design.accent,
    bk: doc.addons.meeting.enabled && doc.addons.meeting.url ? normalizeWebUrl(doc.addons.meeting.url) : undefined,
  };
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(data as BodyInit).body!.pipeThrough(stream as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeCard(data: CardData): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(data));
  return toBase64Url(await pipe(json, new CompressionStream("deflate-raw")));
}

export async function decodeCard(token: string): Promise<CardData> {
  const raw = await pipe(fromBase64Url(token), new DecompressionStream("deflate-raw"));
  const data = JSON.parse(new TextDecoder().decode(raw)) as CardData;
  if (data?.v !== 1 || typeof data.n !== "string") throw new Error("Invalid card");
  return data;
}

export function cardPageUrl(origin: string, path: string, token: string): string {
  return `${origin}${path.replace(/\/?$/, "/")}?card=${token}`;
}

/** vCard 3.0 for "Save contact". */
export function vcard(d: CardData): string {
  const escv = (s: string) =>
    s
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/[,;]/g, (m) => `\\${m}`);
  const parts = d.n.trim().split(/\s+/);
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  const first = parts.length > 1 ? parts.slice(0, -1).join(" ") : (parts[0] ?? "");
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${escv(last)};${escv(first)};;;`, `FN:${escv(d.n)}`];
  if (d.c) lines.push(`ORG:${escv(d.c)}`);
  if (d.t) lines.push(`TITLE:${escv(d.t)}`);
  if (d.p) lines.push(`TEL;TYPE=WORK,VOICE:${escv(d.p)}`);
  if (d.m) lines.push(`TEL;TYPE=CELL,VOICE:${escv(d.m)}`);
  if (d.e) lines.push(`EMAIL;TYPE=INTERNET:${escv(d.e)}`);
  if (d.w) lines.push(`URL:${escv(d.w)}`);
  if (d.a) lines.push(`ADR;TYPE=WORK:;;${escv(d.a)};;;;`);
  for (const [, url] of d.s ?? []) lines.push(`URL:${escv(url)}`);
  lines.push("END:VCARD");
  return lines.join("\r\n") + "\r\n";
}
