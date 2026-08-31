export const MAX_FORM_FIELDS = 20;
export const MAX_FORM_KEY_LENGTH = 80;
export const MAX_FORM_VALUE_LENGTH = 5_000;
export const MAX_FORM_PAYLOAD_BYTES = 32_000;

const SAFE_KEY = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const SAFE_FIELD = /^[a-z][a-z0-9_]{0,63}$/;
const BLOCKED_FIELDS = new Set(["__proto__", "constructor", "prototype"]);

export type FormValue = string | boolean;
export type FormPayload = Record<string, FormValue>;

export type FormSubmissionOutcome =
  { ok: true } | { ok: false; reason: "invalid-form" | "rate-limited" | "unavailable" };

export function normaliseFormSubmission(input: {
  formKey: unknown;
  fields: unknown;
  pagePath: unknown;
}): { formKey: string; payload: FormPayload; pagePath: string | null } | null {
  if (typeof input.formKey !== "string") return null;
  const formKey = input.formKey.trim().toLowerCase();
  if (formKey.length > MAX_FORM_KEY_LENGTH || !SAFE_KEY.test(formKey)) return null;
  if (!input.fields || typeof input.fields !== "object" || Array.isArray(input.fields)) return null;

  const entries = Object.entries(input.fields as Record<string, unknown>);
  if (entries.length === 0 || entries.length > MAX_FORM_FIELDS) return null;

  const payload: FormPayload = Object.create(null) as FormPayload;
  for (const [name, rawValue] of entries) {
    if (BLOCKED_FIELDS.has(name) || !SAFE_FIELD.test(name)) return null;
    if (typeof rawValue !== "string" && typeof rawValue !== "boolean") return null;
    const value = typeof rawValue === "string" ? rawValue.trim() : rawValue;
    if (typeof value === "string" && value.length > MAX_FORM_VALUE_LENGTH) return null;
    payload[name] = value;
  }

  if (new TextEncoder().encode(JSON.stringify(payload)).length > MAX_FORM_PAYLOAD_BYTES)
    return null;
  const pagePath = typeof input.pagePath === "string" ? input.pagePath.slice(0, 500) : null;
  return { formKey, payload, pagePath };
}
