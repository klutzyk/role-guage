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

export async function GET(request: NextRequest) {
  const blocked = await authorizeAccountRequest(request, "api:account-profile:get", 60);
  if (blocked instanceof NextResponse) return blocked;

  const client = createSupabaseServiceClient();
  if (!client) return unavailableResponse();

  const { data, error } = await client
    .from("user_profiles")
    .select(
      "user_id,resume_text,resume_file_name,candidate_profile,cover_letter_instructions,cover_letter_examples,updated_at",
    )
    .eq("user_id", blocked.userId)
    .maybeSingle<AccountProfileRow>();

  if (error) return serverErrorResponse();

  return NextResponse.json(
    {
      profile: accountProfileFromRow(data),
    },
    { headers: noStoreHeaders },
  );
}

export async function PUT(request: NextRequest) {
  const blocked = await authorizeAccountRequest(request, "api:account-profile:put", 30);
  if (blocked instanceof NextResponse) return blocked;

  const client = createSupabaseServiceClient();
  if (!client) return unavailableResponse();

  const body = await request.json().catch(() => null);
  const profile = cleanAccountProfile(body?.profile);

  const { error } = await client
    .from("user_profiles")
    .upsert(accountProfileToRow(profile, blocked.userId), { onConflict: "user_id" });

  if (error) return serverErrorResponse();

  return NextResponse.json(
    {
      profile,
    },
    { headers: noStoreHeaders },
  );
}

export async function DELETE(request: NextRequest) {
  const blocked = await authorizeAccountRequest(request, "api:account-profile:delete", 10);
  if (blocked instanceof NextResponse) return blocked;

  const client = createSupabaseServiceClient();
  if (!client) return unavailableResponse();

  const { error } = await client.from("user_profiles").delete().eq("user_id", blocked.userId);
  if (error) return serverErrorResponse();

  return NextResponse.json({ deleted: true }, { headers: noStoreHeaders });
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

function unavailableResponse() {
  return NextResponse.json(
    { error: "Account storage is not configured for this deployment." },
    { status: 503, headers: noStoreHeaders },
  );
}

function serverErrorResponse() {
  return NextResponse.json(
    { error: "Could not update account profile data." },
    { status: 500, headers: noStoreHeaders },
  );
}
