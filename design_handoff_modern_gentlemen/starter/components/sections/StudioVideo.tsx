"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { StudioVideoOptions } from "@/lib/blocks/studioFeatures";
import styles from "./StudioVideo.module.css";

export function StudioVideo({
  src,
  poster,
  label,
  options = {},
  mediaStyle,
}: {
  src: string;
  poster?: string;
  label: string;
  options?: StudioVideoOptions;
  mediaStyle: CSSProperties;
}) {
  const {
    autoplay = false,
    repeat = false,
    muted = true,
    controls = true,
    showToggle = true,
    preload = "metadata",
  } = options;
  const video = useRef<HTMLVideoElement>(null);
  const userPaused = useRef(false);
  const visible = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const player = video.current;
    if (!player) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    player.defaultMuted = muted;
    player.muted = muted;
    userPaused.current = false;
    const sync = () => {
      if (!visible.current || document.visibilityState === "hidden" || motion.matches) {
        player.pause();
      } else if (autoplay && !userPaused.current) {
        void player.play().catch(() => {
          /* The configured controls remain available. */
        });
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
      sync();
    });
    observer.observe(player);
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", sync);
      player.pause();
    };
  }, [src, autoplay, muted]);
  return (
    <>
      <video
        ref={video}
        src={src}
        poster={poster}
        playsInline
        muted={muted}
        loop={repeat}
        controls={controls}
        preload={preload}
        aria-label={label}
        className={styles.video}
        style={mediaStyle}
        onPlay={() => {
          setPlaying(true);
          userPaused.current = false;
        }}
        onPause={() => {
          setPlaying(false);
          if (
            visible.current &&
            document.visibilityState !== "hidden" &&
            !window.matchMedia("(prefers-reduced-motion: reduce)").matches
          )
            userPaused.current = true;
        }}
        onEnded={() => setPlaying(false)}
        onError={() => setFailed(true)}
      />
      {!controls && showToggle && !failed && (
        <button
          type="button"
          className={styles.toggle}
          aria-label={playing ? "Pause video" : "Play video"}
          onClick={() => {
            const player = video.current;
            if (!player) return;
            if (player.paused) {
              userPaused.current = false;
              void player.play().catch(() => {});
            } else {
              userPaused.current = true;
              player.pause();
            }
          }}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" fill="currentColor">
            {playing ? <path d="M5 3h3v14H5zm7 0h3v14h-3z" /> : <path d="m5 2 12 8-12 8z" />}
          </svg>
        </button>
      )}
      {failed && (
        <span role="status" className={styles.error}>
          Video could not load.
        </span>
      )}
    </>
  );
}
