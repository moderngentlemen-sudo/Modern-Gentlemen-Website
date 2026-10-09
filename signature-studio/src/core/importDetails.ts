/**
 * Fill in details from what people already have: a contact card (.vcf) or
 * the text of their current email signature. Best effort — everything stays
 * editable, and nothing is guessed when it's ambiguous.
 */
import { detectPlatform } from "./social";
import type { DetailKey, SocialPlatform } from "./types";

export interface Imported {
  details: Partial<Record<DetailKey, string>>;
  socials: { platform: SocialPlatform; url: string }[];
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const URL_RE = /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/[^\s<>"')]*)?)/gi;
const HAS_URL = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|co|net|org|io|ca|uk|de|fr|app|dev|studio|design)\b/i;
const PHONE = /(\+?\d[\d\s().-]{6,}\d)(?:\s*(?:ext\.?|x)\s*\d+)?/i;

function unescapeV(v: string) {
  return v
    .replace(/\\n/gi, "\n")
    .replace(/\\([,;\\])/g, "$1")
    .trim();
}

/** vCard 2.1 / 3.0 / 4.0 (the first card in the file). */
export function parseVCard(text: string): Imported {
  // Unfold continuation lines (RFC 6350 §3.2).
  const lines = text
    .replace(/\r\n[ \t]/g, "")
    .replace(/\n[ \t]/g, "")
    .split(/\r?\n/);
  const out: Imported = { details: {}, socials: [] };
  const urls: string[] = [];
  for (const line of lines) {
    const m = /^([^:]+):(.*)$/.exec(line);
    if (!m) continue;
    const [prop, ...params] = m[1].split(";");
    const name = prop.replace(/^item\d+\./i, "").toUpperCase();
    const value = unescapeV(m[2]);
    const types = params.join(";").toUpperCase();
    if (!value) continue;
    switch (name) {
      case "FN":
        out.details.name ??= value;
        break;
      case "N":
        if (!out.details.name) {
          const [last, first] = value.split(";");
          out.details.name = [first, last].filter(Boolean).join(" ").trim();
        }
        break;
      case "TITLE":
        out.details.title ??= value;
        break;
      case "ORG": {
        const [company, dept] = value.split(";");
        out.details.company ??= company?.trim();
        if (dept?.trim()) out.details.department ??= dept.trim();
        break;
      }
      case "EMAIL":
        out.details.email ??= value.replace(/^mailto:/i, "");
        break;
      case "TEL": {
        const num = value.replace(/^tel:/i, "");
        if (/CELL|MOBILE/.test(types)) out.details.mobile ??= num;
        else out.details.phone ??= num;
        break;
      }
      case "URL":
        urls.push(value);
        break;
      case "ADR": {
        const parts = value
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean);
        if (parts.length) out.details.address ??= parts.join(", ");
        break;
      }
      case "X-SOCIALPROFILE":
      case "SOCIALPROFILE":
        urls.push(value.replace(/^x-apple:/i, ""));
        break;
    }
  }
  sortUrls(urls, out);
  // A mobile with no other phone is the phone.
  if (!out.details.phone && out.details.mobile) {
    out.details.phone = out.details.mobile;
    delete out.details.mobile;
  }
  return out;
}

function sortUrls(urls: string[], out: Imported) {
  for (const u of urls) {
    const p = detectPlatform(u);
    if (p !== "custom") {
      if (!out.socials.some((s) => s.platform === p)) out.socials.push({ platform: p, url: u });
    } else out.details.website ??= u.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  }
}

/**
 * The text of an existing signature, as pasted. The first lines are usually
 * name, then title/company; contact details are recognised by shape.
 */
export function parseSignatureText(raw: string): Imported {
  const out: Imported = { details: {}, socials: [] };
  const text = raw.replace(/ /g, " ");
  const email = EMAIL.exec(text)?.[0];
  if (email) out.details.email = email;
  const withoutEmail = email ? text.split(email).join(" ") : text;
  const urls = [...withoutEmail.matchAll(URL_RE)].map((m) => m[1]).filter((u) => !/^\d/.test(u));
  sortUrls(urls, out);

  const lines = text
    .split(/\r?\n|\s[|•·]\s/)
    .map((l) => l.trim())
    .filter(Boolean);
  const phones: { label: string; num: string }[] = [];
  const freeText: string[] = [];
  for (const line of lines) {
    const ph = PHONE.exec(line);
    if (ph && ph[1].replace(/\D/g, "").length >= 7) {
      phones.push({ label: line.slice(0, ph.index).toLowerCase(), num: ph[0].trim() });
      continue;
    }
    if (EMAIL.test(line) || HAS_URL.test(line)) continue;
    if (/^(best|kind|warm)?\s*regards|^thanks|^cheers|^sincerely|^--$/i.test(line)) continue;
    freeText.push(line);
  }
  for (const p of phones) {
    if (/m(ob)?|cell/.test(p.label) && !out.details.mobile) out.details.mobile = p.num;
    else if (!out.details.phone) out.details.phone = p.num;
    else out.details.mobile ??= p.num;
  }
  // Name: the first short line that reads like a name.
  const nameIdx = freeText.findIndex((l) => /^[\p{L}'’.-]+(?:\s+[\p{L}'’.-]+){0,3}$/u.test(l) && l.length <= 40);
  if (nameIdx >= 0) {
    out.details.name = freeText[nameIdx];
    const rest = freeText.slice(nameIdx + 1);
    // "Title, Company" / "Title at Company" / two lines.
    const head = rest[0];
    if (head) {
      const split = /^(.+?)\s*(?:,|\bat\b|@|—|–)\s*(.+)$/i.exec(head);
      if (split) {
        out.details.title = split[1].trim();
        out.details.company = split[2].trim();
      } else {
        out.details.title = head;
        if (rest[1] && rest[1].length <= 60 && !/\d{3}/.test(rest[1])) out.details.company = rest[1];
      }
    }
  }
  const addr = freeText.find((l) => /\d+\s+\p{L}+.*(?:st|street|ave|avenue|rd|road|blvd|way|lane|ln|dr|drive|suite|floor)\b/iu.test(l));
  if (addr) out.details.address = addr;
  return out;
}
