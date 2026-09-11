"use client";
import { useEffect, useRef, useState } from "react";
import { MediaImage } from "@/components/ui/MediaImage";
import {
  claimYouTubePlayback,
  loadYouTubeApi,
  releaseYouTubePlayback,
  type YouTubePlayer,
} from "./youtubeIframeApi";
import styles from "./EditorialArticle.module.css";

/** Muted, visible-only playback through YouTube's supported API; controls remain native. */
export function YouTubeArticlePlayer({
  embed,
  title,
  poster,
  loop = false,
}: {
  embed: string;
  title: string;
  poster?: string;
  loop?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const player = useRef<YouTubePlayer | null>(null);
  const visible = useRef(false);
  const reduced = useRef(false);
  const attempted = useRef(false);
  const manual = useRef(false);
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "loading" | "ready" | "playing" | "blocked" | "error"
  >("idle");

  const start = () => {
    if (
      !player.current ||
      !visible.current ||
      document.hidden ||
      (reduced.current && !manual.current)
    )
      return;
    if (attempted.current && !manual.current) return;
    attempted.current = true;
    manual.current = false;
    claimYouTubePlayback(player.current);
    // Mute before play rather than relying on an undocumented URL parameter.
    player.current.mute();
    player.current.playVideo();
  };
  const startRef = useRef(start);
  startRef.current = start;

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      reduced.current = preference.matches;
      if (!visible.current || document.hidden) {
        player.current?.pauseVideo();
        return;
      }
      if (!reduced.current) {
        setEnabled(true);
        startRef.current();
      }
    };
    const motionChanged = () => {
      if (preference.matches) player.current?.pauseVideo();
      update();
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible.current = entry.isIntersecting && entry.intersectionRatio > 0.5;
        update();
      },
      { threshold: [0, 0.5, 1] }
    );
    reduced.current = preference.matches;
    observer.observe(el);
    preference.addEventListener("change", motionChanged);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", motionChanged);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !screen.current) return;
    const mount = screen.current;
    let disposed = false;
    let instance: YouTubePlayer | undefined;
    attempted.current = false;
    setStatus("loading");
    const url = new URL(embed);
    url.searchParams.set("enablejsapi", "1");
    url.searchParams.set("playsinline", "1");
    url.searchParams.set("controls", "1");
    url.searchParams.set("origin", window.location.origin);
    if (loop) {
      url.searchParams.set("loop", "1");
      url.searchParams.set("playlist", url.pathname.split("/").pop() || "");
    }
    // Keep an ordinary controllable iframe usable if the optional API script is blocked.
    const iframe = document.createElement("iframe");
    iframe.src = url.toString();
    iframe.title = title;
    iframe.setAttribute("allow", "autoplay; encrypted-media; fullscreen; picture-in-picture");
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    mount.replaceChildren(iframe);
    void loadYouTubeApi()
      .then((api) => {
        if (disposed) return;
        instance = new api.Player(iframe, {
          events: {
            onReady: ({ target }) => {
              if (disposed) return;
              player.current = target;
              setStatus("ready");
              startRef.current();
            },
            onStateChange: ({ target, data }) => {
              if (disposed) return;
              if (data === 1 && (!visible.current || document.hidden)) {
                target.pauseVideo();
                return;
              }
              if (data === 1) claimYouTubePlayback(target);
              setStatus(data === 1 ? "playing" : "ready");
            },
            onAutoplayBlocked: () => {
              if (!disposed) setStatus("blocked");
            },
            onError: () => {
              if (!disposed) setStatus("error");
            },
          },
        });
      })
      .catch(() => {
        if (!disposed) setStatus("blocked");
      });
    return () => {
      disposed = true;
      player.current = null;
      if (instance) {
        releaseYouTubePlayback(instance);
        instance.destroy();
      }
      mount.replaceChildren();
    };
  }, [enabled, embed, title, loop]);

  return (
    <div className={styles.inlineYouTube} ref={root} data-youtube-status={status}>
      <div className={styles.youtubeScreen} ref={screen} />
      {!enabled && (
        <div className={styles.youtubePoster}>
          {poster && <MediaImage src={poster} alt={title} slot="fullBleed" priority />}
          <button
            onClick={() => {
              manual.current = true;
              setEnabled(true);
            }}
          >
            Play YouTube video
          </button>
        </div>
      )}
      {(status === "blocked" || status === "error") && (
        <p className={styles.youtubeStatus} role="status">
          {status === "error"
            ? "YouTube could not play this video."
            : "Press play in the video to start."}{" "}
          <a
            href={`https://www.youtube.com/watch?v=${embed.split("/").pop()}`}
            target="_blank"
            rel="noreferrer"
          >
            Open on YouTube
          </a>
        </p>
      )}
    </div>
  );
}
