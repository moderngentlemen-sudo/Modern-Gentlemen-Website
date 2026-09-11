export interface YouTubePlayer {
  mute(): void;
  playVideo(): void;
  pauseVideo(): void;
  destroy(): void;
}

export interface YouTubePlayerEvent {
  target: YouTubePlayer;
  data?: number;
}

export interface YouTubeApi {
  Player: new (
    iframe: HTMLIFrameElement,
    options: {
      events: {
        onReady(event: YouTubePlayerEvent): void;
        onStateChange(event: YouTubePlayerEvent): void;
        onAutoplayBlocked(event: YouTubePlayerEvent): void;
        onError(event: YouTubePlayerEvent): void;
      };
    }
  ) => YouTubePlayer;
}

type YouTubeWindow = Window & {
  YT?: YouTubeApi;
  onYouTubeIframeAPIReady?: () => void;
};
let loading: Promise<YouTubeApi> | undefined;
let activePlayer: YouTubePlayer | undefined;

export function claimYouTubePlayback(player: YouTubePlayer) {
  if (activePlayer && activePlayer !== player) activePlayer.pauseVideo();
  activePlayer = player;
}

export function releaseYouTubePlayback(player: YouTubePlayer) {
  if (activePlayer === player) activePlayer = undefined;
}

/** Load the documented IFrame API once, only when an article requests a player. */
export function loadYouTubeApi(): Promise<YouTubeApi> {
  const host = window as YouTubeWindow;
  if (host.YT?.Player) return Promise.resolve(host.YT);
  if (loading) return loading;
  loading = new Promise<YouTubeApi>((resolve, reject) => {
    const previous = host.onYouTubeIframeAPIReady;
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    const cleanup = () => {
      window.clearTimeout(timeout);
      if (host.onYouTubeIframeAPIReady === ready) host.onYouTubeIframeAPIReady = previous;
    };
    const fail = () => {
      cleanup();
      script.remove();
      loading = undefined;
      reject(new Error("The YouTube player API did not load."));
    };
    const ready = () => {
      cleanup();
      try {
        previous?.();
      } finally {
        if (host.YT?.Player) resolve(host.YT);
        else fail();
      }
    };
    const timeout = window.setTimeout(fail, 15000);
    host.onYouTubeIframeAPIReady = ready;
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return loading;
}
