import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
	swSrc: "src/app/sw.ts",
	swDest: "public/sw.js",
	// Disable Serwist in development and when using Turbopack (not supported yet)
	disable: process.env.NODE_ENV !== "production",
});

const nextConfig: NextConfig = {
	// Empty turbopack config to silence the warning about webpack config
	turbopack: {},
	// Enable React Compiler for automatic memoization
	reactCompiler: true,
};

export default withSerwist(nextConfig);

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
