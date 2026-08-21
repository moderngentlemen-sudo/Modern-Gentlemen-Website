"use client";

import { createContext, useContext } from "react";
import type { BuilderPattern } from "./Builder";

/**
 * The patterns this document may use, available to the whole builder.
 *
 * The library rail has always had them as a prop. The **canvas** needs them
 * too now that a synced pattern is a `_ref` node: the node carries a pattern
 * *id* and nothing else, so the frame has no way to say which pattern it points
 * at, or how many blocks it will become, without this.
 *
 * A context rather than another prop because the canvas is three components
 * deep — `Canvas` → `BlockList` → `SortableBlock`, and `BlockList` recurses —
 * so threading it would put a parameter that only the leaf reads through every
 * level, including the recursion. `BlockList` already carries six.
 *
 * ⚠️ **This is a display lookup, not a source of truth.** Which pattern a node
 * points at is `BlockNode._ref`, full stop; this only turns that id into a name
 * and a block count for the card. A pattern missing from the list — deleted, or
 * unreadable by this editor — renders as an unresolved reference, which is
 * exactly what the public path would do with it.
 */
const PatternsContext = createContext<readonly BuilderPattern[]>([]);

export function PatternsProvider({
  patterns,
  children,
}: {
  patterns: readonly BuilderPattern[];
  children: React.ReactNode;
}) {
  return <PatternsContext.Provider value={patterns}>{children}</PatternsContext.Provider>;
}

/** Every pattern offered to this document. Empty outside a provider, by design. */
export function usePatterns(): readonly BuilderPattern[] {
  return useContext(PatternsContext);
}

/** One pattern by id, or `undefined` when the reference cannot be resolved. */
export function usePattern(id: string | undefined): BuilderPattern | undefined {
  const patterns = usePatterns();
  return id ? patterns.find((pattern) => pattern.id === id) : undefined;
}
