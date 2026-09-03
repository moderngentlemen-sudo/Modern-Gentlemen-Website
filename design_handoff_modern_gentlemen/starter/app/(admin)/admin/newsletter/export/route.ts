import { subscriberCsv } from "@/lib/domain/newsletter";
import { listNewsletterSubscribers } from "@/lib/services/newsletter";

export async function GET() {
  const subscribers = await listNewsletterSubscribers(5_000);
  const csv = subscriberCsv(
    subscribers.map((row) => ({
      email: row.email,
      source: row.source,
      status: row.status,
      createdAt: row.created_at,
      confirmedAt: row.confirmed_at,
    }))
  );

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="modern-gentlemen-subscribers.csv"',
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
