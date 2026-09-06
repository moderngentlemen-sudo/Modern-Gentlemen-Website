"use client";

import { useEffect, useRef, useState } from "react";
import { optimizedImageUrl } from "@/components/ui/imageUrl";
import { readPageSettings } from "@/lib/domain/pageSettings";

/** Absent presentation settings produce precisely the original markup. */
export function PagePresentation({
  settings: raw,
  children,
  preview = false,
}: {
  settings?: unknown;
  children: React.ReactNode;
  preview?: boolean;
}) {
  const settings = readPageSettings(raw);
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!settings.backgroundVideo) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 680px)");
    const update = () =>
      setAllowed(!motion.matches && (!mobile.matches || settings.videoOnMobile === true));
    update();
    motion.addEventListener("change", update);
    mobile.addEventListener("change", update);
    return () => {
      motion.removeEventListener("change", update);
      mobile.removeEventListener("change", update);
    };
  }, [settings.videoOnMobile, settings.backgroundVideo]);
  useEffect(() => {
    setPlaying(false);
    if (video.current) {
      video.current.muted = true;
      video.current.defaultMuted = true;
      if (allowed && !paused) video.current.play().catch(() => {});
      else video.current.pause();
    }
  }, [allowed, paused, settings.backgroundVideo]);
  const visual =
    settings.backgroundColor ||
    settings.backgroundImage ||
    settings.backgroundVideo ||
    settings.fullHeight;
  const chrome = [
    settings.header,
    settings.mobileHeader,
    settings.footer,
    settings.mobileFooter,
  ].some((value) => value === "hidden" || value === "overlay");
  if (!visual && !chrome) return <>{children}</>;
  const position = `${settings.focalX ?? 50}% ${settings.focalY ?? 50}%`;
  return (
    <div
      data-page-presentation={preview ? "preview" : "public"}
      data-page-header={settings.header}
      data-page-mobile-header={settings.mobileHeader}
      data-page-footer={settings.footer}
      data-page-mobile-footer={settings.mobileFooter}
      style={{
        position: "relative",
        isolation: "isolate",
        minHeight: settings.fullHeight ? "100svh" : undefined,
        backgroundColor: settings.backgroundColor || undefined,
      }}
    >
      {visual && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: -1,
            overflow: "hidden",
            pointerEvents: "none",
            backgroundImage: settings.backgroundImage
              ? `url(${JSON.stringify(optimizedImageUrl(settings.backgroundImage, 1920))})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: position,
          }}
        >
          {allowed && settings.backgroundVideo && (
            <video
              ref={video}
              src={settings.backgroundVideo}
              muted
              loop
              playsInline
              preload="none"
              tabIndex={-1}
              onPlaying={() => {
                setPlaying(true);
                setHasFrame(true);
              }}
              onPause={() => setPlaying(false)}
              onError={() => {
                setPlaying(false);
                setHasFrame(false);
              }}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: position,
                opacity: hasFrame ? 1 : 0,
              }}
            />
          )}
          {!!settings.overlayOpacity && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "#000",
                opacity: settings.overlayOpacity,
              }}
            />
          )}
        </div>
      )}
      {children}
      {allowed && settings.backgroundVideo && (
        <button
          type="button"
          onClick={() => {
            if (playing) {
              setPaused(true);
              video.current?.pause();
            } else {
              setPaused(false);
              video.current?.play().catch(() => {});
            }
          }}
          className="absolute bottom-3 right-3 border border-white/50 bg-black/70 px-3 py-2 text-xs text-white"
          aria-label={playing ? "Pause background video" : "Play background video"}
        >
          {playing ? "Pause background" : "Play background"}
        </button>
      )}
    </div>
  );
}
