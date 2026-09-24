import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let the interactive pages work at http://127.0.0.1:43123 as well as localhost.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
