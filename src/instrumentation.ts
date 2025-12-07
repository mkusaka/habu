// Instrumentation file for AI Tracing
// This file is loaded by Next.js automatically
// See: https://mastra.ai/en/docs/observability/nextjs-tracing

declare global {
  var ___MASTRA_TELEMETRY___: boolean | undefined;
}

export async function register() {
  // Set the global flag to indicate telemetry is initialized
  // This suppresses the "instrumentation file was not loaded" warning from Mastra
  globalThis.___MASTRA_TELEMETRY___ = true;

  console.log("[Instrumentation] AI Tracing initialized");
}
