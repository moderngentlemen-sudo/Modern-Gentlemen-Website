/**
 * Seeds the database from the demo modules the site currently renders from.
 *
 * This is the migration path off hardcoded data: lib/demo/catalog.ts,
 * lib/editorial.ts and lib/articles.ts are read as the source, so the seeded
 * rows are exactly what the pixel-verified site already displays.
 *
 * Since Phase 7c **every** public route reads the database, so none of the demo
 * modules is runtime data any more — they are this script's input and the
 * fixtures the tests compare the database against. That is why they stay.
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
import { categorySlugs, getCategory } from "../lib/demo/editorial";
import {
  ARTICLES,
  articleSlugs,
  CARD_TAG_LABEL,
  FILED_UNDER,
  relatedFor,
} from "../lib/demo/articles";
import { categoryDocumentSections } from "../lib/demo/category-sections";
import { DEMO_MENUS, type DemoMenuLink } from "../lib/demo/navigation";
import { slugify } from "../lib/domain/slug";

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

/**
 * Every image the demo content references, from both halves of the site. The
 * editorial images happen to be the same seven files the products use, but
 * deriving the list from the products alone made that a coincidence the seeder
 * depended on: drop a photograph from the catalog and an article's hero would
 * quietly have no asset to point at.
 */
function demoImageFileNames(): string[] {
  const productImages = allProducts().flatMap((p) => p.images);
  const editorialImages = articleSlugs
    .map((slug) => ARTICLES[slug].heroImage)
    .filter((image): image is string => Boolean(image));
  const categoryImages = categorySlugs.map((slug) => getCategory(slug)?.heroImage ?? "");

  return [
    ...new Set(
      [...productImages, ...editorialImages, ...categoryImages].filter(Boolean).map(fileNameOf)
    ),
  ].sort();
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

/** File name → asset id, for every catalogued demo image. */
async function assetIdsByFileName(): Promise<Map<string, string>> {
  const assets = ok(
    "asset ids",
    await db.from("media_assets").select("id, storage_path").eq("bucket", MEDIA_BUCKET)
  ) as { id: string; storage_path: string }[];

  return new Map(assets.map((a) => [basename(a.storage_path), a.id]));
}

/**
 * The categories, now as **documents**.
 *
 * `categories` has carried `draft_data` / `published_data` / `version` /
 * `status` since 0004 and nothing had ever written the first three: the landing
 * pages were composed in route code. Since Phase 7c the payload is the page, and
 * its lead and grid are `$bind` descriptors rather than copied cards, so
 * publishing an article updates every category page that lists it without anyone
 * editing a layout.
 */
async function seedCategories(assetIds: Map<string, string>) {
  const rows = categorySlugs.map((slug, i) => {
    const c = getCategory(slug);
    const payload = {
      sections: categoryDocumentSections(slug) as unknown as Json[],
      seo: { title: c?.name ?? slug },
    };

    return {
      slug,
      name: c?.name ?? slug,
      intro: c?.blurb ?? null,
      position: i,
      hero_asset_id: c ? (assetIds.get(fileNameOf(c.heroImage)) ?? null) : null,
      status: "published" as const,
      // Both columns, like the homepage: an editor opening a category in a
      // future builder should find the published layout in the draft, not an
      // empty canvas.
      draft_data: payload,
      published_data: payload,
      published_at: new Date().toISOString(),
      version: 1,
    };
  });

  ok("categories", await db.from("categories").upsert(rows, { onConflict: "slug" }).select("id"));
  return rows.length;
}

// ---------------------------------------------------------------------------
// Editorial — authors, tags, articles and their joins
// ---------------------------------------------------------------------------

/** Every byline in the demo content, deduplicated. */
async function seedAuthors() {
  const names = [...new Set(articleSlugs.map((slug) => ARTICLES[slug].author))].sort();
  const rows = names.map((name) => ({ slug: slugify(name), name }));

  ok("authors", await db.from("authors").upsert(rows, { onConflict: "slug" }).select("id"));
  return rows.length;
}

/**
 * The subcategories the category cards print — "Tailoring", "The Uniform".
 *
 * These are what makes a card tag reproducible from the database at all: the
 * category alone gives "STYLE · 040" where the design shows "TAILORING · 040".
 */
async function seedTags() {
  const labels = [...new Set(Object.values(CARD_TAG_LABEL))].sort();
  const rows = labels.map((label) => ({ slug: slugify(label), label }));

  ok("tags", await db.from("tags").upsert(rows, { onConflict: "slug" }).select("id"));
  return rows.length;
}

/** "11 MIN" → 11. Null rather than 0 for anything unparseable — a missing
 *  reading time is honest; a zero-minute read is a claim. */
function readingMinutes(read: string): number | null {
  const match = read.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

async function seedArticles(assetIds: Map<string, string>) {
  const categories = ok("category ids", await db.from("categories").select("id, slug")) as {
    id: string;
    slug: string;
  }[];
  const authors = ok("author ids", await db.from("authors").select("id, slug")) as {
    id: string;
    slug: string;
  }[];

  const categoryIdBySlug = new Map(categories.map((c) => [c.slug, c.id]));
  const authorIdBySlug = new Map(authors.map((a) => [a.slug, a.id]));

  const rows = articleSlugs.map((slug) => {
    const a = ARTICLES[slug];
    const filedUnder = FILED_UNDER[slug];

    // The display label lives on the payload for *every* article, filed or not.
    // Only the thirty-five filed ones have a category row to derive it from, and
    // a rule with an exception is how the twenty showcases — labelled "The
    // Debrief", "Motoring", "Opinion" — would have ended up printing nothing.
    const payload = {
      hero: { category: a.category, videoUrl: a.videoUrl ?? null },
      body: [],
      sections: [],
      seo: { title: a.title, description: a.dek ?? null },
    };

    return {
      slug: a.slug,
      title: a.title,
      template: a.template,
      excerpt: a.dek ?? null,
      issue_no: a.issue,
      reading_minutes: readingMinutes(a.read),
      category_id: filedUnder ? (categoryIdBySlug.get(filedUnder) ?? null) : null,
      author_id: authorIdBySlug.get(slugify(a.author)) ?? null,
      featured_asset_id: a.heroImage ? (assetIds.get(fileNameOf(a.heroImage)) ?? null) : null,
      status: "published" as const,
      draft_data: payload,
      published_data: payload,
      published_at: new Date().toISOString(),
      version: 1,
    };
  });

  ok("articles", await db.from("articles").upsert(rows, { onConflict: "slug" }).select("id"));
  return rows.length;
}

/** slug → id, for the two joins below. */
async function articleIdsBySlug(): Promise<Map<string, string>> {
  const rows = ok("article ids", await db.from("articles").select("id, slug")) as {
    id: string;
    slug: string;
  }[];
  return new Map(rows.map((r) => [r.slug, r.id]));
}

async function seedArticleTags(articleIds: Map<string, string>) {
  const tags = ok("tag ids", await db.from("tags").select("id, slug")) as {
    id: string;
    slug: string;
  }[];
  const tagIdBySlug = new Map(tags.map((t) => [t.slug, t.id]));

  const rows = Object.entries(CARD_TAG_LABEL).flatMap(([articleSlug, label]) => {
    const articleId = articleIds.get(articleSlug);
    const tagId = tagIdBySlug.get(slugify(label));
    return articleId && tagId ? [{ article_id: articleId, tag_id: tagId }] : [];
  });

  ok(
    "article tags",
    await db
      .from("article_tags")
      .upsert(rows, { onConflict: "article_id,tag_id", ignoreDuplicates: true })
  );
  return rows.length;
}

/**
 * KEEP READING, curated rather than derived.
 *
 * `article_relations` has had a schema and no rows since 0004. The demo picks
 * three same-category siblings **in module insertion order**, which no column
 * reproduces — so seeding the exact trio is the only way the article page keeps
 * rendering what its screenshot baseline expects. It also gives the service a
 * curated list to prefer, with the category-derived fallback behind it for
 * articles nobody has curated.
 */
async function seedArticleRelations(articleIds: Map<string, string>) {
  const rows = articleSlugs.flatMap((slug) => {
    const articleId = articleIds.get(slug);
    if (!articleId) return [];

    return relatedFor(ARTICLES[slug]).flatMap((related, position) => {
      const relatedId = articleIds.get(related.href.replace("/article/", ""));
      // The table forbids an article relating to itself; `relatedFor` already
      // excludes it, and the guard is here so a future change to that function
      // fails a row rather than the whole transaction.
      return relatedId && relatedId !== articleId
        ? [{ article_id: articleId, related_id: relatedId, position }]
        : [];
    });
  });

  ok(
    "article relations",
    await db.from("article_relations").upsert(rows, { onConflict: "article_id,related_id" })
  );
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

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/**
 * The chrome's four menus.
 *
 * **Items are replaced, not upserted, and that is a real trade.** `menu_items`
 * has no natural key — two entries may legitimately share a label under
 * different parents — so there is nothing for `onConflict` to key on. Re-seeding
 * therefore deletes every item of these four menus and writes them again, which
 * means a re-seed discards navigation an editor has changed. Harmless on a fresh
 * database and in CI, which is what this script is for; the same caveat the
 * category and product documents already carry, and worth remembering before
 * running it against a project someone is editing.
 *
 * Two passes, because a child needs its parent's id: top-level items first, then
 * their children with `parent_id` filled in.
 */
async function seedMenus() {
  const categoryIds = new Map(
    (ok("category ids", await db.from("categories").select("id, slug")) ?? []).map(
      (row) => [row.slug, row.id] as const
    )
  );

  const targetFor = (
    link: DemoMenuLink
  ): { link_type: string; target_id: string | null; url: string | null } => {
    if (link.type === "url") return { link_type: "url", target_id: null, url: link.url };
    if (link.type === "category") {
      const id = categoryIds.get(link.slug);
      // `menu_item_target_shape` would refuse a null target anyway; failing here
      // names the slug instead of reporting a constraint violation.
      if (!id) throw new Error(`menus: no category with slug "${link.slug}"`);
      return { link_type: "category", target_id: id, url: null };
    }
    throw new Error(`menus: seeding ${link.type} links is not implemented`);
  };

  const menus = ok(
    "menus",
    await db
      .from("menus")
      .upsert(
        DEMO_MENUS.map((menu) => ({
          key: menu.key,
          name: menu.name,
          location: menu.location,
          status: "published" as const,
        })),
        { onConflict: "key" }
      )
      .select("id, key")
  );

  const menuIds = new Map((menus ?? []).map((row) => [row.key, row.id] as const));
  const ids = [...menuIds.values()];
  if (ids.length > 0)
    ok("menu items reset", await db.from("menu_items").delete().in("menu_id", ids));

  let count = 0;

  for (const menu of DEMO_MENUS) {
    const menuId = menuIds.get(menu.key);
    if (!menuId) throw new Error(`menus: "${menu.key}" was not written`);

    const roots = ok(
      `menu items (${menu.key})`,
      await db
        .from("menu_items")
        .insert(
          menu.items.map((item, position) => ({
            menu_id: menuId,
            parent_id: null,
            label: item.label,
            ...targetFor(item.link),
            options: (item.feature ? { feature: item.feature } : {}) as Json,
            position,
          }))
        )
        .select("id, label")
    );

    count += roots?.length ?? 0;

    const rootIds = new Map((roots ?? []).map((row) => [row.label, row.id] as const));
    const children = menu.items.flatMap((item) =>
      (item.children ?? []).map((child, position) => ({
        menu_id: menuId,
        parent_id: rootIds.get(item.label) ?? null,
        label: child.label,
        ...targetFor(child.link),
        options: (child.group ? { group: child.group } : {}) as Json,
        position,
      }))
    );

    if (children.length > 0) {
      const written = ok(
        `menu children (${menu.key})`,
        await db.from("menu_items").insert(children).select("id")
      );
      count += written?.length ?? 0;
    }
  }

  return count;
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

  // The same foreign-key ordering on the editorial side: assets, then the two
  // things an article points at, then the articles, then their joins.
  const assetIds = await assetIdsByFileName();
  console.log(`  categories: ${await seedCategories(assetIds)}`);
  console.log(`  authors:    ${await seedAuthors()}`);
  console.log(`  tags:       ${await seedTags()}`);
  console.log(`  articles:   ${await seedArticles(assetIds)}`);

  const articleIds = await articleIdsBySlug();
  console.log(`  filed:      ${await seedArticleTags(articleIds)} tag rows`);
  console.log(`  related:    ${await seedArticleRelations(articleIds)} rows`);
  console.log(`  home page:  ${await seedHomePage()} sections`);
  // After categories: every header and footer entry points at one by id.
  console.log(`  menus:      ${await seedMenus()} items`);
  await grantAdmin(process.env.SEED_ADMIN_EMAIL ?? "welcome@moderngentlemen.co");
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
