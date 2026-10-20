import type { NextConfig } from "next";

const config: NextConfig = {
  outputFileTracingIncludes: {
    "/api/honorarium/[action]": ["./src/server/activities/assets/DejaVuSans.ttf"],
    "/api/activities/export": ["./src/server/activities/assets/DejaVuSans.ttf"],
  },
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["postgres", "argon2", "pdfkit"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default config;
