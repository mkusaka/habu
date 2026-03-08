const DEFAULT_MAX_JUDGE_ATTEMPTS = 3;

export type JudgedAttemptResult<T> =
  | {
      type: "accepted";
      value: T;
      successMessage?: string;
    }
  | {
      type: "rejected";
      feedback: string;
    }
  | {
      type: "final";
      value: T;
    };

export function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}

export async function runJudgedGenerationLoop<T>(options: {
  label: string;
  runnerId: number;
  signal: AbortSignal;
  runAttempt: (params: {
    attempt: number;
    feedback: string;
    isLastAttempt: boolean;
    signal: AbortSignal;
  }) => Promise<JudgedAttemptResult<T>>;
}): Promise<T> {
  let feedback = "";
  let finalValue: T | undefined;

  for (let attempt = 0; attempt < DEFAULT_MAX_JUDGE_ATTEMPTS; attempt++) {
    throwIfAborted(options.signal);

    const isLastAttempt = attempt === DEFAULT_MAX_JUDGE_ATTEMPTS - 1;
    const result = await options.runAttempt({
      attempt,
      feedback,
      isLastAttempt,
      signal: options.signal,
    });

    if (result.type === "accepted") {
      const suffix = result.successMessage ? ` ${result.successMessage}` : "";
      console.log(
        `[${options.label}] Runner ${options.runnerId} passed on attempt ${attempt + 1}${suffix}`,
      );
      return result.value;
    }

    if (result.type === "final") {
      finalValue = result.value;
      break;
    }

    feedback = result.feedback;
    console.log(
      `[${options.label}] Runner ${options.runnerId} attempt ${attempt + 1} rejected: ${feedback}`,
    );
  }

  if (finalValue === undefined) {
    throw new Error(`[${options.label}] No generation result`);
  }

  return finalValue;
}
