import {
  siApplemusic,
  siBehance,
  siBluesky,
  siDiscord,
  siDribbble,
  siFacebook,
  siGithub,
  siInstagram,
  siMastodon,
  siMedium,
  siPinterest,
  siReddit,
  siSnapchat,
  siSoundcloud,
  siSpotify,
  siSubstack,
  siTelegram,
  siThreads,
  siTiktok,
  siTumblr,
  siTwitch,
  siVimeo,
  siWhatsapp,
  siX,
  siYoutube,
} from "simple-icons";

/**
 * The social networks a link can point at: one list for every social element
 * (the Stage's Social links, Coming Soon Studio, the reel and After Hours
 * designs), so a network added here is available everywhere at once.
 *
 * `path` is the brand mark from Simple Icons (CC0, pinned in package.json),
 * drawn on a 24-unit grid. The first five networks keep their original
 * hand-drawn marks in `SocialIcon`, because pages built before this list are
 * pixel-verified with them; for those, `path` is unused.
 *
 * `brand` is the brand's own colour for "brand colour on hover", or `null`
 * where the brand colour is black (or near it) and would vanish on the dark
 * grounds these elements usually sit on.
 */
export interface SocialNetwork {
  id: string;
  label: string;
  brand: string | null;
  path?: string;
}

const mark = (label: string, icon: { hex: string; path: string }): Omit<SocialNetwork, "id"> => ({
  label,
  brand: isNearBlack(icon.hex) ? null : `#${icon.hex.toLowerCase()}`,
  path: icon.path,
});

function isNearBlack(hex: string) {
  const n = parseInt(hex, 16);
  return (n >> 16) + ((n >> 8) & 255) + (n & 255) < 3 * 48;
}

const NETWORKS: Record<string, Omit<SocialNetwork, "id">> = {
  instagram: mark("Instagram", siInstagram),
  linkedin: { label: "LinkedIn", brand: "#0a66c2" },
  x: mark("X", siX),
  youtube: mark("YouTube", siYoutube),
  tiktok: mark("TikTok", siTiktok),
  facebook: mark("Facebook", siFacebook),
  threads: mark("Threads", siThreads),
  pinterest: mark("Pinterest", siPinterest),
  snapchat: mark("Snapchat", siSnapchat),
  whatsapp: mark("WhatsApp", siWhatsapp),
  telegram: mark("Telegram", siTelegram),
  discord: mark("Discord", siDiscord),
  twitch: mark("Twitch", siTwitch),
  spotify: mark("Spotify", siSpotify),
  applemusic: mark("Apple Music", siApplemusic),
  soundcloud: mark("SoundCloud", siSoundcloud),
  vimeo: mark("Vimeo", siVimeo),
  bluesky: mark("Bluesky", siBluesky),
  mastodon: mark("Mastodon", siMastodon),
  reddit: mark("Reddit", siReddit),
  github: mark("GitHub", siGithub),
  behance: mark("Behance", siBehance),
  dribbble: mark("Dribbble", siDribbble),
  medium: mark("Medium", siMedium),
  substack: mark("Substack", siSubstack),
  tumblr: mark("Tumblr", siTumblr),
  email: { label: "Email", brand: null },
  website: { label: "Website", brand: null },
};

export const SOCIAL_NETWORKS: readonly SocialNetwork[] = Object.entries(NETWORKS).map(
  ([id, network]) => ({ id, ...network })
);

export const socialNetwork = (id: string | undefined): SocialNetwork | undefined =>
  id && Object.prototype.hasOwnProperty.call(NETWORKS, id) ? { id, ...NETWORKS[id] } : undefined;

/** Select options for a network field, in the order above. */
export const SOCIAL_NETWORK_OPTIONS = SOCIAL_NETWORKS.map(({ id, label }) => ({
  value: id,
  label,
}));
