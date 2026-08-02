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
import { config } from "dotenv";
import type { Json } from "../lib/db/database.types";
import { createAdminClient } from "../lib/db/admin";
import { DEMO_SECTIONS } from "../lib/demo/home-sections";
import { poundsToPence } from "../lib/domain/money";
import { allProducts } from "../lib/catalog";
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
  console.log(`  categories: ${await seedCategories()}`);
  console.log(`  home page:  ${await seedHomePage()} sections`);
  await grantAdmin(process.env.SEED_ADMIN_EMAIL ?? "welcome@moderngentlemen.co");
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
