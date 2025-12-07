import type { NextConfig } from "next";
import { execSync } from "child_process";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
	swSrc: "src/app/sw.ts",
	swDest: "public/sw.js",
});

// Get git SHA at build time
// WORKERS_CI_COMMIT_SHA: Cloudflare Workers Builds
// CF_PAGES_COMMIT_SHA: Cloudflare Pages (fallback)
const gitSha = (() => {
	const cfSha = process.env.WORKERS_CI_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA;
	if (cfSha) {
		return cfSha.slice(0, 7);
	}
	try {
		return execSync("git rev-parse --short HEAD").toString().trim();
	} catch {
		return "unknown";
	}
})();

const nextConfig: NextConfig = {
	// Empty turbopack config to silence the warning about webpack config
	turbopack: {},
	// Enable React Compiler for automatic memoization
	reactCompiler: true,
	// Expose git SHA as environment variable
	env: {
		NEXT_PUBLIC_GIT_SHA: gitSha,
	},
};

export default withSerwist(nextConfig);

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
