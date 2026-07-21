import { createClient } from "./supabase/server";
import type { Block } from "@/components/SectionRenderer";
import type { Product } from "./cart/types";

/**
 * Server-side data access — the Supabase replacement for the old Sanity
 * queries. Each function returns the SAME shape the existing components already
 * consume, so pages swap their data source with no UI changes:
 *   - getPage()/getCategory() → { sections: Block[] } for <SectionRenderer/>
 *   - getProducts()/getProduct() → the ported `Product` shape (see catalog.ts)
 *
 * These are stubs: they compile and return typed data, but wire-up (env keys +
 * running the migration/seed) is a build step — see 06_SUPABASE.md. Until the
 * DB is connected, pages can keep importing lib/catalog.ts / demo arrays.
 */

export interface PageDoc {
  slug: string;
  title: string;
  seo: { title?: string; description?: string; ogImage?: string };
  sections: Block[];
}

export async function getPage(slug: string): Promise<PageDoc | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pages")
    .select("slug,title,seo,sections")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (error) throw error;
  return (data as PageDoc) ?? null;
}

export async function getCategory(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("slug,name,intro,hero,sections")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function getArticle(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select("slug,title,template,category,hero,body,seo,published_at")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function getProducts(group = "All"): Promise<Product[]> {
  const supabase = await createClient();
  let q = supabase.from("products").select("*").eq("published", true).order("position");
  if (group !== "All") q = q.eq("cat", group);
  const { data, error } = await q;
  if (error) throw error;
  return (data as Product[]) ?? [];
}

export async function getProduct(slug: string): Promise<Product | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as Product) ?? null;
}
