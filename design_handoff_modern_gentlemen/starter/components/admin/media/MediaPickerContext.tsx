"use client";

import { createContext, useContext, useMemo } from "react";
import type { ActionResult } from "@/app/(admin)/admin/_lib/action-result";
import type { AssetView } from "@/lib/services/media";

export type ListAssetsAction = (
  input: unknown
) => Promise<ActionResult<{ assets: AssetView[]; total: number }>>;

const MediaPickerContext = createContext<{ search: ListAssetsAction } | null>(null);

/**
 * Makes the library searchable from anywhere inside `/admin`.
 *
 * The alternative was threading a server action from the builder route through
 * `Builder` → `PropertiesPanel` → `FieldControl` → `MediaUrlControl`, four
 * components deep, none of which otherwise care that media exists. Phase 4 kept
 * the panel's field→control mapping deliberately narrow, and widening every
 * signature to carry one action would undo that.
 *
 * Mounted once in the admin layout, so the builder, a future article editor and
 * anything else with an `image` field all get the picker without changing their
 * own props.
 */
export function MediaPickerProvider({
  search,
  children,
}: {
  search: ListAssetsAction;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ search }), [search]);
  return <MediaPickerContext.Provider value={value}>{children}</MediaPickerContext.Provider>;
}

/**
 * Returns `null` outside a provider rather than throwing — the same stance as
 * `useToast`. A control rendered in a unit test has no admin layout above it,
 * and losing the Browse button there is correct: the URL field still works, and
 * that is exactly what `MediaUrlControl` did before the library existed.
 */
export function useMediaPicker(): { search: ListAssetsAction } | null {
  return useContext(MediaPickerContext);
}
