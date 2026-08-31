import { createPublicClient } from "@/lib/db/public";
import { insertFormSubmission } from "@/lib/db/repositories/forms";
import { normaliseFormSubmission, type FormSubmissionOutcome } from "@/lib/domain/forms";
import { consumeRateLimit, FORM_GLOBAL, FORM_PER_CALLER } from "./rateLimit";

export async function submitPublicForm(input: {
  formKey: unknown;
  fields: unknown;
  pagePath: unknown;
  honeypot: unknown;
  identity: string | null;
}): Promise<FormSubmissionOutcome> {
  const [callerAllowed, globalAllowed] = await Promise.all([
    input.identity === null
      ? Promise.resolve(true)
      : consumeRateLimit({ scope: "form", identity: input.identity, ...FORM_PER_CALLER }),
    consumeRateLimit({ scope: "form", identity: "*", ...FORM_GLOBAL }),
  ]);
  if (!callerAllowed || !globalAllowed) return { ok: false, reason: "rate-limited" };

  // Bots commonly fill this visually hidden field. Return the same success as a
  // real write so it cannot be used to tune around the trap.
  if (typeof input.honeypot === "string" && input.honeypot.length > 0) return { ok: true };

  const submission = normaliseFormSubmission(input);
  if (!submission) return { ok: false, reason: "invalid-form" };

  try {
    await insertFormSubmission(createPublicClient(), submission);
    return { ok: true };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
