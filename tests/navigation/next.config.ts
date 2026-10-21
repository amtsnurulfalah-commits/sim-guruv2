import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.NAV_FIXTURE_DIST ?? ".next",
  agentRules: false,
  devIndicators: false,
  allowedDevOrigins: ["127.0.0.1"],
};
export default config;
