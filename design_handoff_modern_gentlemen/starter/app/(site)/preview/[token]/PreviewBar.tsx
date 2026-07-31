"use client";

import { useEffect, useState } from "react";
import type { DocumentType } from "@/lib/domain/documents";

/**
 * The bar that marks a page as a draft.
 *
 * It exists so nobody mistakes a preview for the live site — the content below
 * it is rendered by the same components in the same way, which is exactly what
 * makes the confusion possible. Fixed to the bottom rather than the top: the
 * site's own header is fixed to the top and the design is pixel-verified
 * against it, so anything up there would sit over the real chrome.
 *
 * Uses the `mg.*` tokens and the mono/serif type mix like everything else.
 */
export function PreviewBar({
  entityType,
  expiresAt,
}: {
  entityType: DocumentType;
  expiresAt: string;
}) {
  const remaining = useCountdown(expiresAt);

  return (
    <div
      data-darkband
      className="fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-white/15 bg-[#0d0d0d] px-5 py-3 text-[#f4f4f4] min-[681px]:px-8"
    >
      <div className="flex items-center gap-3">
        <span className="bg-mg-accent px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white">
          Preview
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/60">
          Unpublished {entityType} draft
        </span>
      </div>

      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
        {remaining}
      </span>
    </div>
  );
}

/**
 * Rendered on the client because the server would bake in a countdown that is
 * wrong by the time anyone reads it, and this page is `force-dynamic` precisely
 * because its content is time-sensitive.
 */
function useCountdown(expiresAt: string): string {
  const [label, setLabel] = useState(() => formatRemaining(expiresAt));

  useEffect(() => {
    const id = setInterval(() => setLabel(formatRemaining(expiresAt)), 30_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return label;
}

function formatRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "Link expired — reload for a new one";

  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `Expires in ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  return `Expires in ${hours} hr${hours === 1 ? "" : "s"}`;
}
