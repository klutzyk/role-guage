import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { generateFitEnrichment, getAiModel } from "@/lib/ai";
import { accountProfileFromRow, AccountProfileRow } from "@/lib/account-profile";
import { cleanCoverLetterExamples, cleanCoverLetterPreferences } from "@/lib/cover-letter-preferences";
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

  if (process.env.NODE_ENV !== "production") {
    console.log("Extension analyze authenticated user", {
      userHash: hashDebugValue(userId),
    });
  }

  const accountProfile = await readAccountProfile(userId);
  if (!accountProfile) {
    return NextResponse.json(
      {
        error: "Your RoleGuage profile could not be loaded. Open RoleGuage, save your profile, then try again.",
        code: "PROFILE_NOT_FOUND",
      },
      { status: 409, headers: corsHeaders },
    );
  }

  const submittedResume = cleanBoundedText(body?.resume, maxResumeTextChars);
  const savedResume = cleanBoundedText(accountProfile.resumeText, maxResumeTextChars);
  const resume = savedResume.length >= 80 ? savedResume : submittedResume;
  const resumeSource = savedResume.length >= 80 ? "account" : "extension";
  const job = cleanBoundedText(body?.job, maxJobTextChars);
  const pageTitle = cleanOneLine(body?.pageTitle, maxPageTitleChars);
  const pageUrl = cleanPublicUrl(body?.pageUrl);

  if (resume.length < 80 || job.length < 80) {
    return NextResponse.json(
      { error: "Resume and job description must both be at least 80 characters." },
      { status: 400, headers: corsHeaders },
    );
  }

  const analysis = analyzeResumeAgainstJob(resume, job, accountProfile.candidateProfile);
  const coverLetterInstructions = cleanCoverLetterPreferences(accountProfile.coverLetterInstructions);
  const coverLetterExamples = cleanCoverLetterExamples(accountProfile.coverLetterExamples);
  const debugContext = buildDebugContext({
    resume,
    job,
    coverLetterInstructions,
    coverLetterExamples,
    profileLocation: accountProfile.candidateProfile?.location ?? "",
    resumeSource,
    profileUpdatedAt: accountProfile.updatedAt ?? "",
  });

  if (process.env.NODE_ENV !== "production") {
    console.log("Extension analyze profile context", {
      profilePresent: Boolean(accountProfile),
      profileUpdatedAt: accountProfile.updatedAt ?? "",
      coverLetterInstructionsLength: coverLetterInstructions.length,
      coverLetterExamplesCount: coverLetterExamples.length,
      resumeLength: resume.length,
      savedResumeLength: savedResume.length,
      submittedResumeLength: submittedResume.length,
      resumeSource,
      jobLength: job.length,
      namedProjectCount: countNamedProjectSignals(resume),
      hasCoverLetterInstructions: coverLetterInstructions.length > 0,
      firstExamplePreview: coverLetterExamples[0]?.slice(0, 150) ?? "",
      instructionsPreview: coverLetterInstructions.slice(0, 150),
      debugContext,
    });
  }

  try {
    const aiEnrichment = await generateFitEnrichment({
      resume,
      job,
      analysis,
      coverLetterInstructions,
      coverLetterExamples,
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
              aiModel: aiEnrichment.aiModel ?? getAiModel(),
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
        ...(process.env.NODE_ENV !== "production" ? { debugContext } : {}),
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
        ...(process.env.NODE_ENV !== "production" ? { debugContext } : {}),
      },
      { headers: corsHeaders },
    );
  }
}

function buildDebugContext({
  resume,
  job,
  coverLetterInstructions,
  coverLetterExamples,
  profileLocation,
  resumeSource,
  profileUpdatedAt,
}: {
  resume: string;
  job: string;
  coverLetterInstructions: string;
  coverLetterExamples: string[];
  profileLocation: string;
  resumeSource: string;
  profileUpdatedAt: string;
}) {
  return {
    resumeHash: hashDebugValue(resume),
    jobHash: hashDebugValue(job),
    instructionHash: hashDebugValue(coverLetterInstructions),
    exampleCount: coverLetterExamples.length,
    profileLocation: profileLocation ? cleanOneLine(profileLocation, 80) : "",
    profileUpdatedAt: profileUpdatedAt ? cleanOneLine(profileUpdatedAt, 80) : "",
    resumeSource,
    namedProjectCount: countNamedProjectSignals(resume),
    hasCoverLetterInstructions: coverLetterInstructions.length > 0,
    firstExampleHash: hashDebugValue(coverLetterExamples[0] ?? ""),
  };
}

function countNamedProjectSignals(resume: string) {
  return resume
    .split(/\n+/)
    .filter((line) => /\b(project|platform|app|application|tool|system|dashboard|prediction|automation|ai|ml)\b/i.test(line))
    .slice(0, 20).length;
}

function hashDebugValue(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 10);
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
  const origin = normalizeExtensionOrigin(request.headers.get("origin") ?? "");
  const allowedOrigins = getAllowedExtensionOrigins();

  if (!origin || !allowedOrigins.has(origin)) {
    console.warn("Extension analyze origin rejected", {
      origin: origin || "missing",
      allowedOriginCount: allowedOrigins.size,
      hasConfiguredOrigins: Boolean(process.env.EXTENSION_ALLOWED_ORIGINS),
    });
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
  if (!client) {
    console.error("Extension analyze profile read failed: service client unavailable");
    return null;
  }

  const { data, error } = await client
    .from("user_profiles")
    .select(
      "user_id,resume_text,resume_file_name,candidate_profile,cover_letter_instructions,cover_letter_examples,updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle<AccountProfileRow>();

  if (error) {
    console.error("Extension analyze profile read failed", {
      userHash: hashDebugValue(userId),
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return null;
  }

  if (!data) {
    console.warn("Extension analyze profile row not found", {
      userHash: hashDebugValue(userId),
    });
    return null;
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("Extension analyze profile row loaded", {
      userHash: hashDebugValue(userId),
      rowUserHash: hashDebugValue(data.user_id),
      updatedAt: data.updated_at,
      hasResume: Boolean(data.resume_text),
      instructionLength: data.cover_letter_instructions?.length ?? 0,
      exampleCount: data.cover_letter_examples?.length ?? 0,
    });
  }

  return accountProfileFromRow(data);
}

function getAllowedExtensionOrigins() {
  const configured = [
    publishedExtensionOrigin,
    ...(process.env.EXTENSION_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((item) => normalizeExtensionOrigin(item))
      .filter(Boolean),
  ];

  return new Set(configured);
}

function normalizeExtensionOrigin(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (/^[a-z]{32}$/.test(trimmed)) return `chrome-extension://${trimmed}`;
  return trimmed;
}
