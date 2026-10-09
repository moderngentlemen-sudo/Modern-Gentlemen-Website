/**
 * Renders signature HTML inside a shadow root, so the app's CSS can't leak
 * into it and it looks exactly as it will in an inbox.
 */
import { memo, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { SignatureDoc, Variant } from "../core/types";
import { renderSignature } from "../render/render";
import { onSourcesChange } from "../store/assets";
import { previewSource } from "./samples";

let version = 0;
onSourcesChange(() => void version++);
const subscribe = (fn: () => void) => onSourcesChange(fn) as unknown as () => void;

/** Re-render when uploaded image object URLs become available. */
export function useSourcesVersion() {
  return useSyncExternalStore(
    (fn) => {
      const off = subscribe(fn);
      return () => void off();
    },
    () => version,
  );
}

export const SigHtml = memo(function SigHtml({ html, className, testId }: { html: string; className?: string; testId?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current!;
    const root = el.shadowRoot ?? el.attachShadow({ mode: "open" });
    // part="img" lets the dark-mode preview keep photos un-inverted.
    root.innerHTML = `<style>:host{display:block}a{cursor:pointer}</style>${html.replace(/<img /g, '<img part="img" ')}`;
  }, [html]);
  return <div ref={ref} className={className} data-testid={testId} />;
});

export function previewHtml(doc: SignatureDoc, variant: Variant = "full", fallbackFonts = false) {
  return renderSignature(doc, { variant, mode: "preview", sourceUrl: previewSource, fallbackFonts }).html;
}

/** A scaled-down live signature, for gallery tiles. */
export const Thumb = memo(function Thumb({ doc, width = 260, height = 150 }: { doc: SignatureDoc; width?: number; height?: number }) {
  useSourcesVersion();
  const html = previewHtml(doc);
  const scale = Math.min(1, (width - 32) / Math.max(320, doc.design.width));
  return (
    <div className="thumb" style={{ height }} aria-hidden="true">
      <div className="thumb-inner" style={{ transform: `scale(${scale})`, width: doc.design.width }}>
        <SigHtml html={html} />
      </div>
    </div>
  );
});
