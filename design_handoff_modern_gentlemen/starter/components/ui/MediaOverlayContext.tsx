"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { MediaOverlay } from "@/lib/domain/mediaOverlay";
import { MediaOverlay as Overlay } from "./MediaOverlay";
const Context = createContext<MediaOverlay | undefined>(undefined);
export function MediaOverlayProvider({
  value,
  children,
}: {
  value?: MediaOverlay;
  children: ReactNode;
}) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function InheritedMediaOverlay() {
  return <Overlay value={useContext(Context)} />;
}
