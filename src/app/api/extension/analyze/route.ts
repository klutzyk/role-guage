import { NextRequest, NextResponse } from "next/server";
import { generateFitEnrichment, getAiModel } from "@/lib/ai";
import { analyzeResumeAgainstJob } from "../../analyze/route";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { resume?: string; job?: string; pageTitle?: string; pageUrl?: string }
    | null;

  const resume = body?.resume?.trim() ?? "";
  const job = body?.job?.trim() ?? "";

  if (resume.length < 80 || job.length < 80) {
    return NextResponse.json(
      { error: "Resume and job description must both be at least 80 characters." },
      { status: 400, headers: corsHeaders },
    );
  }

  const analysis = analyzeResumeAgainstJob(resume, job);

  try {
    const aiEnrichment = await generateFitEnrichment({ resume, job, analysis });

    return NextResponse.json(
      {
        source: {
          pageTitle: body?.pageTitle ?? "",
          pageUrl: body?.pageUrl ?? "",
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
          pageTitle: body?.pageTitle ?? "",
          pageUrl: body?.pageUrl ?? "",
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
