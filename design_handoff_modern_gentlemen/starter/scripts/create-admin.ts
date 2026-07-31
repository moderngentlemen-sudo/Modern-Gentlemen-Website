/**
 * Creates the first administrator and grants the `admin` role.
 *
 * Uses the Supabase Auth Admin API, which the service-role key unlocks, so no
 * manual sign-up is needed. The account's email is marked confirmed on
 * creation — there is no mail round-trip to complete.
 *
 * Idempotent. If the account already exists it is left alone and only the role
 * grant is reconciled, so re-running is safe and never produces a duplicate.
 *
 *   npx tsx scripts/create-admin.ts
 *   SEED_ADMIN_EMAIL=someone@example.com npx tsx scripts/create-admin.ts
 *
 * The password comes from SEED_ADMIN_PASSWORD when set; otherwise a strong one
 * is generated and printed ONCE to stdout. It is never written to a file, and
 * an existing account's password is never silently changed.
 */
import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import { createAdminClient } from "../lib/db/admin";

config({ path: ".env.local" });

const DEFAULT_EMAIL = "welcome@moderngentlemen.co";

/** 24 URL-safe characters — comfortably beyond Supabase's minimum. */
function generatePassword(): string {
  return randomBytes(18).toString("base64url");
}

export async function createAdmin(email: string, explicitPassword?: string) {
  const db = createAdminClient();

  // listUsers is paginated; the default page is 50, which is ample for finding
  // an existing operator account but is worth being explicit about.
  const { data: existing, error: listError } = await db.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listError) throw new Error(`listUsers: ${listError.message}`);

  const found = existing.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  let userId: string;
  let generatedPassword: string | null = null;

  if (found) {
    userId = found.id;
    console.log(`  account already exists — ${email}`);
    console.log(`  password left unchanged`);
  } else {
    const password = explicitPassword ?? generatePassword();
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // no confirmation mail required
      user_metadata: { full_name: "Modern Gentlemen" },
    });
    if (error) throw new Error(`createUser: ${error.message}`);
    if (!data.user) throw new Error("createUser returned no user");

    userId = data.user.id;
    generatedPassword = explicitPassword ? null : password;
    console.log(`  created account — ${email}`);
  }

  // The profiles row is created by the on_auth_user_created trigger, but assert
  // it rather than assume: a missing profile would break the admin UI later.
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw new Error(`profiles: ${profileError.message}`);
  if (!profile) {
    const { error } = await db.from("profiles").insert({ id: userId });
    if (error) throw new Error(`profiles insert: ${error.message}`);
    console.log(`  profile row created (trigger did not fire)`);
  }

  const { error: grantError } = await db
    .from("user_roles")
    .upsert([{ user_id: userId, role_key: "admin" }], { onConflict: "user_id,role_key" });
  if (grantError) throw new Error(`admin grant: ${grantError.message}`);

  console.log(`  admin role granted`);

  return { userId, email, generatedPassword };
}

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? DEFAULT_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  console.log("Creating administrator…");
  const result = await createAdmin(email, password);

  console.log("");
  console.log(`  user id: ${result.userId}`);
  if (result.generatedPassword) {
    console.log("");
    console.log("  ┌─────────────────────────────────────────────────────────");
    console.log(`  │ email:    ${result.email}`);
    console.log(`  │ password: ${result.generatedPassword}`);
    console.log("  └─────────────────────────────────────────────────────────");
    console.log("  Shown once and stored nowhere. Change it after signing in.");
  }
}

// Only run when invoked directly, so the grant logic can be imported by seed.ts.
if (process.argv[1]?.includes("create-admin")) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
