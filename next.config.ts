import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@temporalio/client",
    "@temporalio/worker",
    "@temporalio/workflow",
    "@temporalio/activity",
  ],
};

export default nextConfig;
