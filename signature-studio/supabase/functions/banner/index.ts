// Live banners: public redirects behind a signature's banner.
//
//   GET /banner/<slug>/img  → 302 to the banner picture that is current now
//   GET /banner/<slug>/go   → 302 to that banner's link (and, if the owner
//                             opted in, counts the click: slug, item, time —
//                             no IP address, no user agent, no cookie)
//
// Deployed with verify_jwt = false: email clients can't send a token. It only
// ever reads `live_banners` and appends to `banner_clicks`, using the service
// role key from the function's own environment.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { pickBanner, safeTarget, type LiveRow } from "./pick.ts";

const BASE = Deno.env.get("SUPABASE_URL")!;
// Pictures may only come from this project's own public image bucket.
const IMAGES = `${BASE}/storage/v1/object/public/signet-images/`;

const sb = createClient(BASE, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const redirect = (to: string) =>
  new Response(null, {
    status: 302,
    headers: {
      Location: to,
      // Ask every cache (including mail image proxies) not to keep the answer.
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Referrer-Policy": "no-referrer",
    },
  });

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
  const m = /\/banner\/([a-z0-9]{8,24})\/(img|go)\/?$/.exec(new URL(req.url).pathname);
  if (!m) return notFound();
  const [, slug, what] = m;
  const { data, error } = await sb.from("live_banners").select("mode, items, fallback, track").eq("slug", slug).maybeSingle();
  if (error || !data) return notFound();
  const pick = pickBanner(data as LiveRow & { track: boolean }, Date.now());
  if (what === "img") {
    const img = safeTarget(pick.item.image);
    return img && img.startsWith(IMAGES) ? redirect(img) : notFound();
  }
  const to = safeTarget(pick.item.link) ?? safeTarget((data as LiveRow).fallback.link);
  if (!to) return notFound();
  if ((data as { track: boolean }).track && req.method === "GET") {
    // Counting must never delay or break the visitor's redirect.
    await sb
      .from("banner_clicks")
      .insert({ slug, item: pick.index })
      .then(
        () => undefined,
        () => undefined,
      );
  }
  return redirect(to);
});
