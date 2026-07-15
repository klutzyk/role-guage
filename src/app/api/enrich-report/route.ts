import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { generateFitEnrichment, getAiModel } from "@/lib/ai";
import { cleanCandidateProfile } from "@/lib/account-profile";
import { cleanCoverLetterExamples, cleanCoverLetterPreferences } from "@/lib/cover-letter-preferences";
import {
  cleanBoundedText,
  maxJobTextChars,
  maxResumeTextChars,
} from "@/lib/request-limits";
import { enforceRateLimit } from "@/lib/rate-limit";
import { CandidateProfile } from "@/lib/requirements";
import { analyzeResumeAgainstJob } from "../analyze/route";

export async function POST(request: NextRequest) {
  const rateLimited = enforceRateLimit(request, {
    key: "api:enrich-report",
    limit: 10,
    windowMs: 60_000,
  });

  if (rateLimited) return rateLimited;

  const body = (await request.json().catch(() => null)) as
    | {
        resume?: string;
        job?: string;
        profile?: CandidateProfile;
        coverLetterInstructions?: string;
        coverLetterExamples?: string[];
      }
    | null;

  const resume = cleanBoundedText(body?.resume, maxResumeTextChars);
  const job = cleanBoundedText(body?.job, maxJobTextChars);

  if (resume.length < 80 || job.length < 80) {
    return NextResponse.json(
      { error: "Resume and job description must both be at least 80 characters." },
      { status: 400 },
    );
  }

  const profile = cleanCandidateProfile(body?.profile);
  const analysis = analyzeResumeAgainstJob(resume, job, profile);
  const coverLetterInstructions = cleanCoverLetterPreferences(body?.coverLetterInstructions);
  const coverLetterExamples = cleanCoverLetterExamples(body?.coverLetterExamples);
  const debugContext = buildDebugContext({
    resume,
    job,
    coverLetterInstructions,
    coverLetterExamples,
    profileLocation: profile.location ?? "",
  });

  try {
    const aiEnrichment = await generateFitEnrichment({
      resume,
      job,
      analysis,
      coverLetterInstructions,
      coverLetterExamples,
    });

    if (!aiEnrichment) {
      return NextResponse.json({
        aiStatus: "disabled",
      });
    }

    return NextResponse.json({
      aiStatus: "generated",
      aiModel: aiEnrichment.aiModel ?? getAiModel(),
      summary: aiEnrichment.summary,
      nextStep: aiEnrichment.nextStep,
      bullets: aiEnrichment.fitReasoning,
      fitReasoning: aiEnrichment.fitReasoning,
      ...(aiEnrichment.resumeBullets ? { resumeBullets: aiEnrichment.resumeBullets } : {}),
      ...(aiEnrichment.coverLetter ? { coverLetter: aiEnrichment.coverLetter } : {}),
      ...(aiEnrichment.interviewPrep ? { interviewPrep: aiEnrichment.interviewPrep } : {}),
      ...(aiEnrichment.outreachMessage ? { outreachMessage: aiEnrichment.outreachMessage } : {}),
      ...(aiEnrichment.atsNotes ? { atsNotes: aiEnrichment.atsNotes } : {}),
      ...(aiEnrichment.gapRoadmap ? { gapRoadmap: aiEnrichment.gapRoadmap } : {}),
      ...(process.env.NODE_ENV !== "production" ? { debugContext } : {}),
    });
  } catch (error) {
    console.error("Fit report enrichment failed", getErrorSummary(error));

    return NextResponse.json({
      aiStatus: "fallback",
      aiModel: getAiModel(),
      ...(process.env.NODE_ENV !== "production" ? { aiError: getErrorSummary(error) } : {}),
      ...(process.env.NODE_ENV !== "production" ? { debugContext } : {}),
    });
  }
}

function buildDebugContext({
  resume,
  job,
  coverLetterInstructions,
  coverLetterExamples,
  profileLocation,
}: {
  resume: string;
  job: string;
  coverLetterInstructions: string;
  coverLetterExamples: string[];
  profileLocation: string;
}) {
  return {
    resumeHash: hashDebugValue(resume),
    jobHash: hashDebugValue(job),
    instructionHash: hashDebugValue(coverLetterInstructions),
    exampleCount: coverLetterExamples.length,
    profileLocation,
  };
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
