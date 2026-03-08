// @vitest-environment happy-dom

import assert from "node:assert/strict";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

import { TagCleanupManager } from "./tag-cleanup-manager";

class ResizeObserverMock {
  observe() {}
  disconnect() {}
  unobserve() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.stubGlobal("fetch", vi.fn());
  Object.defineProperty(globalThis.navigator, "clipboard", {
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("TagCleanupManager", () => {
  it("loads candidate results and renders the graph summary", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        tagCount: 12,
        hatenaId: "mkusaka",
        candidates: [
          {
            sourceTag: "article",
            action: "update",
            targetTag: "記事",
            sourceCount: 10,
            targetCount: 20,
          },
        ],
      }),
    } as Response);

    render(<TagCleanupManager />);
    fireEvent.click(screen.getByRole("button", { name: "Generate candidates" }));

    await screen.findByTitle("Highlight article");

    assert.match(screen.getByText(/Tags:/).textContent ?? "", /Tags:\s*12/);
    assert.match(
      screen.getByText(/Suggested changes:/).textContent ?? "",
      /Suggested changes:\s*1/,
    );
    assert.deepEqual(toastSuccess.mock.calls, [["Candidates generated"]]);
  });

  it("renders an error message when candidate generation fails", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: "boom",
      }),
    } as Response);

    render(<TagCleanupManager />);
    fireEvent.click(screen.getByRole("button", { name: "Generate candidates" }));

    await waitFor(() => {
      assert.ok(screen.getByText("boom"));
    });
    assert.deepEqual(toastError.mock.calls, [
      ["Candidate generation failed", { description: "boom" }],
    ]);
  });
});
