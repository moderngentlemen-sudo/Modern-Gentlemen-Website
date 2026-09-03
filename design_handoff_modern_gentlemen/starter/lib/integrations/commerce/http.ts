/**
 * The outbound-request guards every adapter needs, in one place.
 *
 * Both guards exist because the destination is operator-supplied: an editor with
 * `integration.write` types a URL or a shop domain into a form, and the server
 * then makes that request. The timeout keeps a stalled provider from holding a
 * server action open; the size cap is enforced *while streaming* rather than
 * after, so an unbounded response is abandoned instead of buffered.
 *
 * This started as private helpers inside `xmlFeed.ts` and moved here when the
 * Shopify adapter arrived. The alternative was a second copy, and this
 * repository already has one expensive lesson about two copies of a rule
 * drifting apart — `writtenOnUpdate` in `lib/domain/ingestion.ts` exists because
 * the diff and the write disagreed about a column. A byte cap that protects the
 * container's memory is not a rule worth keeping two of.
 */

import { AdapterError } from "./types";

/**
 * Generous for a catalogue payload, and small enough that a misconfigured URL
 * pointing at something enormous fails quickly rather than filling the
 * container's memory. Applied **per response** — a paginated adapter walking
 * many pages bounds the whole run with its own page cap.
 */
export const MAX_RESPONSE_BYTES = 20 * 1024 * 1024;

export interface CappedRequest {
  /**
   * How the provider is named in an error message — "The feed", "The Shopify
   * API". Every message this module throws is read by an editor looking at a
   * failed run, so the subject has to be the thing they configured.
   */
  subject: string;
  headers: Record<string, string>;
  timeoutMs: number;
  method?: "GET" | "POST";
  body?: string;
  /**
   * Defaults to `"follow"`, which is right for a feed URL that may be behind a
   * CDN or a shortener.
   *
   * ⚠️ It is *not* right for a request carrying a credential in a custom header.
   * `fetch` strips `Authorization`, `Cookie` and `Proxy-Authorization` on a
   * cross-origin redirect and strips nothing else — so a provider that
   * authenticates with its own header name (Shopify's `X-Shopify-Access-Token`)
   * would hand that token to whatever host a 3xx pointed at. Those adapters pass
   * `"manual"` and treat a redirect as the error it would be.
   */
  redirect?: RequestRedirect;
  /**
   * A chance to explain a specific status better than the default sentence can.
   * Returning `null` falls through to the generic message.
   */
  describeStatus?: (response: Response) => string | null;
  /** Absent means one attempt and no waiting, which is right for most callers. */
  retry?: RetryPolicy;
}

/**
 * A bounded, header-driven retry.
 *
 * ⚠️ **The bounds are the whole design, and this replaces a decision that said
 * "do not retry at all".** That decision was not wrong about the danger — a
 * silent retry loop inside a server action that is holding a request open is how
 * a run that used to fail in ten seconds starts taking four minutes — it was
 * wrong about the magnitude. Shopify's REST Admin API refills its bucket at two
 * requests a second and sends `Retry-After: 2.0`; the wait it is asking for is
 * two seconds, not four minutes.
 *
 * So the retry exists and every axis of it is capped: a total number of
 * attempts, a ceiling on any single wait, and a ceiling on the **sum** of them.
 * The last is what actually bounds the run — without it, three retries each
 * honouring a large `Retry-After` is still a long hold — and it makes the worst
 * case a number this file states rather than one the provider chooses.
 *
 * Why it is worth having at all: an import walks pages, and a 429 on page seven
 * of twelve throws away the six that succeeded. The operator's only remedy is to
 * run it again, at the same page size, into the same limit.
 */
export interface RetryPolicy {
  /** Statuses worth waiting on. A 4xx that is not 429 will not fix itself. */
  statuses: readonly number[];
  /** Total attempts, first one included. `1` disables retrying. */
  maxAttempts: number;
  /** Ceiling on one wait, whatever `Retry-After` asks for. */
  maxDelayMs: number;
  /** Ceiling on the sum of the waits. The real bound on how long a run can hang. */
  totalDelayBudgetMs: number;
  /** Used when the response carries no usable `Retry-After`. */
  defaultDelayMs: number;
  /**
   * Injected so a test does not spend real seconds. Defaults to a timer.
   * `fetchImpl` is already injected the same way throughout this module.
   */
  wait?: (ms: number) => Promise<void>;
}

/**
 * `Retry-After` is either a decimal count of seconds or an HTTP date.
 *
 * Shopify sends the first (`2.0`). The date form is in the specification and
 * costs three lines to support, and the alternative is silently falling back to
 * the default delay for a provider that told us exactly when to come back.
 *
 * Null for anything unparseable or negative — a malformed header must not
 * become `NaN` and then a wait of `NaN` milliseconds, which resolves instantly
 * and turns the backoff into a hot loop.
 */
