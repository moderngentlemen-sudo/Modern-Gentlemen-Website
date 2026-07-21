/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage — replace with your project's storage host.
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
