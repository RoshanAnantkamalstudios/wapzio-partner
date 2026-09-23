import type { NextConfig } from "next";

/**
 * Wapzio Partner Panel.
 *
 * A separate deployment on its own domain (partner.wapzio.com) with its own
 * login. It talks to the same backend as the client app and the super-admin
 * panel, but only through /api/partner/* — endpoints scoped to the signed-in
 * reseller. Nothing in this project may call a tenant endpoint.
 */
const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || "").trim();
const DEPLOYMENT_ID = (process.env.NEXT_PUBLIC_DEPLOYMENT_ID || process.env.GITHUB_SHA || "").trim();

const nextConfig: NextConfig = {
  basePath: BASE_PATH || undefined,
  reactStrictMode: false,
  deploymentId: DEPLOYMENT_ID || undefined,
  // Lets the deploy build into a staging dir and swap it in, so a failed build
  // never leaves the running site with a half-replaced .next
  distDir: process.env.NEXT_DIST_DIR || undefined,
  env: {
    NEXT_PUBLIC_DEPLOYMENT_ID: DEPLOYMENT_ID,
    NEXT_PUBLIC_BASE_PATH: BASE_PATH,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_FRONT_URL: process.env.NEXT_PUBLIC_FRONT_URL,
  },
};

export default nextConfig;
