/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // `imageUrl` requests 70 for editorial media; keep Next's default 75 for
    // direct `<Image>` consumers. Next 16 requires every requested quality in
    // this allowlist and already warns during the current unit renderer pass.
    qualities: [70, 75],
    remotePatterns: [
      // Supabase Storage — replace with your project's storage host.
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
