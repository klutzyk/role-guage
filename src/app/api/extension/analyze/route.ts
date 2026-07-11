import { NextRequest, NextResponse } from "next/server";
import { generateFitEnrichment, getAiModel } from "@/lib/ai";
import { accountProfileFromRow, AccountProfileRow } from "@/lib/account-profile";
import {
  cleanBoundedText,
  cleanOneLine,
  cleanPublicUrl,
  maxJobTextChars,
  maxPageTitleChars,
  maxResumeTextChars,
} from "@/lib/request-limits";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  createSupabaseServiceClient,
  getUserIdFromBearerToken,
  isSupabaseConfigured,
} from "@/lib/supabase-server";
import { analyzeResumeAgainstJob } from "../../analyze/route";

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

  const rateLimited = enforceRateLimit(request, {
    key: "api:extension-analyze",
    limit: 15,
    windowMs: 60_000,
  });

  if (rateLimited) {
    for (const [key, value] of Object.entries(corsHeaders)) {
      rateLimited.headers.set(key, value);
    }

    return rateLimited;
  }

  const body = (await request.json().catch(() => null)) as
    | { resume?: string; job?: string; pageTitle?: string; pageUrl?: string }
    | null;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Account sign in is not configured." },
      { status: 503, headers: corsHeaders },
    );
  }

  const userId = await getUserIdFromBearerToken(request.headers.get("authorization"));

  if (!userId) {
    return NextResponse.json(
      { error: "Sign in to RoleGuage before analyzing jobs." },
      { status: 401, headers: corsHeaders },
    );
  }

  const accountProfile = await readAccountProfile(userId);
  const resume = cleanBoundedText(accountProfile?.resumeText || body?.resume, maxResumeTextChars);
  const job = cleanBoundedText(body?.job, maxJobTextChars);
  const pageTitle = cleanOneLine(body?.pageTitle, maxPageTitleChars);
  const pageUrl = cleanPublicUrl(body?.pageUrl);

  if (resume.length < 80 || job.length < 80) {
    return NextResponse.json(
      { error: "Resume and job description must both be at least 80 characters." },
      { status: 400, headers: corsHeaders },
    );
  }

  const analysis = analyzeResumeAgainstJob(resume, job, accountProfile?.candidateProfile);

  try {
    const aiEnrichment = await generateFitEnrichment({
      resume,
      job,
      analysis,
      coverLetterInstructions: accountProfile?.coverLetterInstructions,
      coverLetterExamples: accountProfile?.coverLetterExamples,
    });

    return NextResponse.json(
      {
        source: {
          pageTitle,
          pageUrl,
        },
        analysis,
        enrichment: aiEnrichment
          ? {
              aiStatus: "generated",
              aiModel: getAiModel(),
              summary: aiEnrichment.summary,
              nextStep: aiEnrichment.nextStep,
              fitReasoning: aiEnrichment.fitReasoning,
              resumeBullets: aiEnrichment.resumeBullets ?? [],
              coverLetter: aiEnrichment.coverLetter ?? "",
              interviewPrep: aiEnrichment.interviewPrep ?? [],
              outreachMessage: aiEnrichment.outreachMessage ?? "",
              atsNotes: aiEnrichment.atsNotes ?? [],
              gapRoadmap: aiEnrichment.gapRoadmap ?? [],
            }
          : { aiStatus: "disabled" },
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error("Extension enrichment failed", getErrorSummary(error));

    return NextResponse.json(
      {
        source: {
          pageTitle,
          pageUrl,
        },
        analysis,
        enrichment: {
          aiStatus: "fallback",
          aiModel: getAiModel(),
        },
      },
      { headers: corsHeaders },
    );
  }
}

function getErrorSummary(error: unknown) {
  if (!(error instanceof Error)) return String(error);

  const status =
    "status" in error
      ? ` status=${String((error as Error & { status?: unknown }).status)}`
      : "";

  return `${error.message}${status}`;
}

function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const allowedOrigins = getAllowedExtensionOrigins();

  if (!origin || !allowedOrigins.has(origin)) {
    return null;
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
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
