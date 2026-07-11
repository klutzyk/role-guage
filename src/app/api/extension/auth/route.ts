import { NextRequest, NextResponse } from "next/server";
import { accountProfileFromRow, AccountProfileRow } from "@/lib/account-profile";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  createSupabaseAuthClient,
  createSupabaseServiceClient,
  getUserIdFromBearerToken,
  isSupabaseConfigured,
} from "@/lib/supabase-server";

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

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);

  if (!corsHeaders) {
    return NextResponse.json({ error: "Extension origin is not allowed." }, { status: 403 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Account sign in is not configured." }, { status: 503, headers: corsHeaders });
  }

  const rateLimited = enforceRateLimit(request, {
    key: "api:extension-auth",
    limit: 8,
    windowMs: 60_000,
  });

  if (rateLimited) {
    for (const [key, value] of Object.entries(corsHeaders)) {
      rateLimited.headers.set(key, value);
    }

    return rateLimited;
  }

  const body = (await request.json().catch(() => null)) as
    | { action?: string; email?: string; password?: string; refreshToken?: string }
    | null;
  const authClient = createSupabaseAuthClient();

  if (!authClient) {
    return NextResponse.json({ error: "Account sign in is not configured." }, { status: 503, headers: corsHeaders });
  }

  if (body?.action === "refresh") {
    const { data, error } = await authClient.auth.refreshSession({
      refresh_token: String(body.refreshToken ?? ""),
    });

    if (error || !data.session) {
      return NextResponse.json({ error: "Please sign in again." }, { status: 401, headers: corsHeaders });
    }

    return sessionResponse(data.session, corsHeaders);
  }

  const email = String(body?.email ?? "").trim();
  const password = String(body?.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400, headers: corsHeaders });
  }

  const { data, error } = await authClient.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401, headers: corsHeaders });
  }

  return sessionResponse(data.session, corsHeaders);
}

export async function GET(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);

  if (!corsHeaders) {
    return NextResponse.json({ error: "Extension origin is not allowed." }, { status: 403 });
  }

  const userId = await getUserIdFromBearerToken(request.headers.get("authorization"));

  if (!userId) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401, headers: corsHeaders });
  }

  const profile = await readAccountProfile(userId);

  return NextResponse.json({ profile }, { headers: corsHeaders });
}

async function sessionResponse(
  session: {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
    user?: { email?: string; id?: string };
  },
  headers: Record<string, string>,
) {
  const profile = session.user?.id ? await readAccountProfile(session.user.id) : null;

  return NextResponse.json(
    {
      session: {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: session.expires_at ?? 0,
        email: session.user?.email ?? "",
      },
      profile,
    },
    { headers },
  );
}

async function readAccountProfile(userId: string) {
  const client = createSupabaseServiceClient();
  if (!client) return null;

  const { data, error } = await client
    .from("user_profiles")
    .select(
      "user_id,resume_text,resume_file_name,candidate_profile,cover_letter_instructions,cover_letter_examples,updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle<AccountProfileRow>();

  if (error) return null;

  return accountProfileFromRow(data);
}

function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const allowedOrigins = getAllowedExtensionOrigins();

  if (!origin || !allowedOrigins.has(origin)) {
    return null;
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}

function getAllowedExtensionOrigins() {
  const configured = [
    publishedExtensionOrigin,
    ...(process.env.EXTENSION_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  ];

  return new Set(configured);
}
