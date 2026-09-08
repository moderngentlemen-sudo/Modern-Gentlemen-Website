import Link from "next/link";
import { requirePermission } from "@/lib/services/auth";

export default async function DesignStudioPage() {
  await requirePermission("page.write");
  return (
    <section className="fixed inset-0 z-50 flex flex-col bg-mg-bg" aria-label="Design Studio">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-mg-bd px-4 py-2 text-sm">
        <Link href="/admin/pages" className="underline underline-offset-4">
          Back to pages
        </Link>
        <span>
          Design Studio · Drafts stay in this browser. Export a backup before changing devices.
        </span>
      </header>
      <iframe
        title="Modern Gentlemen Design Studio"
        src="/api/admin/design-studio"
        className="min-h-0 w-full flex-1 border-0"
        allow="autoplay; fullscreen"
      />
    </section>
  );
}
