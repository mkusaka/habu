import { describe, expect, it, vi } from "vitest";
import { runJudgedGenerationLoop, throwIfAborted } from "./judged-generation";

describe("throwIfAborted", () => {
  it("throws AbortError for aborted signals", () => {
    const controller = new AbortController();
    controller.abort();

    expect(() => throwIfAborted(controller.signal)).toThrowError(/Aborted/);
    expect(() => throwIfAborted(controller.signal)).toThrowError("Aborted");
  });
});

describe("runJudgedGenerationLoop", () => {
  it("returns immediately when an attempt is accepted", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const runAttempt = vi.fn().mockResolvedValue({
      type: "accepted" as const,
      value: "accepted-value",
    });

    await expect(
      runJudgedGenerationLoop({
        label: "Test",
        runnerId: 1,
        signal: new AbortController().signal,
        runAttempt,
      }),
    ).resolves.toBe("accepted-value");

    expect(runAttempt).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith("[Test] Runner 1 passed on attempt 1");
    consoleSpy.mockRestore();
  });

  it("passes rejection feedback into the next attempt and returns the final fallback", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const runAttempt = vi
      .fn()
      .mockResolvedValueOnce({
        type: "rejected" as const,
        feedback: "needs more detail",
      })
      .mockResolvedValueOnce({
        type: "rejected" as const,
        feedback: "still too vague",
      })
      .mockResolvedValueOnce({
        type: "final" as const,
        value: "last-value",
      });

    await expect(
      runJudgedGenerationLoop({
        label: "Retry",
        runnerId: 2,
        signal: new AbortController().signal,
        runAttempt,
      }),
    ).resolves.toBe("last-value");

    expect(runAttempt.mock.calls[0][0].feedback).toBe("");
    expect(runAttempt.mock.calls[1][0].feedback).toBe("needs more detail");
    expect(runAttempt.mock.calls[2][0].feedback).toBe("still too vague");
    expect(consoleSpy).toHaveBeenCalledWith(
      "[Retry] Runner 2 attempt 1 rejected: needs more detail",
    );
    expect(consoleSpy).toHaveBeenCalledWith("[Retry] Runner 2 attempt 2 rejected: still too vague");
    consoleSpy.mockRestore();
  });
});
