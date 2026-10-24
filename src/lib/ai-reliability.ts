export type AiFailureCode =
  | "timeout"
  | "rate_limited"
  | "provider_unavailable"
  | "malformed_response"
  | "invalid_response"
  | "configuration"
  | "unknown";

type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
  sleep?: (delayMs: number) => Promise<void>;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
};

export async function settleAiSections<TGuidance, TCover>({
  generateGuidance,
  fallbackGuidance,
  generateCoverLetter,
}: {
  generateGuidance: () => Promise<TGuidance>;
  fallbackGuidance: () => TGuidance;
  generateCoverLetter: () => Promise<TCover>;
}) {
  let guidance: TGuidance;
  let guidanceError: unknown;
  let coverLetter: TCover | null = null;
  let coverLetterError: unknown;

  try {
    guidance = await generateGuidance();
  } catch (error) {
    guidanceError = error;
    guidance = fallbackGuidance();
  }

  try {
    coverLetter = await generateCoverLetter();
  } catch (error) {
    coverLetterError = error;
  }

  return { guidance, guidanceError, coverLetter, coverLetterError };
}

export async function withBoundedRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 2);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 250);
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? 2_000);
  const shouldRetry = options.shouldRetry ?? isTransientAiError;
  const sleep = options.sleep ?? wait;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !shouldRetry(error)) throw error;

      const retryAfterMs = getRetryAfterMs(error);
      const exponentialDelay = baseDelayMs * 2 ** (attempt - 1);
      const delayMs = Math.min(maxDelayMs, Math.max(exponentialDelay, retryAfterMs));
      options.onRetry?.(error, attempt + 1, delayMs);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

export function classifyAiFailure(error: unknown): AiFailureCode {
  const status = getErrorStatus(error);
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? "");

  if (/timed?\s*out|timeout|aborterror/i.test(message) || status === 408 || status === 504) {
    return "timeout";
  }
  if (status === 429) return "rate_limited";
  if ([500, 502, 503].includes(status) || /temporarily unavailable|internal server error/i.test(message)) {
    return "provider_unavailable";
  }
  if (error instanceof SyntaxError || /json|malformed|schema/i.test(message)) {
    return "malformed_response";
  }
  if (/too short|empty|placeholder|validation|invalid response/i.test(message)) {
    return "invalid_response";
  }
  if (/not configured|api key/i.test(message)) return "configuration";
  return "unknown";
}

export function isTransientAiError(error: unknown) {
  return ["timeout", "rate_limited", "provider_unavailable"].includes(classifyAiFailure(error));
}

export function isRetryableOutputError(error: unknown) {
  const code = classifyAiFailure(error);
  return code === "malformed_response" || code === "invalid_response";
}

export function isValidGeneratedCoverLetter(value: unknown) {
  if (typeof value !== "string") return false;
  const text = value.trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return wordCount >= 90 && !/the cover letter could not be generated/i.test(text);
}

export function getSafeAiDiagnostic(error: unknown) {
  return {
    code: classifyAiFailure(error),
    status: getErrorStatus(error) || undefined,
    errorType: error instanceof Error ? error.name : typeof error,
  };
}

function getErrorStatus(error: unknown) {
  if (!error || typeof error !== "object" || !("status" in error)) return 0;
  const status = Number((error as { status?: unknown }).status);
  return Number.isFinite(status) ? status : 0;
}

function getRetryAfterMs(error: unknown) {
  if (!error || typeof error !== "object" || !("retryAfterMs" in error)) return 0;
  const retryAfterMs = Number((error as { retryAfterMs?: unknown }).retryAfterMs);
  return Number.isFinite(retryAfterMs) && retryAfterMs > 0 ? retryAfterMs : 0;
}

function wait(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}
