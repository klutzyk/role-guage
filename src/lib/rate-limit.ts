import { NextRequest, NextResponse } from "next/server";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

const buckets = new Map<string, { count: number; resetAt: number }>();
let lastPruneAt = 0;

export function enforceRateLimit(
  request: NextRequest,
  options: RateLimitOptions,
) {
  const now = Date.now();

  if (now - lastPruneAt > 60_000) {
    lastPruneAt = now;

    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }

  const clientIp = getClientIp(request);
  const bucketKey = `${options.key}:${clientIp}`;
  const bucket = buckets.get(bucketKey);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(bucketKey, {
      count: 1,
      resetAt: now + options.windowMs,
    });

    return null;
  }

  bucket.count += 1;

  if (bucket.count <= options.limit) return null;

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((bucket.resetAt - now) / 1000),
  );

  return NextResponse.json(
    { error: "Too many requests. Please wait a moment and try again." },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const firstForwardedIp = forwardedFor?.split(",")[0]?.trim();

  return (
    firstForwardedIp ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}
