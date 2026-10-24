import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { generateCoverLetterDraft, isAnalysisLike } from "@/lib/ai";
import { getSafeAiDiagnostic } from "@/lib/ai-reliability";
import { cleanCandidateProfile } from "@/lib/account-profile";
import { cleanCoverLetterExamples, cleanCoverLetterPreferences } from "@/lib/cover-letter-preferences";
import { cleanBoundedText, maxJobTextChars, maxResumeTextChars } from "@/lib/request-limits";
import { enforceRateLimit } from "@/lib/rate-limit";
import { extractStructuredResumeProfile, StructuredResumeProfile } from "@/lib/resume-profile";
import { CandidateProfile } from "@/lib/requirements";
import { analyzeResumeAgainstJobWithRequirements } from "../analyze/route";

export async function POST(request: NextRequest) {
  const rateLimited = enforceRateLimit(request, {
    key: "api:generate-cover-letter",
    limit: 10,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  const body = (await request.json().catch(() => null)) as
    | {
        resume?: string;
        job?: string;
        profile?: CandidateProfile;
        structuredResumeProfile?: StructuredResumeProfile | null;
        analysis?: unknown;
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

  const requestId = createHash("sha256").update(`${resume}\n${job}`).digest("hex").slice(0, 10);

  try {
    const profile = cleanCandidateProfile(body?.profile);
    const analysis = isAnalysisLike(body?.analysis)
      ? body.analysis
      : await analyzeResumeAgainstJobWithRequirements(
          resume,
          job,
          profile,
          body?.structuredResumeProfile ?? (await extractStructuredResumeProfile(resume)),
        );
    const result = await generateCoverLetterDraft({
      resume,
      job,
      analysis,
      coverLetterInstructions: cleanCoverLetterPreferences(body?.coverLetterInstructions),
      coverLetterExamples: cleanCoverLetterExamples(body?.coverLetterExamples),
    });

    return NextResponse.json({
      coverLetter: result.coverLetter,
      coverLetterStatus: "generated",
      aiModel: result.aiModel,
    });
  } catch (error) {
    const diagnostic = getSafeAiDiagnostic(error);
    console.error("Cover letter retry failed", { requestId, ...diagnostic });

    return NextResponse.json(
      {
        error: "The cover letter could not be generated yet. Please try again.",
        coverLetterStatus: "failed",
        coverLetterFailureCode: diagnostic.code,
      },
      { status: diagnostic.code === "configuration" ? 503 : 502 },
    );
  }
}
