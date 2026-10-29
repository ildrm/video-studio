import type { NextConfig } from "next";

const api = process.env.API_URL || "http://127.0.0.1:4000";
const config: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
    ] }];
  },
  async rewrites() { return [{ source: "/v1/:path*", destination: `${api}/v1/:path*` }]; },
};
export default config;
