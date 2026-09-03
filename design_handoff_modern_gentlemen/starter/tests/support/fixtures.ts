/**
 * Integration-test fixtures.
 *
 * `tests/setup/integration.setup.ts` has promised this file since Phase 0 —
 * it documents a per-run prefix and a teardown that never issues an unscoped
 * DELETE. This is that helper, and those two properties are the whole point:
 * the suite is allowed to run against the shared remote project when no local
 * stack is available, so it must be incapable of touching a row it did not
 * create.
 *
 * Everything created is named with the run prefix, tracked, and removed in
 * reverse creation order.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/db/database.types";
import { testEnv } from "../setup/integration.setup";

export type Db = SupabaseClient<Database>;

/**
 * Unique per run. Anything the suite creates carries it, which is what makes
 * cleanup precise and what stops two concurrent runs colliding.
 */
export const RUN_PREFIX = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Distinguishes repeated calls within a single run.
 *
 * `RUN_PREFIX` separates one run from another; it does nothing to separate two
 * calls in the same run, so `prefixed("page")` used to return an identical slug
 * every time and the second `createPage()` in any test file died on
 * `pages_slug_key`. Same for `createUser`, which got "already registered" from
 * the auth API. Neither showed up until CI could execute these suites for the
 * first time.
 */
let sequence = 0;

export function prefixed(name: string): string {
  sequence += 1;
  return `${RUN_PREFIX}-${name}-${sequence.toString(36)}`;
}

/** Service-role: fixtures need to create rows without acting as a signed-in user. */
export function adminClient(): Db {
  return createClient<Database>(testEnv.url, testEnv.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Anonymous: the client an unauthenticated visitor gets, with RLS fully applied. */
export function anonClient(): Db {
  return createClient<Database>(testEnv.url, testEnv.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface TrackedRow {
  table: string;
  column: string;
  value: string;
}

/** Auth users are removed through the admin API, not a table delete. */
const AUTH_USER = "__auth_user__";

/**
 * Tracks what a test created so teardown can remove exactly that.
 *
 * Deletes run newest-first so a row referenced by a later one goes second, and
 * every delete is keyed on a specific value — there is no code path here that
 * can issue a DELETE without a WHERE.
 */
export class Fixtures {
  private readonly rows: TrackedRow[] = [];

  constructor(readonly db: Db) {}

  track(table: string, value: string, column = "id"): void {
    this.rows.push({ table, column, value });
  }

  async cleanup(): Promise<void> {
    for (const row of [...this.rows].reverse()) {
      // Teardown must never mask a test failure, so every branch warns and
      // continues rather than throwing.
      if (row.table === AUTH_USER) {
        const { error } = await this.db.auth.admin.deleteUser(row.value);
        if (error)
          console.warn(`fixture cleanup failed for auth user ${row.value}:`, error.message);
        continue;
      }

      const { error } = await this.db
        .from(row.table as keyof Database["public"]["Tables"])
        .delete()
        .eq(row.column, row.value);

      if (error) {
        console.warn(`fixture cleanup failed for ${row.table}.${row.column}:`, error.message);
      }
    }
    this.rows.length = 0;
  }

  /** A draft page carrying one valid block, ready to publish. */
  async createPage(
    overrides: { slug?: string; title?: string; draftData?: unknown } = {}
  ): Promise<{ id: string; slug: string }> {
    const slug = overrides.slug ?? prefixed("page");

    const { data, error } = await this.db
      .from("pages")
      .insert({
        slug,
        title: overrides.title ?? "Fixture page",
        draft_data: (overrides.draftData ?? {
          sections: [
            {
              _key: "quote",
              _type: "pullQuote",
              quote: "A fixture quote.",
              attribution: "TESTS",
            },
          ],
          seo: {},
        }) as never,
      })
      .select("id, slug")
      .single();

    if (error) throw new Error(`fixture createPage: ${error.message}`);

    this.track("pages", data.id);
    return data;
  }

  async createPreviewSession(input: {
    token: string;
    entityId: string;
    entityType?: string;
    expiresAt?: Date;
    createdBy?: string | null;
    context?: Json;
  }): Promise<void> {
    const { data, error } = await this.db
      .from("preview_sessions")
      .insert({
        token: input.token,
        entity_type: input.entityType ?? "page",
        entity_id: input.entityId,
        created_by: input.createdBy ?? null,
        context: input.context ?? {},
        expires_at: (input.expiresAt ?? new Date(Date.now() + 3_600_000)).toISOString(),
      })
      .select("id")
      .single();

    if (error) throw new Error(`fixture createPreviewSession: ${error.message}`);
    this.track("preview_sessions", data.id);
  }

  /**
   * Creates a throwaway role holding exactly the permissions given.
   *
   * The seeded roles do not cover every interesting combination — nothing ships
   * with `page.write` but not `page.publish`, which is precisely the case the
   * publish gate exists to refuse. Rather than assert against whichever seeded
   * role looks closest and quietly test something weaker, a test that needs a
   * particular shape of actor builds one.
   */
  async createRole(permissionKeys: string[]): Promise<string> {
    const key = prefixed("role");

    const { error } = await this.db
      .from("roles")
      .insert({ key, label: `Fixture role ${key}`, is_system: false });
    if (error) throw new Error(`fixture createRole: ${error.message}`);
    this.track("roles", key, "key");

    const { error: grantError } = await this.db
      .from("role_permissions")
      .insert(permissionKeys.map((permission_key) => ({ role_key: key, permission_key })));
    if (grantError) throw new Error(`fixture createRole(grants): ${grantError.message}`);

    return key;
  }

  /**
   * Creates a confirmed auth user holding exactly the roles given, so a test
   * can assert what someone *without* a permission is refused — the half of
   * authorisation that is easy to leave untested.
   */
  async createUser(roleKeys: string[]): Promise<{ id: string; email: string; password: string }> {
    const email = `${prefixed("user")}@example.test`;
    const password = `pw-${RUN_PREFIX}-${Math.random().toString(36).slice(2)}`;

    const { data, error } = await this.db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`fixture createUser: ${error?.message}`);

    // The handle_new_user trigger creates the profile; the user row cascades to
    // it, so tracking the auth user is enough.
    this.track(AUTH_USER, data.user.id);

    for (const roleKey of roleKeys) {
      const { error: roleError } = await this.db
        .from("user_roles")
        .insert({ user_id: data.user.id, role_key: roleKey });
      if (roleError) throw new Error(`fixture createUser(role ${roleKey}): ${roleError.message}`);
    }

    return { id: data.user.id, email, password };
  }

  /** A client acting as that user, so RLS and the RPC permission checks apply to them. */
  async signIn(email: string, password: string): Promise<Db> {
    const client = anonClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`fixture signIn: ${error.message}`);
    return client;
  }
}
