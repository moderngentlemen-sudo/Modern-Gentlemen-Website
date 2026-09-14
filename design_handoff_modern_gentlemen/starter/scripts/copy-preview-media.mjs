/**
 * Copy only the media catalogue already imported into the isolated preview.
 * Source files are fetched from public URLs; no production secret is needed.
 * Existing target objects are compared, never overwritten.
 */
import { createHash } from "node:crypto";
import { previewConfig } from "./preview/config.mjs";

async function main() {
  const config = previewConfig(process.env);
  const assetIds = [...new Set(process.argv.slice(2))];
  if (
    assetIds.length === 0 ||
    assetIds.length > 500 ||
    assetIds.some((id) => !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))
  ) {
    throw new Error("Pass the explicit asset IDs from the published-content export");
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (key.length < 24 || key === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("The preview project's server key is required for Storage uploads");
  }
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const headers = (apiKey) => ({
    apikey: apiKey,
    ...(apiKey.startsWith("sb_") ? {} : { Authorization: "Bearer " + apiKey }),
  });
  const listing = await fetch(
    config.database.origin +
      "/rest/v1/media_assets?select=id,bucket,storage_path,external_url,mime_type,byte_size&order=id&id=in.(" +
      assetIds.join(",") +
      ")",
    { headers: headers(publicKey), signal: AbortSignal.timeout(30_000) }
  );
  if (!listing.ok) throw new Error("Could not read the preview media catalogue");
  const assets = await listing.json();
  if (!Array.isArray(assets) || assets.length !== assetIds.length) {
    throw new Error("Every requested asset must exist in the imported preview catalogue");
  }
  const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
  async function boundedBytes(response) {
    if (!response.ok || !response.body) throw new Error("Could not fetch a media object");
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 25 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("Media object exceeds the 25 MiB transfer limit");
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }
  let copied = 0;
  let verifiedExisting = 0;
  let external = 0;
  for (const asset of assets) {
    if (asset.external_url) {
      external++;
      continue;
    }
    if (
      asset.bucket !== "media" ||
      typeof asset.storage_path !== "string" ||
      !asset.storage_path ||
      asset.storage_path.split("/").some((part) => !part || part === "." || part === "..")
    ) {
      throw new Error("Invalid scoped media destination");
    }
    const path =
      asset.bucket + "/" + asset.storage_path.split("/").map(encodeURIComponent).join("/");
    const publicPath = "/storage/v1/object/public/" + path;
    const bytes = await boundedBytes(
      await fetch(config.source.origin + publicPath, {
        signal: AbortSignal.timeout(30_000),
        redirect: "error",
      })
    );
    if (asset.byte_size !== null && bytes.length !== Number(asset.byte_size)) {
      throw new Error("Source media size differs from its imported catalogue record");
    }
    const upload = await fetch(config.database.origin + "/storage/v1/object/" + path, {
      method: "POST",
      headers: {
        ...headers(key),
        "content-type": asset.mime_type || "application/octet-stream",
        "x-upsert": "false",
      },
      body: bytes,
      signal: AbortSignal.timeout(60_000),
    });
    let exists = false;
    if (!upload.ok) {
      const error = await upload.json().catch(() => ({}));
      exists =
        upload.status === 409 || error.error === "Duplicate" || String(error.statusCode) === "409";
      if (!exists) throw new Error("Preview Storage upload failed with HTTP " + upload.status);
    }
    const target = await boundedBytes(
      await fetch(config.database.origin + publicPath, {
        signal: AbortSignal.timeout(30_000),
        redirect: "error",
      })
    );
    if (digest(target) !== digest(bytes)) {
      throw new Error("Target media differs from the source; no existing object was overwritten");
    }
    if (exists) verifiedExisting++;
    else copied++;
  }
  process.stdout.write(
    JSON.stringify({ copied, verifiedExisting, externalReferences: external }) + "\n"
  );
}

main().catch((error) => {
  process.stderr.write("Preview media copy failed: " + error.message + "\n");
  process.exitCode = 1;
});
