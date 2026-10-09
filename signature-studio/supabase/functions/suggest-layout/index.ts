// AI design suggestions for a signature.
//
// POST { request: SuggestRequest }  (see src/core/aiSuggest.ts)
// → { suggestions: [{ templateId, title, why, accent?, headingFont?, bodyFont? }] }
//
// Signed-in users only (verify_jwt = true), at most 20 requests a day each.
// The Anthropic API key lives in this function's secrets (ANTHROPIC_API_KEY);
// without it the function answers 503 and the app says suggestions are off.
// The app re-validates everything returned against its own template and font lists.
import Anthropic from "npm:@anthropic-ai/sdk@0.133.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

const DAILY_LIMIT = 20;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["suggestions"],
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["templateId", "title", "why", "accent", "headingFont", "bodyFont"],
        properties: {
          templateId: { type: "string", description: "id of one of the provided templates" },
          title: { type: "string", description: "a short name for this direction, 2-4 words" },
          why: { type: "string", description: "one sentence on why it suits this person" },
          accent: { type: "string", description: "accent colour as #rrggbb" },
          headingFont: { type: "string", description: "id of one of the provided fonts" },
          bodyFont: { type: "string", description: "id of one of the provided fonts" },
        },
      },
    },
  },
};

const SYSTEM = `You suggest email signature designs. You are given a person's role and company, what their signature contains, its current look, an optional brief, and a catalogue of templates and fonts.

Return exactly three suggestions that are clearly different from each other and from the current template. Each one picks a template id from the catalogue and may adjust the accent colour and fonts to suit the person and brief. Prefer templates that use the pieces the person has (for example, photo layouts only when they have a photo). Keep text readable: the accent must have enough contrast on white for links and icons. Fonts marked safe show in every inbox; when you pick one that is not safe, pair it with a safe body font. Use only ids from the catalogue. The "why" is one plain sentence addressed to the person, without flattery.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "not_configured" }, 503);

  // Who is asking (the platform has already verified the token).
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: who } = await admin.auth.getUser(token);
  const uid = who?.user?.id;
  if (!uid) return json({ error: "sign_in" }, 401);

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await admin.from("ai_requests").select("id", { count: "exact", head: true }).eq("owner", uid).gte("at", since);
  if ((count ?? 0) >= DAILY_LIMIT) return json({ error: "limit" }, 429);

  let body: { request?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const input = JSON.stringify(body.request ?? {});
  if (input.length > 40_000) return json({ error: "too_large" }, 413);
  await admin.from("ai_requests").insert({ owner: uid });

  const client = new Anthropic({ apiKey: key });
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      // On a policy decline, Anthropic re-runs the request on its recommended fallback model.
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: `Signature and catalogue (JSON):\n${input}` }],
    } as never);
    const msg = response as unknown as { stop_reason: string; content: { type: string; text?: string }[] };
    if (msg.stop_reason === "refusal") return json({ error: "declined" }, 422);
    const text = msg.content.find((b) => b.type === "text")?.text ?? "";
    return json(JSON.parse(text));
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "busy" }, 503);
    if (e instanceof Anthropic.APIError) return json({ error: "upstream", status: e.status }, 502);
    return json({ error: "failed" }, 500);
  }
});