export function retryAfterMs(header: string | null, now = Date.now()): number | null {
  if (!header) return null;

  const trimmed = header.trim();
  if (trimmed === "") return null;

  const seconds = Number(trimmed);
  if (Number.isFinite(seconds)) return seconds >= 0 ? Math.round(seconds * 1000) : null;

  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return null;

  return Math.max(0, date - now);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface CappedResponse {
  text: string;
  /** Kept because pagination lives in a header — Shopify's `Link`, rel="next". */
  headers: Headers;
  status: number;
}

export async function fetchCapped(
  fetchImpl: typeof globalThis.fetch,
  url: string,
  request: CappedRequest
): Promise<CappedResponse> {
  const policy = request.retry;
  const wait = policy?.wait ?? sleep;
  const attempts = Math.max(1, policy?.maxAttempts ?? 1);
  let spentMs = 0;

  for (let attempt = 1; ; attempt += 1) {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: request.method ?? "GET",
        body: request.body,
        headers: request.headers,
        redirect: request.redirect ?? "follow",
        // Inside the loop on purpose: a signal is consumed once, and reusing one
        // would abort the second attempt the moment the first one's clock ran
        // out. Each attempt gets the timeout the caller asked for.
        signal: AbortSignal.timeout(request.timeoutMs),
        cache: "no-store",
      });
    } catch (error) {
      // ⚠️ A transport failure is deliberately NOT retried, even with a policy
      // set. A timeout has already spent `timeoutMs`, and a request that never
      // arrived may still have been received — retrying a read is safe, and
      // this helper cannot know that every caller's request is one.
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new AdapterError(`${request.subject} did not respond within ${request.timeoutMs}ms.`);
      }
      throw new AdapterError(
        `${request.subject} could not be reached: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (response.ok) {
      return {
        text: await readCapped(response, request.subject),
        headers: response.headers,
        status: response.status,
      };
    }

    const retryable = policy?.statuses.includes(response.status) === true && attempt < attempts;
    const asked = retryable ? (retryAfterMs(response.headers.get("retry-after")) ?? null) : null;
    const delay = retryable ? Math.min(asked ?? policy!.defaultDelayMs, policy!.maxDelayMs) : 0;

    if (retryable && spentMs + delay <= policy!.totalDelayBudgetMs) {
      // Discard the body before waiting. Without this the connection stays open
      // holding a payload already decided against — the same reason `readCapped`
      // cancels its reader when the cap is hit.
      await response.body?.cancel().catch(() => {});
      spentMs += delay;
      await wait(delay);
      continue;
    }

    const described = request.describeStatus?.(response) ?? null;
    throw new AdapterError(
      described ?? `${request.subject} answered ${response.status} ${response.statusText}.`
    );
  }
}

async function readCapped(response: Response, subject: string): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    throw new AdapterError(
      `${subject} declares ${declared} bytes, over the ${MAX_RESPONSE_BYTES}-byte limit.`
    );
  }

  if (!response.body) return response.text();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        // Cancelling matters: without it the connection stays open pulling
        // bytes we have already decided not to keep.
        await reader.cancel();
        throw new AdapterError(`${subject} exceeded the ${MAX_RESPONSE_BYTES}-byte limit.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8").decode(merged);
}

/**
 * The same request discipline, for bytes rather than text.
 *
 * `fetchCapped` decodes as UTF-8, which is right for a feed and destroys an
 * image. This shares the timeout, the declared-length pre-check and the
 * streamed cap — the parts that matter — and stops before the decode.
 *
 * ⚠️ **Its own, smaller cap.** 20 MB is a sane ceiling for a whole product feed
 * and an absurd one for a single photograph: a run importing 60 images at that
 * limit could pull 1.2 GB through a server action. `maxBytes` defaults to
 * `MAX_IMAGE_BYTES`, and the caller may lower it but the streamed check is what
 * enforces it — a lying `content-length` buys nothing.
 *
 * ⚠️ **`redirect: "follow"` is right here and would be wrong for an
 * authenticated call.** Image URLs are routinely CDN redirects, and this request
 * carries no credential — see `CappedRequest.redirect` for why the Shopify
 * adapter passes `"manual"` instead.
 */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export interface BinaryResponse {
  bytes: ArrayBuffer;
  /** From `content-type`, parameters stripped. `null` when the server sent none. */
  contentType: string | null;
}

export async function fetchBinaryCapped(
  fetchImpl: typeof globalThis.fetch,
  url: string,
  request: { subject: string; timeoutMs: number; maxBytes?: number }
): Promise<BinaryResponse> {
  const maxBytes = request.maxBytes ?? MAX_IMAGE_BYTES;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(request.timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new AdapterError(`${request.subject} did not respond within ${request.timeoutMs}ms.`);
    }
    throw new AdapterError(
      `${request.subject} could not be reached: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!response.ok) {
    throw new AdapterError(
      `${request.subject} answered ${response.status} ${response.statusText}.`
    );
  }

  const declared = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new AdapterError(
      `${request.subject} declares ${declared} bytes, over the ${maxBytes}-byte limit.`
    );
  }

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || null;

  if (!response.body) {
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > maxBytes) {
      throw new AdapterError(`${request.subject} exceeded the ${maxBytes}-byte limit.`);
    }
    return { bytes, contentType };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        // Cancelling matters: without it the connection stays open pulling
        // bytes we have already decided not to keep.
        await reader.cancel();
        throw new AdapterError(`${request.subject} exceeded the ${maxBytes}-byte limit.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { bytes: merged.buffer as ArrayBuffer, contentType };
}
