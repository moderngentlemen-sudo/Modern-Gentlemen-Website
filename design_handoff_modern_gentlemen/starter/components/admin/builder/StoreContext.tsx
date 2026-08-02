"use client";

import { createContext, useContext, useRef } from "react";
import { useStore } from "zustand";

import {
  createBuilderStore,
  type BuilderActions,
  type BuilderInit,
  type BuilderState,
  type BuilderStore,
} from "./store";

const BuilderStoreContext = createContext<BuilderStore | null>(null);

/**
 * Holds one store per mounted document.
 *
 * The ref is initialised once and never reassigned, so remounting a different
 * document mounts a different provider and gets a different store — which is
 * the point of `createBuilderStore` being a factory rather than a singleton.
 */
export function BuilderStoreProvider({
  init,
  children,
}: {
  init: BuilderInit;
  children: React.ReactNode;
}) {
  const ref = useRef<BuilderStore | null>(null);
  if (!ref.current) ref.current = createBuilderStore(init);

  return (
    <BuilderStoreContext.Provider value={ref.current}>{children}</BuilderStoreContext.Provider>
  );
}

/** The raw store, for subscriptions outside React's render cycle (autosave). */
export function useBuilderStore(): BuilderStore {
  const store = useContext(BuilderStoreContext);
  if (!store) throw new Error("useBuilderStore must be used inside <BuilderStoreProvider>");
  return store;
}

/**
 * Selector hook.
 *
 * Keep selectors atomic. zustand v5 removed the default shallow comparison, so
 * a selector that builds a fresh object or array returns a new reference every
 * time and re-renders forever. Select one value, or use `useShallow`.
 */
export function useBuilder<T>(selector: (state: BuilderState & BuilderActions) => T): T {
  return useStore(useBuilderStore(), selector);
}
