import { createHash } from "crypto";
import { GoogleGenAI } from "@google/genai";
import { buildRagCorpus, formatRetrievedContext, retrieveContext } from "./rag";

type AnalysisLike = {
  score: number;
  level: string;
  decision: "Apply" | "Tailor" | "Build" | "Skip";
  nextStep: string;
  matchedSkills: string[];
  missingSkills: string[];
  roleSignals: string[];
  summary: string;
};

export type AiStatus = "generated" | "fallback" | "disabled";

export type AiGapRoadmapItem = {
  skill: string;
  action: string;
  proofProject: string;
  timeframe: string;
};

export type AiFitEnrichment = {
  aiStatus: AiStatus;
  aiModel?: string;
  summary: string;
  nextStep: string;
  fitReasoning: string[];
  resumeBullets?: string[];
  coverLetter?: string;
  interviewPrep?: string[];
  outreachMessage?: string;
  atsNotes?: string[];
  gapRoadmap?: AiGapRoadmapItem[];
};

type AiFitEnrichmentPayload = Omit<AiFitEnrichment, "aiStatus" | "aiModel">;

export type AiJobBrief = {
  work: string;
  requirements: string;
  experience: string;
};

type JobForBrief = {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  tags: string[];
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
};

const aiCache = new Map<string, { expiresAt: number; value: unknown }>();
const defaultModel = "gemini-2.5-flash-lite";
const aiTimeoutMs = getConfiguredTimeout();
const cacheTtlMs = 1000 * 60 * 60 * 12;

export function isAiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}

export function getAiModel() {
  return process.env.GEMINI_MODEL || defaultModel;
}

function getConfiguredTimeout() {
  const timeout = Number(process.env.GEMINI_TIMEOUT_MS ?? 12000);

  if (!Number.isFinite(timeout)) return 12000;

  return Math.min(Math.max(timeout, 3000), 30000);
}

export async function generateFitEnrichment({
  resume,
  job,
  analysis,
}: {
  resume: string;
  job: string;
  analysis: AnalysisLike;
}): Promise<AiFitEnrichment | null> {
  if (!isAiConfigured()) return null;

  const query = [
    analysis.decision,
    analysis.level,
    ...analysis.matchedSkills,
    ...analysis.missingSkills,
    ...analysis.roleSignals,
    job.slice(0, 600),
  ].join(" ");
  const context = formatRetrievedContext(retrieveContext(query, buildRagCorpus(resume, job), 4));
  const prompt = `You are RoleGuage, an evidence-first job application assistant.

Use ONLY the retrieved resume and job snippets plus the deterministic score below.
Do not invent experience, employment history, tools, certifications, locations, work rights, or achievements.
If evidence is transferable but not direct, say so plainly.
Keep every field concise and useful for a jobseeker.
Write for a normal jobseeker, not for recruiters, engineers, or product managers.
Do not mention AI, models, rules, fallback, algorithms, deterministic scoring, RAG, snippets, retrieved context, or backend implementation.
Avoid generic filler. Every sentence must tell the user what to do, what to highlight, what to fix, or what to check before applying.
Do not copy the base summary or base next step verbatim. Use them only as guardrails.
The nextStep must be one short, direct instruction under 24 words.
Resume bullets must be honest draft ideas based only on evidence in the resume and job ad.
Cover letter must be short, plain, truthful, and specific to the role. Do not invent achievements.

MATCH RESULT
Score: ${analysis.score}
Decision: ${analysis.decision}
Level: ${analysis.level}
Matched skills: ${analysis.matchedSkills.join(", ") || "None"}
Missing skills: ${analysis.missingSkills.join(", ") || "None"}
Role signals: ${analysis.roleSignals.join(", ") || "None"}
Base summary: ${analysis.summary}
Base next step: ${analysis.nextStep}

RESUME AND JOB EVIDENCE
${context}`;

  const enrichment = await cachedJsonWithLimit<AiFitEnrichmentPayload>(
    ["fit-v2-cover-letter", resume, job, JSON.stringify(analysis)].join("\n"),
    fitEnrichmentSchema,
    prompt,
    800,
  );

  return {
    ...enrichment,
    aiStatus: "generated",
    aiModel: getAiModel(),
  };
}

export async function generateJobBriefs(jobs: JobForBrief[]) {
  if (!isAiConfigured() || !jobs.length) return new Map<string, AiJobBrief>();

  const compactJobs = jobs.slice(0, 6).map((job) => ({
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    tags: job.tags,
    score: job.score,
    matchedSkills: job.matchedSkills,
    missingSkills: job.missingSkills,
    description: job.description.slice(0, 1400),
  }));
  const prompt = `Summarize these real job listings for a jobseeker scanning search results.

For each job, return:
- work: what the job mainly does
- requirements: main skills/tools/responsibilities wanted
- experience: seniority, years, education, location/work-rights constraints, or "Not clearly stated"

Do not add facts that are not in the listing. Keep each value under 150 characters.

JOBS
${JSON.stringify(compactJobs)}`;

  const response = await cachedJsonWithLimit<{ jobs: Array<{ id: string; brief: AiJobBrief }> }>(
    ["briefs", JSON.stringify(compactJobs)].join("\n"),
    jobBriefBatchSchema,
    prompt,
    800,
  );

  return new Map(response.jobs.map((item) => [item.id, item.brief]));
}

async function cachedJsonWithLimit<T>(
  seed: string,
  schema: Record<string, unknown>,
  prompt: string,
  maxOutputTokens: number,
) {
  const key = createHash("sha256").update(seed).digest("hex");
  const cached = aiCache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  const value = await withTimeout(generateJsonWithLimit<T>(prompt, schema, maxOutputTokens), aiTimeoutMs);

  aiCache.set(key, {
    expiresAt: Date.now() + cacheTtlMs,
    value,
  });

  return value;
}

async function generateJsonWithLimit<T>(
  prompt: string,
  schema: Record<string, unknown>,
  maxOutputTokens: number,
) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: getAiModel(),
    contents: prompt,
    config: {
      temperature: 0.2,
      maxOutputTokens,
      responseMimeType: "application/json",
      responseJsonSchema: schema,
    },
  });
  const text = response.text;

  if (!text) {
    throw new Error("AI response was empty.");
  }

  return JSON.parse(text) as T;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("AI request timed out.")), timeoutMs);
    }),
  ]);
}

const stringArraySchema = {
  type: "array",
  items: { type: "string" },
};

const fitEnrichmentSchema = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "One concise paragraph explaining the fit honestly.",
    },
    nextStep: {
      type: "string",
      description: "One short direct next action under 24 words.",
    },
    fitReasoning: {
      ...stringArraySchema,
      description: "Three concise evidence-based reasons behind the recommendation.",
    },
    resumeBullets: {
      ...stringArraySchema,
      description: "Two or three honest resume bullet draft ideas based only on evidence.",
    },
    coverLetter: {
      type: "string",
      description: "A short truthful cover letter draft based only on the resume and job ad.",
    },
  },
  required: [
    "summary",
    "nextStep",
    "fitReasoning",
    "resumeBullets",
    "coverLetter",
  ],
};

const jobBriefSchema = {
  type: "object",
  properties: {
    work: { type: "string" },
    requirements: { type: "string" },
    experience: { type: "string" },
  },
  required: ["work", "requirements", "experience"],
};

const jobBriefBatchSchema = {
  type: "object",
  properties: {
    jobs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          brief: jobBriefSchema,
        },
        required: ["id", "brief"],
      },
    },
  },
  required: ["jobs"],
};
