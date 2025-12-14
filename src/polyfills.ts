(() => {
  if (typeof globalThis === "undefined") return;
  if ("__name" in globalThis) return;

  Object.defineProperty(globalThis, "__name", {
    value: (target: (...args: unknown[]) => unknown, value: string) =>
      Object.defineProperty(target, "name", { value, configurable: true }),
    configurable: true,
  });
})();

export {};
