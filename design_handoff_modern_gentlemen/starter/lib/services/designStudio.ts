import { readFile } from "node:fs/promises";
import path from "node:path";
import { requirePermission } from "./auth";
import { supabaseUrl } from "@/lib/db/env";

const assets = {
  "index.html": "text/html; charset=utf-8",
  "editorial-tailoring.png": "image/png",
  "mega-menu-architecture.png": "image/png",
} as const;

export async function readDesignStudio(asset: string) {
  const user = await requirePermission("page.write");
  if (!Object.hasOwn(assets, asset)) return null;
  const name = asset as keyof typeof assets;
  const bytes = await readFile(path.join(process.cwd(), "studio-assets", name));
  const body =
    name === "index.html"
      ? bytes
          .toString("utf8")
          .replaceAll("mg-builder-", `mg-builder-${user.id}-`)
          .replace(
            /(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(")/i,
            (_match, start, policy: string, end) =>
              start +
              policy.replace(
                /\b(img-src|media-src) ([^;]+)/g,
                (directive) => `${directive} ${new URL(supabaseUrl()).origin}`
              ) +
              end
          )
      : new Uint8Array(bytes);
  return { body, contentType: assets[name] };
}
