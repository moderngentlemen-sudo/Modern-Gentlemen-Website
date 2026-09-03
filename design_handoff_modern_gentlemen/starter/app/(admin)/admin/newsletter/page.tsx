import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Badge } from "@/components/admin/ui/Badge";
import { requirePermission } from "@/lib/services/auth";
import { listNewsletterSubscribers } from "@/lib/services/newsletter";

export default async function NewsletterSubscribersPage() {
  await requirePermission("integration.read");
  const subscribers = await listNewsletterSubscribers();
  const counts = subscribers.reduce<Record<string, number>>((totals, row) => {
    totals[row.status] = (totals[row.status] ?? 0) + 1;
    return totals;
  }, {});

  return (
    <>
      <AdminPageHeader eyebrow="Audience" title="Newsletter subscribers">
        <p className="mt-2 max-w-2xl text-[13px] text-mg-fg/60">
          Supabase captures these addresses. They remain pending until a chosen email provider
          completes double opt-in; this screen does not claim confirmation or send mail.
        </p>
      </AdminPageHeader>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-mg-fg/60">
          {subscribers.length} recent · {counts.pending ?? 0} pending · {counts.confirmed ?? 0}
          confirmed · {counts.unsubscribed ?? 0} unsubscribed
        </p>
        <Link
          href="/admin/newsletter/export"
          className="border border-mg-bd/25 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] hover:border-mg-accent"
        >
          Export CSV
        </Link>
      </div>

      <div className="overflow-x-auto border border-mg-bd/15">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead className="bg-mg-fg/[0.04] font-mono text-[9px] uppercase tracking-[0.16em] text-mg-fg/60">
            <tr>
              <th className="px-4 py-3 font-normal">Email</th>
              <th className="px-4 py-3 font-normal">Status</th>
              <th className="px-4 py-3 font-normal">Source</th>
              <th className="px-4 py-3 font-normal">Captured</th>
            </tr>
          </thead>
          <tbody>
            {subscribers.map((subscriber) => (
              <tr key={subscriber.id} className="border-t border-mg-bd/10">
                <td className="px-4 py-3">{subscriber.email}</td>
                <td className="px-4 py-3">
                  <Badge tone={subscriber.status === "confirmed" ? "accent" : "neutral"}>
                    {subscriber.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-mg-fg/60">
                  {subscriber.source}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-mg-fg/60">
                  {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
                    new Date(subscriber.created_at)
                  )}
                </td>
              </tr>
            ))}
            {subscribers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-mg-fg/60">
                  No newsletter addresses have been captured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
