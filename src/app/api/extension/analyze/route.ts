import { NextRequest, NextResponse } from "next/server";
import { generateFitEnrichment, getAiModel } from "@/lib/ai";
import {
  cleanCoverLetterExamples,
  cleanCoverLetterPreferences,
} from "@/lib/cover-letter-preferences";
import {
  cleanBoundedText,
  cleanOneLine,
  cleanPublicUrl,
  maxJobTextChars,
  maxPageTitleChars,
  maxResumeTextChars,
} from "@/lib/request-limits";
import { enforceRateLimit } from "@/lib/rate-limit";
import { CandidateProfile } from "@/lib/requirements";
import { analyzeResumeAgainstJob } from "../../analyze/route";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  Vary: "Origin",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request: NextRequest) {
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
    | {
        resume?: string;
        job?: string;
        pageTitle?: string;
        pageUrl?: string;
        profile?: CandidateProfile;
        coverLetterInstructions?: string;
        coverLetterExamples?: string[];
      }
    | null;

  const resume = cleanBoundedText(body?.resume, maxResumeTextChars);
  const job = cleanBoundedText(body?.job, maxJobTextChars);
  const pageTitle = cleanOneLine(body?.pageTitle, maxPageTitleChars);
  const pageUrl = cleanPublicUrl(body?.pageUrl);
  const profile = cleanCandidateProfile(body?.profile);
  const coverLetterInstructions = cleanCoverLetterPreferences(body?.coverLetterInstructions);
  const coverLetterExamples = cleanCoverLetterExamples(body?.coverLetterExamples);

  if (resume.length < 80 || job.length < 80) {
    return NextResponse.json(
      { error: "Resume and job description must both be at least 80 characters." },
      { status: 400, headers: corsHeaders },
    );
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("Extension analyze context", {
      profile: hasCandidateProfile(profile) ? "present" : "missing",
      coverLetterInstructionsLength: coverLetterInstructions.length,
      coverLetterExamplesCount: coverLetterExamples.length,
      resumeLength: resume.length,
      jobLength: job.length,
    });
  }

  const analysis = analyzeResumeAgainstJob(resume, job, profile);

  try {
    const aiEnrichment = await generateFitEnrichment({
      resume,
      job,
      analysis,
      profile,
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

function cleanCandidateProfile(profile: unknown): CandidateProfile {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return {};

  const raw = profile as CandidateProfile;

  return {
    workRights: cleanOneLine(raw.workRights, 180),
    visaExpiry: cleanOneLine(raw.visaExpiry, 80),
    location: cleanOneLine(raw.location, 160),
    workMode: cleanOneLine(raw.workMode, 160),
    driversLicence: cleanDriversLicence(raw.driversLicence),
    securityClearance: cleanOneLine(raw.securityClearance, 160),
    licences: cleanOneLine(raw.licences, 300),
    minimumSalary: cleanOneLine(raw.minimumSalary, 80),
    targetRoles: cleanOneLine(raw.targetRoles, 300),
  };
}

function cleanDriversLicence(value: unknown): CandidateProfile["driversLicence"] {
  return value === "yes" || value === "no" || value === "unknown" ? value : "";
}

function hasCandidateProfile(profile: CandidateProfile) {
  return Object.values(profile).some((value) => typeof value === "string" && value.trim());
}

function getErrorSummary(error: unknown) {
  if (!(error instanceof Error)) return String(error);

  const status =
    "status" in error
      ? ` status=${String((error as Error & { status?: unknown }).status)}`
      : "";

  return `${error.message}${status}`;
}
