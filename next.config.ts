import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    // Allow the browser extension (any origin) to POST to /api/contacts/upload.
    return [
      {
        source: "/api/contacts/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, x-api-key",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
