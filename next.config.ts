import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,

  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },

  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ui-avatars.com",
        pathname: "/api/**",
      },
    ],
  },

  generateBuildId: async () => Date.now().toString(),

  async redirects() {
    return [
      {
        source: "/dashboard/admin/beta-queue",
        destination: "/dashboard/admin/waitlist",
        permanent: true,
      },
      {
        source: "/dashboard/admin/beta-queue/:path*",
        destination: "/dashboard/admin/waitlist",
        permanent: true,
      },
      {
        source: "/dashboard/admin/beta",
        destination: "/dashboard/admin/waitlist",
        permanent: true,
      },
      {
        source: "/dashboard/admin/beta/:path*",
        destination: "/dashboard/admin/waitlist",
        permanent: true,
      },
      {
        source: "/admin/beta-queue",
        destination: "/dashboard/admin/waitlist",
        permanent: true,
      },
      {
        source: "/admin/beta-queue/:path*",
        destination: "/dashboard/admin/waitlist",
        permanent: true,
      },
      {
        source: "/admin/feedback",
        destination: "/dashboard/admin/waitlist",
        permanent: true,
      },
      {
        source: "/admin/feedback/:path*",
        destination: "/dashboard/admin/waitlist",
        permanent: true,
      },
      {
        source: "/dashboard/feedback",
        destination: "/dashboard",
        permanent: true,
      },
      {
        source: "/dashboard/feedback/:path*",
        destination: "/dashboard",
        permanent: true,
      },
      { source: "/feedback", destination: "/dashboard", permanent: true },
      { source: "/feedback/:path*", destination: "/dashboard", permanent: true },
    ];
  },

  async headers() {
    return [
      {
        source: "/:all*\\.(png|jpg|jpeg|svg|webp)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
