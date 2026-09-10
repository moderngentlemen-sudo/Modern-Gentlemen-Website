"use client";
import { useEffect, useRef, useState } from "react";
import { MediaImage } from "@/components/ui/MediaImage";
import { MediaVideo } from "@/components/ui/MediaVideo";
import { articleEmbedUrl, type ArticleFeaturedMedia } from "@/lib/domain/articles";
import { type ArticleDesign } from "@/lib/domain/articleDesign";
import { mediaOverlayStyle } from "@/lib/domain/mediaOverlay";
import styles from "./EditorialArticle.module.css";
export function ArticleDesignMedia({
  media,
  image,
  title,
  design,
  onPlayerChange,
}: {
  media?: ArticleFeaturedMedia;
  image?: string;
  title: string;
  design: ArticleDesign;
  onPlayerChange?: (open: boolean) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false),
    [muted, setMuted] = useState(design.muted !== false),
    [player, setPlayer] = useState(false),
    [slide, setSlide] = useState(0),
    [failed, setFailed] = useState(false);
  useEffect(() => setMuted(design.muted !== false), [design.muted]);
  const photos = media?.kind === "gallery" && media.gallery?.length ? media.gallery : [];
  const poster = photos[slide]?.url || media?.cover?.url || image;
  const embed = articleEmbedUrl(media?.embedUrl);
  const videoUrl = media?.kind === "video" ? media.video?.url : undefined;
  const overlay = mediaOverlayStyle(design.overlay);
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Autoplay is always silent and opt-in. Pause when the cover leaves the viewport.
    if (design.autoplay && !reduce.matches) {
      el.muted = true;
      void el.play().catch(() => {});
    }
    const pause = () => {
      if (document.hidden || reduce.matches) el.pause();
    };
    const observer =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver((entries) => {
            if (!entries[0].isIntersecting) el.pause();
          })
        : null;
    observer?.observe(el);
    document.addEventListener("visibilitychange", pause);
    reduce.addEventListener("change", pause);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", pause);
      reduce.removeEventListener("change", pause);
      el.pause();
    };
  }, [videoUrl, design.autoplay]);
  useEffect(() => {
    setPlayer(false);
    onPlayerChange?.(false);
    setFailed(false);
    setSlide(0);
  }, [media?.embedUrl, videoUrl, onPlayerChange]);
  const setOpen = (open: boolean) => {
    setPlayer(open);
    onPlayerChange?.(open);
  };
  const play = () => {
    const el = video.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => setFailed(true));
    else el.pause();
  };
  return (
    <figure
      className={styles["hero-media"]}
      data-media-kind={media?.kind || "image"}
      data-playing={player}
    >
      {poster && !videoUrl && (
        <MediaImage
          src={poster}
          alt={photos[slide]?.alt || media?.cover?.alt || title}
          slot="fullBleed"
          priority
        />
      )}
      {videoUrl && (
        <MediaVideo
          ref={video}
          aria-label={title}
          className={styles["hero-video"]}
          src={videoUrl}
          poster={poster}
          playsInline
          controls={design.controls !== false}
          preload="metadata"
          muted={muted}
          loop={design.loop === true}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onVolumeChange={() => setMuted(video.current?.muted !== false)}
          onError={() => setFailed(true)}
        />
      )}
      {videoUrl && !playing && design.showPlayButton !== false && (
        <button className={styles.centralPlay} aria-label="Play featured video" onClick={play}>
          ▶
        </button>
      )}
      {overlay && !player && <span className={styles.overlay} style={overlay} aria-hidden />}
      {media?.kind === "embed" && embed && player && (
        <div className={styles.player}>
          <button onClick={() => setOpen(false)}>Close player ×</button>
          <iframe
            title={title}
            src={`${embed}?autoplay=1&playsinline=1${design.loop ? `&loop=1&playlist=${embed.split("/").pop()}` : ""}`}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      )}
      {((media?.kind === "embed" && embed && !player) || videoUrl || photos.length > 1) && (
        <div className={styles["media-bar"]}>
          {media?.kind === "embed" && embed && !player && (
            <button onClick={() => setOpen(true)}>
              ▶ Play {embed.includes("youtube") ? "on YouTube" : "video"}
            </button>
          )}
          {videoUrl && (
            <>
              <button onClick={play} aria-label={playing ? "Pause video" : "Play video"}>
                {playing ? "Ⅱ Pause" : "▶ Play"}
              </button>
              <button onClick={() => setMuted((v) => !v)}>{muted ? "Unmute" : "Mute"}</button>
            </>
          )}
          {photos.length > 1 && (
            <>
              <button
                onClick={() => setSlide((v) => (v + photos.length - 1) % photos.length)}
                aria-label="Previous photograph"
              >
                ←
              </button>
              <span aria-live="polite">
                {slide + 1} / {photos.length}
              </span>
              <button
                onClick={() => setSlide((v) => (v + 1) % photos.length)}
                aria-label="Next photograph"
              >
                →
              </button>
            </>
          )}
        </div>
      )}
      {media?.kind === "embed" && !embed && (
        <p className={styles.mediaNotice}>
          A supported YouTube or Vimeo URL is needed for this video.
        </p>
      )}
      {failed && (
        <p className={styles.mediaNotice} role="status">
          This video could not be played. <a href={videoUrl}>Open video</a>
        </p>
      )}
    </figure>
  );
}
