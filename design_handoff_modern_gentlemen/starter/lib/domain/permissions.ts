/**
 * Permission vocabulary — pure, no data access.
 *
 * These strings mirror the rows seeded by supabase/migrations/0001. Keeping a
 * typed union here means a typo in `requirePermission("page.publsh")` is a
 * compile error rather than a silent denial at run time.
 */

export const PERMISSIONS = [
  "page.read",
  "page.write",
  "page.publish",
  "page.delete",
  "template.read",
  "template.write",
  "template.publish",
  "template.delete",
  "pattern.read",
  "pattern.write",
  "pattern.publish",
  "pattern.delete",
  "article.read",
  "article.write",
  "article.publish",
  "article.delete",
  "taxonomy.write",
  // `0021`. Categories became the sixth document type when `/[category]` gained
  // an editor. Four rather than a reuse of `taxonomy.write` because
  // `publish_document` asserts `has_permission(<type> || '.publish')` — the
  // string is built from the type, so nothing else can satisfy it.
  // `taxonomy.write` still grants category writes; the RLS policy accepts both.
  "category.read",
  "category.write",
  "category.publish",
  "category.delete",
  "media.read",
  "media.write",
  "media.delete",
  "product.read",
  "product.write",
  "product.publish",
  "product.delete",
  "navigation.read",
  "navigation.write",
  "navigation.publish",
  "theme.read",
  "theme.write",
  "theme.publish",
  "integration.read",
  "integration.write",
  "integration.run",
  "revision.read",
  "revision.restore",
  "preview.create",
  "user.read",
  "user.write",
  "settings.read",
  "settings.write",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_KEYS = ["admin", "editor", "author", "merchandiser", "viewer"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

/** Thrown when an actor lacks a permission. Carries the permission so callers can report it. */
export class ForbiddenError extends Error {
  readonly permission: Permission;

  constructor(permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = "ForbiddenError";
    this.permission = permission;
  }
}

export class UnauthenticatedError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "UnauthenticatedError";
  }
}

/** A resolved permission set. Wrapped rather than a bare Set so it can gain scoping later. */
export class PermissionSet {
  private readonly granted: ReadonlySet<string>;

  constructor(permissions: Iterable<string>) {
    this.granted = new Set(permissions);
  }

  has(permission: Permission): boolean {
    return this.granted.has(permission);
  }

  /** True when ANY of the given permissions is held — for nav sections with several entry points. */
  hasAny(...permissions: Permission[]): boolean {
    return permissions.some((p) => this.has(p));
  }

  assert(permission: Permission): void {
    if (!this.has(permission)) throw new ForbiddenError(permission);
  }

  toArray(): Permission[] {
    return PERMISSIONS.filter((p) => this.granted.has(p));
  }

  get size(): number {
    return this.granted.size;
  }
}

export const EMPTY_PERMISSIONS = new PermissionSet([]);
