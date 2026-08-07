/**
 * Seeds the database from the demo modules the site currently renders from.
 *
 * This is the migration path off hardcoded data: lib/catalog.ts,
 * lib/editorial.ts and lib/articles.ts are read as the source, so the seeded
 * rows are exactly what the pixel-verified site already displays. Once the
 * public routes read from the database (Phase 7), those modules are deleted.
 *
 * Idempotent — upserts on natural keys, so it is safe to re-run.
 *
 *   npx tsx scripts/seed.ts
 */
import { statSync } from "node:fs";
import { basename, join } from "node:path";
import { config } from "dotenv";
import type { Json } from "../lib/db/database.types";
import { createAdminClient } from "../lib/db/admin";
import { DEMO_SECTIONS } from "../lib/demo/home-sections";
import { MEDIA_BUCKET } from "../lib/domain/media";
import { poundsToPence } from "../lib/domain/money";
import { allProducts } from "../lib/demo/catalog";
import { categorySlugs, getCategory } from "../lib/editorial";

config({ path: ".env.local" });

const db = createAdminClient();

function ok<T>(label: string, { data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function seedProducts() {
  const source = ok(
    "native source",
    await db.from("product_sources").select("id").eq("kind", "native").single()
  );
  if (!source) throw new Error("No native product source — did migration 0005 run?");

  const rows = allProducts().map((p, i) => ({
    slug: p.slug,
    source_id: source.id,
    fulfilment: "direct" as const,
    name: p.name,
    cat: p.cat,
    cat_label: p.catLabel,
    blurb: p.blurb,
    story: p.story,
    material: p.material,
    // Catalog prices are whole pounds; pence is the canonical internal unit.
    price_pence: poundsToPence(p.price),
    stock: 100,
    badges: p.tag ? [p.tag] : [],
    specs: p.specs,
    position: i,
    status: "published" as const,
    published_data: { sections: [], seo: {} },
    published_at: new Date().toISOString(),
    version: 1,
  }));

  ok("products", await db.from("products").upsert(rows, { onConflict: "slug" }).select("id"));
  return rows.length;
}

/**
 * The catalogue rows for the seven JPEGs in `public/images/`.
 *
 * These are not uploads. `0002_media.sql` gives `media_assets` an
 * `external_url` column for exactly this case — "assets that are not stored by
 * us (legacy /public files, embeds)" — and Next already serves these files off
 * disk. So the rows describe where the bytes are rather than moving them: no
 * storage consumed, no upload step in CI, and the public site keeps resolving
 * the same `/images/x.jpg` URLs it always has.
 *
 * When a real photograph replaces one, the upload sets `storage_path` and
 * clears `external_url` on the same row. `product_media` points at the asset,
 * not at the URL, so nothing downstream moves.
 *
 * `width`/`height` stay null. They exist so the builder can reserve space
 * without a fetch, and nothing on the store reads them — inventing numbers here
 * would be worse than the honest absence.
 */
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

/** `images/x.jpg` and `/images/x.jpg` are the same file. Only the name matters. */
const fileNameOf = (imagePath: string) => basename(imagePath);

function demoImageFileNames(): string[] {
  return [...new Set(allProducts().flatMap((p) => p.images.map(fileNameOf)))].sort();
}

async function seedMediaAssets() {
  const rows = demoImageFileNames().map((fileName) => {
    const extension = fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
    const mimeType = MIME_BY_EXTENSION[extension];
    if (!mimeType) throw new Error(`No MIME type known for ${fileName}`);

    return {
      bucket: MEDIA_BUCKET,
      // Namespaced so a later real upload of the same name cannot collide with
      // the legacy record on `unique (bucket, storage_path)`.
      storage_path: `legacy/${fileName}`,
      external_url: `/images/${fileName}`,
      kind: "image" as const,
      mime_type: mimeType,
      file_name: fileName,
      byte_size: statSync(join(process.cwd(), "public", "images", fileName)).size,
    };
  });

  ok(
    "media assets",
    await db.from("media_assets").upsert(rows, { onConflict: "bucket,storage_path" }).select("id")
  );
  return rows.length;
}

/**
 * The gallery join, which is what the public product pages read.
 *
 * Ordered by the demo catalog's own `images` array, so the first image is the
 * one the cards have always shown. Role follows position: the first is
 * 'primary', the rest 'gallery'.
 */
async function seedProductMedia() {
  const products = ok("product ids", await db.from("products").select("id, slug")) as {
    id: string;
    slug: string;
  }[];
  const assets = ok(
    "asset ids",
    await db.from("media_assets").select("id, storage_path").eq("bucket", MEDIA_BUCKET)
  ) as { id: string; storage_path: string }[];

  const productIdBySlug = new Map(products.map((p) => [p.slug, p.id]));
  const assetIdByFileName = new Map(assets.map((a) => [basename(a.storage_path), a.id]));

  const rows: {
    product_id: string;
    asset_id: string;
    position: number;
    role: "primary" | "gallery";
  }[] = [];

  for (const product of allProducts()) {
    const productId = productIdBySlug.get(product.slug);
    if (!productId) throw new Error(`No seeded product for slug "${product.slug}"`);

    // `product_media`'s primary key is (product_id, asset_id), so the same file
    // twice in one product would be an upsert onto itself rather than a second
    // slot. Take the first occurrence and keep the positions contiguous.
    const seen = new Set<string>();
    for (const image of product.images) {
      const assetId = assetIdByFileName.get(fileNameOf(image));
      if (!assetId) throw new Error(`No seeded asset for image "${image}"`);
      if (seen.has(assetId)) continue;
      seen.add(assetId);

      rows.push({
        product_id: productId,
        asset_id: assetId,
        position: seen.size - 1,
        role: seen.size === 1 ? "primary" : "gallery",
      });
    }
  }

  ok(
    "product media",
    await db.from("product_media").upsert(rows, { onConflict: "product_id,asset_id" })
  );
  return rows.length;
}

async function seedCategories() {
  const rows = categorySlugs.map((slug, i) => {
    const c = getCategory(slug);
    return {
      slug,
      name: c?.name ?? slug,
      intro: c?.blurb ?? null,
      position: i,
      status: "published" as const,
      published_data: { sections: [], seo: {} },
      published_at: new Date().toISOString(),
      version: 1,
    };
  });

  ok("categories", await db.from("categories").upsert(rows, { onConflict: "slug" }).select("id"));
  return rows.length;
}

/**
 * Seeds the homepage from the very module the route renders, so the stored
 * layout is provably identical to what the site shows.
 */
async function seedHomePage() {
  const sections = DEMO_SECTIONS;
  const payload = { sections: sections as unknown as Json[], seo: { title: "Modern Gentlemen" } };

  ok(
    "home page",
    await db
      .from("pages")
      .upsert(
        [
          {
            slug: "home",
            title: "Home",
            is_system: true,
            status: "published" as const,
            draft_data: payload,
            published_data: payload,
            published_at: new Date().toISOString(),
            version: 1,
          },
        ],
        { onConflict: "slug" }
      )
      .select("id")
  );
  return sections.length;
}

async function grantAdmin(email: string) {
  const { data, error } = await db.auth.admin.listUsers();
  if (error) throw new Error(`listUsers: ${error.message}`);

  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.log(`  admin grant skipped — no account yet for ${email}.`);
    console.log(`  Sign up, then re-run this script to receive the admin role.`);
    return;
  }

  ok(
    "admin grant",
    await db
      .from("user_roles")
      .upsert([{ user_id: user.id, role_key: "admin" }], { onConflict: "user_id,role_key" })
      .select("user_id")
  );
  console.log(`  granted admin to ${email}`);
}

async function main() {
  console.log("Seeding Modern Gentlemen…");
  console.log(`  products:   ${await seedProducts()}`);
  // Assets before the join, products before both: `product_media` carries a
  // foreign key to each side and cannot be written until they exist.
  console.log(`  media:      ${await seedMediaAssets()} assets`);
  console.log(`  gallery:    ${await seedProductMedia()} rows`);
  console.log(`  categories: ${await seedCategories()}`);
  console.log(`  home page:  ${await seedHomePage()} sections`);
  await grantAdmin(process.env.SEED_ADMIN_EMAIL ?? "welcome@moderngentlemen.co");
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
