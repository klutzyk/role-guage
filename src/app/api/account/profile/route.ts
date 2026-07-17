import { NextRequest, NextResponse } from "next/server";
import {
  accountProfileFromRow,
  accountProfileToRow,
  cleanAccountProfile,
  AccountProfileRow,
} from "@/lib/account-profile";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  createSupabaseServiceClient,
  getUserIdFromBearerToken,
  isSupabaseConfigured,
} from "@/lib/supabase-server";

export const runtime = "nodejs";

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

const publishedExtensionOrigin = "chrome-extension://fodmkdebllldfgclbicnjojgenlndlba";

export async function OPTIONS(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);

  if (!corsHeaders) {
    return new NextResponse(null, { status: 403 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);
  const blocked = await authorizeAccountRequest(request, "api:account-profile:get", 60);
  if (blocked instanceof NextResponse) return withOptionalCors(blocked, corsHeaders);

  const client = createSupabaseServiceClient();
  if (!client) return unavailableResponse(corsHeaders);

  const { data, error } = await client
    .from("user_profiles")
    .select(
      "user_id,resume_text,resume_file_name,candidate_profile,cover_letter_instructions,cover_letter_examples,updated_at",
    )
    .eq("user_id", blocked.userId)
    .maybeSingle<AccountProfileRow>();

  if (error) return serverErrorResponse(corsHeaders);

  return NextResponse.json(
    {
      profile: accountProfileFromRow(data),
    },
    { headers: buildResponseHeaders(corsHeaders) },
  );
}

export async function PUT(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);
  const blocked = await authorizeAccountRequest(request, "api:account-profile:put", 30);
  if (blocked instanceof NextResponse) return withOptionalCors(blocked, corsHeaders);

  const client = createSupabaseServiceClient();
  if (!client) return unavailableResponse(corsHeaders);

  const body = await request.json().catch(() => null);
  const profile = cleanAccountProfile(body?.profile);

  const { error } = await client
    .from("user_profiles")
    .upsert(accountProfileToRow(profile, blocked.userId), { onConflict: "user_id" });

  if (error) return serverErrorResponse(corsHeaders);

  return NextResponse.json(
    {
      profile,
    },
    { headers: buildResponseHeaders(corsHeaders) },
  );
}

export async function DELETE(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);
  const blocked = await authorizeAccountRequest(request, "api:account-profile:delete", 10);
  if (blocked instanceof NextResponse) return withOptionalCors(blocked, corsHeaders);

  const client = createSupabaseServiceClient();
  if (!client) return unavailableResponse(corsHeaders);

  const { error } = await client.from("user_profiles").delete().eq("user_id", blocked.userId);
  if (error) return serverErrorResponse(corsHeaders);

  return NextResponse.json({ deleted: true }, { headers: buildResponseHeaders(corsHeaders) });
}

async function authorizeAccountRequest(request: NextRequest, key: string, limit: number) {
  if (!isSupabaseConfigured()) return unavailableResponse();

  const rateLimited = enforceRateLimit(request, {
    key,
    limit,
    windowMs: 60_000,
  });

  if (rateLimited) return rateLimited;

  const userId = await getUserIdFromBearerToken(request.headers.get("authorization"));

  if (!userId) {
    return NextResponse.json(
      { error: "Sign in before managing account profile data." },
      { status: 401, headers: noStoreHeaders },
    );
  }

  return { userId };
}

function unavailableResponse(corsHeaders?: Record<string, string> | null) {
  return NextResponse.json(
    { error: "Account storage is not configured for this deployment." },
    { status: 503, headers: buildResponseHeaders(corsHeaders) },
  );
}

function serverErrorResponse(corsHeaders?: Record<string, string> | null) {
  return NextResponse.json(
    { error: "Could not update account profile data." },
    { status: 500, headers: buildResponseHeaders(corsHeaders) },
  );
}

function buildResponseHeaders(corsHeaders?: Record<string, string> | null) {
  return {
    ...noStoreHeaders,
    ...(corsHeaders ?? {}),
  };
}

function withOptionalCors(response: NextResponse, corsHeaders?: Record<string, string> | null) {
  if (!corsHeaders) return response;

  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}

function getCorsHeaders(request: NextRequest) {
  const origin = normalizeExtensionOrigin(request.headers.get("origin") ?? "");
  if (!origin) return null;

  const allowedOrigins = new Set([
    publishedExtensionOrigin,
    ...(process.env.EXTENSION_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((item) => normalizeExtensionOrigin(item))
      .filter(Boolean),
  ]);

  if (!allowedOrigins.has(origin)) {
    return null;
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
}

function normalizeExtensionOrigin(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (/^[a-z]{32}$/.test(trimmed)) return `chrome-extension://${trimmed}`;
  return trimmed;
}
