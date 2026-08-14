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
}

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
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: request.headers,
      redirect: request.redirect ?? "follow",
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
    const described = request.describeStatus?.(response) ?? null;
    throw new AdapterError(
      described ?? `${request.subject} answered ${response.status} ${response.statusText}.`
    );
  }

  return {
    text: await readCapped(response, request.subject),
    headers: response.headers,
    status: response.status,
  };
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
