import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { generateFitEnrichment, getAiModel, isAnalysisLike } from "@/lib/ai";
import { getSafeAiDiagnostic } from "@/lib/ai-reliability";
import { cleanCandidateProfile } from "@/lib/account-profile";
import { StructuredResumeProfile, extractStructuredResumeProfile } from "@/lib/resume-profile";
import { cleanCoverLetterExamples, cleanCoverLetterPreferences } from "@/lib/cover-letter-preferences";
import {
  cleanBoundedText,
  maxJobTextChars,
  maxResumeTextChars,
} from "@/lib/request-limits";
import { enforceRateLimit } from "@/lib/rate-limit";
import { CandidateProfile } from "@/lib/requirements";
import { analyzeResumeAgainstJobWithRequirements } from "../analyze/route";

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
        structuredResumeProfile?: StructuredResumeProfile | null;
        analysis?: unknown;
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
  const analysis = isAnalysisLike(body?.analysis)
    ? body.analysis
    : await analyzeResumeAgainstJobWithRequirements(
        resume,
        job,
        profile,
        body?.structuredResumeProfile ?? (await extractStructuredResumeProfile(resume)),
      );
  const coverLetterInstructions = cleanCoverLetterPreferences(body?.coverLetterInstructions);
  const coverLetterExamples = cleanCoverLetterExamples(body?.coverLetterExamples);
  const debugContext = buildDebugContext({
    resume,
    job,
    coverLetterInstructions,
    coverLetterExamples,
  });

  if (process.env.NODE_ENV !== "production") {
    console.log("Site enrich profile context", {
      profilePresent: Boolean(body?.profile),
      coverLetterInstructionsLength: coverLetterInstructions.length,
      coverLetterExamplesCount: coverLetterExamples.length,
      resumeLength: resume.length,
      jobLength: job.length,
      reusedSubmittedAnalysis: isAnalysisLike(body?.analysis),
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

    if (!aiEnrichment) {
      return NextResponse.json({
        aiStatus: "disabled",
      });
    }

    return NextResponse.json({
      aiStatus: aiEnrichment.aiStatus,
      aiModel: aiEnrichment.aiModel ?? getAiModel(),
      summary: aiEnrichment.summary,
      nextStep: aiEnrichment.nextStep,
      bullets: aiEnrichment.fitReasoning,
      fitReasoning: aiEnrichment.fitReasoning,
      ...(aiEnrichment.resumeBullets ? { resumeBullets: aiEnrichment.resumeBullets } : {}),
      ...(aiEnrichment.coverLetter ? { coverLetter: aiEnrichment.coverLetter } : {}),
      coverLetterStatus: aiEnrichment.coverLetterStatus,
      ...(aiEnrichment.coverLetterFailureCode
        ? { coverLetterFailureCode: aiEnrichment.coverLetterFailureCode }
        : {}),
      ...(aiEnrichment.interviewPrep ? { interviewPrep: aiEnrichment.interviewPrep } : {}),
      ...(aiEnrichment.outreachMessage ? { outreachMessage: aiEnrichment.outreachMessage } : {}),
      ...(aiEnrichment.atsNotes ? { atsNotes: aiEnrichment.atsNotes } : {}),
      ...(aiEnrichment.gapRoadmap ? { gapRoadmap: aiEnrichment.gapRoadmap } : {}),
      ...(process.env.NODE_ENV !== "production" ? { debugContext } : {}),
    });
  } catch (error) {
    console.error("Fit report enrichment failed", {
      requestId: debugContext.requestId,
      ...getSafeAiDiagnostic(error),
    });

    return NextResponse.json({
      aiStatus: "fallback",
      aiModel: getAiModel(),
      coverLetterStatus: "failed",
      ...(process.env.NODE_ENV !== "production" ? { debugContext } : {}),
    });
  }
}

function buildDebugContext({
  resume,
  job,
  coverLetterInstructions,
  coverLetterExamples,
}: {
  resume: string;
  job: string;
  coverLetterInstructions: string;
  coverLetterExamples: string[];
}) {
  return {
    requestId: hashDebugValue(`${resume}\n${job}`),
    resumeHash: hashDebugValue(resume),
    jobHash: hashDebugValue(job),
    instructionHash: hashDebugValue(coverLetterInstructions),
    exampleCount: coverLetterExamples.length,
    firstExampleHash: hashDebugValue(coverLetterExamples[0] ?? ""),
  };
}

function hashDebugValue(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 10);
}
