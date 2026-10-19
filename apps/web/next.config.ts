import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    const api = process.env.API_URL ?? "http://127.0.0.1:4100";
    const url = new URL(api);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("API_URL must be HTTP(S)");
    return [{ source: "/api/v1/:path*", destination: `${url.origin}/api/v1/:path*` }];
  },
};

export default nextConfig;
