import { requireUser } from "@/lib/services/auth";
import { hasRecoveryMarker } from "@/app/auth/_lib/recovery";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { PasswordForm } from "./PasswordForm";

/**
 * Where a recovery link lands, and where anyone signed in can change their own
 * password.
 *
 * It sits under `/admin` rather than beside `/sign-in` for two reasons. The
 * middleware redirects a signed-in visitor away from `/sign-in`, and by the time
 * the recovery callback has run they *are* signed in — so a page there would
 * bounce them to `/admin` before they could set anything. And `/admin` is
 * already the authenticated surface, so this needs no gate of its own beyond the
 * layout's.
 *
 * No permission is required: changing your own password is not an editorial
 * capability, and the admin layout has already established there is a session.
 *
 * ⚠️ **The marker is read here only to decide which fields to render.** The
 * action reads it again and makes the real decision — this one is presentation,
 * and a form posting `currentPassword: undefined` gets asked for it regardless.
 * Deciding twice is right: a prop is a hint the client could lie about.
 */
export default async function PasswordPage() {
  const user = await requireUser();
  const recovering = await hasRecoveryMarker();

  return (
    <>
      <AdminPageHeader eyebrow="Account" title="Password">
        <p className="mt-2 text-[13px] text-mg-fg/60">Signed in as {user.email}.</p>
      </AdminPageHeader>

      <div className="px-8 py-8">
        <PasswordForm requireCurrent={!recovering} />
      </div>
    </>
  );
}
