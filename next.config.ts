import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
	/* config options here */
};

const pwaConfig = withPWA({
	dest: "public",
	disable: process.env.NODE_ENV === "development",
	register: true,
	skipWaiting: true,
});

export default pwaConfig(nextConfig);

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
