import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyAiFailure,
  getSafeAiDiagnostic,
  isRetryableOutputError,
  isValidGeneratedCoverLetter,
  settleAiSections,
  withBoundedRetry,
} from "./ai-reliability.ts";

test("returns a successful provider result without retrying", async () => {
  let calls = 0;
  const result = await withBoundedRetry(async () => {
    calls += 1;
    return "cover letter";
  });

  assert.equal(result, "cover letter");
  assert.equal(calls, 1);
});

test("preserves successful report guidance when cover-letter generation fails", async () => {
  const sections = await settleAiSections({
    generateGuidance: async () => ({ summary: "generated report" }),
    fallbackGuidance: () => ({ summary: "fallback report" }),
    generateCoverLetter: async () => {
      throw new SyntaxError("malformed cover-letter JSON");
    },
  });

  assert.deepEqual(sections.guidance, { summary: "generated report" });
  assert.equal(sections.guidanceError, undefined);
  assert.equal(sections.coverLetter, null);
  assert.ok(sections.coverLetterError instanceof SyntaxError);
});

test("retries one intermittent provider failure with bounded exponential backoff", async () => {
  let calls = 0;
  const delays: number[] = [];
  const result = await withBoundedRetry(
    async () => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error("temporarily unavailable"), { status: 503 });
      return "recovered";
    },
    { sleep: async (delay) => { delays.push(delay); } },
  );

  assert.equal(result, "recovered");
  assert.equal(calls, 2);
  assert.deepEqual(delays, [250]);
});

test("classifies and bounds timeout retries", async () => {
  let calls = 0;
  const timeout = Object.assign(new Error("AI request timed out."), { name: "TimeoutError" });

  await assert.rejects(
    withBoundedRetry(
      async () => {
        calls += 1;
        throw timeout;
      },
      { maxAttempts: 2, sleep: async () => undefined },
    ),
    timeout,
  );

  assert.equal(calls, 2);
  assert.equal(classifyAiFailure(timeout), "timeout");
});

test("recognises malformed structured output as retryable output failure", () => {
  const error = new SyntaxError("Unexpected end of JSON input");
  assert.equal(classifyAiFailure(error), "malformed_response");
  assert.equal(isRetryableOutputError(error), true);
});

test("classifies invalid short model output separately from transport failures", () => {
  const error = new Error("AI text response was too short for the selected model.");
  assert.equal(classifyAiFailure(error), "invalid_response");
  assert.equal(isRetryableOutputError(error), true);
});

test("rejects missing and malformed cover letters while accepting complete output", () => {
  assert.equal(isValidGeneratedCoverLetter(""), false);
  assert.equal(isValidGeneratedCoverLetter("too short"), false);
  assert.equal(
    isValidGeneratedCoverLetter(Array.from({ length: 90 }, (_, index) => `word${index}`).join(" ")),
    true,
  );
});

test("safe diagnostics omit provider messages that could contain request content", () => {
  const error = Object.assign(new Error("provider echoed private resume text"), { status: 500 });
  assert.deepEqual(getSafeAiDiagnostic(error), {
    code: "provider_unavailable",
    status: 500,
    errorType: "Error",
  });
});
