import { cache } from "react";
import { createClient } from "@/lib/db/server";
import {
  EMPTY_PERMISSIONS,
  ForbiddenError,
  PermissionSet,
  UnauthenticatedError,
  type Permission,
  type RoleKey,
} from "@/lib/domain/permissions";

/**
 * Auth service — the service-layer half of the three-layer authorisation model.
 * RLS in Postgres is the other half and the one that cannot be bypassed; this
 * layer exists so the admin can fail fast with a clear error, and so the UI can
 * hide actions the user could not perform anyway.
 *
 * Always uses the caller's own session (lib/db/server), never service-role.
 *
 * Wrapped in React's `cache` so a single render resolving permissions in the
 * layout, the nav and a page issues one query, not three.
 */

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string | null;
  roles: RoleKey[];
  permissions: PermissionSet;
}

/** `getUser()` revalidates the JWT with Supabase; `getSession()` does not. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  // One round trip for roles + their permissions. RLS lets a user read their
  // own grants, so this works under the caller's session.
  // user_roles → roles → role_permissions, resolved in a single embedded query.
  const { data: rows, error: rolesError } = await supabase
    .from("user_roles")
    .select("role_key, roles(role_permissions(permission_key))")
    .eq("user_id", user.id);

  if (rolesError) {
    // A permissions lookup failure must never read as "allowed".
    console.error("Failed to resolve permissions:", rolesError.message);
    return {
      id: user.id,
      email: user.email ?? "",
      fullName: null,
      roles: [],
      permissions: EMPTY_PERMISSIONS,
    };
  }

  const roles = (rows ?? []).map((r) => r.role_key as RoleKey);
  const permissions = new Set<string>();
  for (const row of rows ?? []) {
    for (const rp of row.roles?.role_permissions ?? []) permissions.add(rp.permission_key);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? null,
    roles,
    permissions: new PermissionSet(permissions),
  };
});

/** Anyone holding at least one role may enter the admin area. */
export async function isStaff(): Promise<boolean> {
  const user = await getCurrentUser();
  return Boolean(user && user.roles.length > 0);
}

/** Throws UnauthenticatedError when signed out. Use at the top of protected work. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  return user;
}

/**
 * Gate a mutating operation. Every write path in lib/services calls this before
 * touching the database — RLS will refuse anyway, but this produces an error
 * the admin can render instead of an opaque Postgres denial.
 */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.permissions.has(permission)) throw new ForbiddenError(permission);
  return user;
}
