import { createHash } from "crypto";
import { GoogleGenAI } from "@google/genai";
import { buildRagCorpus, buildStructuredProfile, formatRetrievedContext, retrieveContext } from "./rag";
import { RequirementFinding, formatRequirementFindingsForPrompt } from "./requirements";

type AnalysisLike = {
  score: number;
  level: string;
  decision: "Apply" | "Tailor" | "Build" | "Skip";
  nextStep: string;
  matchedSkills: string[];
  missingSkills: string[];
  roleSignals: string[];
  summary: string;
  hardRequirements?: RequirementFinding[];
  salary?: string | null;
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

type PromptContext = {
  profileBlock: string;
  evidenceBlock: string;
  matchBlock: string;
};

type CombinedEnrichmentPayload = Omit<AiFitEnrichmentPayload, "interviewPrep" | "outreachMessage" | "atsNotes" | "gapRoadmap">;

const aiCache = new Map<string, { expiresAt: number; value: unknown }>();
const defaultGeminiModel = "gemini-2.5-flash";
const defaultGroqModel = "openai/gpt-oss-20b";
const aiTimeoutMs = getConfiguredTimeout();
const cacheTtlMs = 1000 * 60 * 60 * 12;

export function isAiConfigured() {
  return Boolean(
    process.env.GROQ_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY,
  );
}

export function getAiModel() {
  if (getLlmProvider() === "groq") {
    return process.env.GROQ_MODEL || defaultGroqModel;
  }

  return process.env.GEMINI_MODEL || defaultGeminiModel;
}

function getLlmProvider() {
  const configured = process.env.LLM_PROVIDER?.toLowerCase();

  if (configured === "groq" || configured === "gemini") return configured;
  if (process.env.GROQ_API_KEY) return "groq";

  return "gemini";
}

function getConfiguredTimeout() {
  const timeout = Number(process.env.GEMINI_TIMEOUT_MS ?? 18000);

  if (!Number.isFinite(timeout)) return 18000;

  return Math.min(Math.max(timeout, 8000), 45000);
}

function getAiModelCandidates() {
  if (getLlmProvider() === "groq") {
    return Array.from(
      new Set([
        process.env.GROQ_MODEL || defaultGroqModel,
        process.env.GROQ_FALLBACK_MODEL || "llama-3.1-8b-instant",
      ]),
    );
  }

  const configuredModel = getAiModel();
  const preferredModels = configuredModel.includes("flash-lite")
    ? ["gemini-2.5-flash"]
    : [configuredModel, "gemini-2.5-flash"];

  return Array.from(new Set(preferredModels));
}

function buildPromptContext(resume: string, job: string, analysis: AnalysisLike): PromptContext {
  const query = [
    analysis.decision,
    analysis.level,
    ...analysis.matchedSkills,
    ...analysis.missingSkills,
    ...analysis.roleSignals,
    job.slice(0, 360),
  ].join(" ");
  const profile = buildStructuredProfile(resume);
  const evidence = formatRetrievedContext(retrieveContext(query, buildRagCorpus(resume, job), 3));

  return {
    profileBlock: toCompactProfile(profile),
    evidenceBlock: evidence.slice(0, 1800),
    matchBlock: [
      `score: ${analysis.score}`,
      `decision: ${analysis.decision}`,
      `level: ${analysis.level}`,
      `matched: ${analysis.matchedSkills.join(", ") || "None"}`,
      `missing: ${analysis.missingSkills.join(", ") || "None"}`,
      `signals: ${analysis.roleSignals.join(", ") || "None"}`,
      formatRequirementFindingsForPrompt(analysis.hardRequirements ?? []),
      `base_summary: ${analysis.summary}`,
      `base_next_step: ${analysis.nextStep}`,
    ].join("\n"),
  };
}

function buildFitPrompt(context: PromptContext) {
  return `You are RoleGuage, an evidence-first job application assistant.

Use only the profile, evidence, and match result below. Never invent facts.
Write direct jobseeker advice. Do not mention AI, models, RAG, algorithms, backend, or scoring rules.
Avoid filler and cliches.

Return JSON only.
summary: one honest paragraph.
nextStep: one direct instruction under 24 words.
fitReasoning: 3 concise evidence-based reasons.
resumeBullets: 2-3 honest resume bullet ideas.

PROFILE
${context.profileBlock}

MATCH
${context.matchBlock}

EVIDENCE
${context.evidenceBlock}`;
}

function buildCoverLetterPrompt(context: PromptContext) {
  return `Generate job application guidance for the jobseeker.

Rules:
- Use only the profile, evidence, and match result below.
- Treat MATCH hard checks as authoritative. If a hard check is blocked or unknown, make it clear in summary and nextStep.
- Do not invent tools, employers, certifications, achievements, locations, work rights, or degrees.
- Do not invent numbers, percentages, revenue, latency, scale, or impact metrics. Only include metrics if they appear in evidence.
- Natural Australian professional tone.
- coverLetter: 180-240 words.
- No headings, no markdown, no placeholders, no bracketed text.
- If the hiring manager is unknown, start with "Hi team,".
- If the profile includes a candidate name, end with "Kind regards" and that name on the next line. Otherwise end with "Kind regards" only.
- Use the exact university name if it appears in the profile. Do not replace it with generic wording like "an Australian university".
- Avoid: "What attracted me", "What stood out", "I am passionate", "I thrive", "perfect fit", "I am excited to apply".
- If evidence is transferable but not direct, phrase it honestly.
- Silently revise once for fake claims, generic filler, repeated wording, and AI cliches.
- Return valid JSON only with these fields:
  summary: 1-2 sentences addressed to the user, not an employer. Summarize whether this job is worth applying to and what to fix. Do not write cover-letter prose.
  nextStep: one direct instruction under 24 words
  fitReasoning: 3 concise evidence-based reasons
  resumeBullets: 2 or 3 honest resume bullet ideas
  coverLetter: the finished cover letter

PROFILE
${context.profileBlock}

MATCH
${context.matchBlock}

EVIDENCE
${context.evidenceBlock}`;
}

function toCompactProfile(profile: ReturnType<typeof buildStructuredProfile>) {
  return [
    `name: ${profile.name || "not stated"}`,
    `years: ${profile.experienceYears || "not stated"}`,
    `education: ${profile.education.join(" | ") || "not stated"}`,
    `skills: ${profile.skills.join(", ") || "not stated"}`,
    profile.projects.length
      ? `evidence:\n${profile.projects
          .slice(0, 5)
          .map((project, index) => `${index + 1}. ${project.text}`)
          .join("\n")}`
      : "evidence: not stated",
    `tone: ${profile.writingPreferences.tone}`,
    `avoid: ${profile.writingPreferences.avoid.join(", ")}`,
  ].join("\n");
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

  const promptContext = buildPromptContext(resume, job, analysis);
  const enrichment = await cachedJsonWithLimit<CombinedEnrichmentPayload>(
    [
      "combined-v1-one-call-guidance-cover",
      getLlmProvider(),
      getAiModelCandidates().join(","),
      resume,
      job,
      JSON.stringify(analysis),
    ].join("\n"),
    combinedEnrichmentSchema,
    buildCoverLetterPrompt(promptContext),
    1200,
  );

  validateCoverLetterText(cleanGeneratedText(enrichment.coverLetter ?? ""), getAiModelCandidates()[0]);
  const cleanedEnrichment = cleanEnrichmentPayload(enrichment, analysis, `${resume}\n${job}`);

  return {
    ...cleanedEnrichment,
    aiStatus: "generated",
    aiModel: getAiModelCandidates()[0],
  };
}

function cleanEnrichmentPayload(payload: CombinedEnrichmentPayload, analysis: AnalysisLike, sourceText: string): CombinedEnrichmentPayload {
  const summary = cleanGeneratedText(payload.summary);
  const fitReasoning = toTextArray(payload.fitReasoning).slice(0, 4);
  const resumeBullets = toTextArray(payload.resumeBullets).slice(0, 3);

  return {
    ...payload,
    summary: looksLikeCoverLetter(summary) ? analysis.summary : summary,
    nextStep: cleanGeneratedText(payload.nextStep),
    fitReasoning: fitReasoning.length ? fitReasoning.map(cleanGeneratedText) : buildFallbackAiReport(analysis).fitReasoning,
    resumeBullets: resumeBullets.length
      ? resumeBullets.map((item) => removeUnsupportedMetrics(cleanGeneratedText(item), sourceText))
      : buildFallbackAiReport(analysis).resumeBullets,
    coverLetter: cleanGeneratedText(payload.coverLetter ?? ""),
  };
}

function toTextArray(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/\n+|(?:^|\s)\d+\.\s+|;\s+/)
      .map((item) => item.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean);
  }

  return [];
}

function looksLikeCoverLetter(text: string) {
  return /\b(i am writing|my background|i bring|i would welcome|thank you for|kind regards|dear |hi team)\b/i.test(text);
}

function removeUnsupportedMetrics(text: string, sourceText: string) {
  const numbers = text.match(/\b\d+(?:\.\d+)?%?|\$\d[\d,]*(?:\.\d+)?\b/g) ?? [];
  const unsupported = numbers.filter((number) => !sourceText.includes(number));

  if (!unsupported.length) return text;

  return text
    .replace(/\b(?:improving|reducing|increasing|decreasing|boosting|cutting|raising|lowering)\b[^.]*\b(?:by|to)\s+\d+(?:\.\d+)?%?[^.]*\./gi, "")
    .replace(/\b\d+(?:\.\d+)?%|\$\d[\d,]*(?:\.\d+)?\b/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .trim();
}

function buildFallbackAiReport(analysis: AnalysisLike): Omit<AiFitEnrichmentPayload, "coverLetter"> {
  const matched = analysis.matchedSkills.slice(0, 3).join(", ") || "the closest matched evidence";
  const gap = analysis.missingSkills[0] || "the largest missing requirement";

  return {
    summary: analysis.summary,
    nextStep: analysis.nextStep,
    fitReasoning: [
      `The strongest visible overlap is ${matched}.`,
      `The main area to check before applying is ${gap}.`,
      "Use only evidence you can support from your resume or real project work.",
    ],
    resumeBullets: [
      `Make ${matched} visible in one clear resume bullet if it is truthful.`,
      `Add a concrete proof point for ${gap} if you have one; otherwise leave it as a gap.`,
    ],
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

  const value = await withTimeout(
    generateJsonWithLimit<T>(prompt, schema, maxOutputTokens),
    aiTimeoutMs * getAiModelCandidates().length,
  );

  aiCache.set(key, {
    expiresAt: Date.now() + cacheTtlMs,
    value,
  });

  return value;
}

async function cachedTextWithLimit(
  seed: string,
  prompt: string,
  maxOutputTokens: number,
) {
  const key = createHash("sha256").update(seed).digest("hex");
  const cached = aiCache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as string;
  }

  const value = await withTimeout(
    generateTextWithLimit(prompt, maxOutputTokens),
    aiTimeoutMs * getAiModelCandidates().length,
  );

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
  if (getLlmProvider() === "groq") {
    return generateGroqJsonWithLimit<T>(prompt, maxOutputTokens);
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  let lastError: unknown;

  for (const model of getAiModelCandidates()) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
          temperature: 0.2,
          maxOutputTokens,
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
        aiTimeoutMs,
      );
      const text = response.text;

      if (!text) {
        throw new Error(`AI response was empty for ${model}.`);
      }

      return parseJsonResponse<T>(text);
    } catch (error) {
      lastError = error;

      if (!isRetryableAiError(error) && !(error instanceof SyntaxError)) {
        break;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function generateTextWithLimit(prompt: string, maxOutputTokens: number) {
  if (getLlmProvider() === "groq") {
    return generateGroqTextWithLimit(prompt, maxOutputTokens);
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  let lastError: unknown;

  for (const model of getAiModelCandidates()) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature: 0.25,
            maxOutputTokens,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        aiTimeoutMs,
      );
      const text = response.text?.trim();

      if (!text) {
        throw new Error(`AI text response was empty for ${model}.`);
      }

      const cleaned = cleanGeneratedText(
        text
          .replace(/^```(?:text)?\s*/i, "")
          .replace(/\s*```$/i, ""),
      );

      validateCoverLetterText(cleaned, model);

      return cleaned;
    } catch (error) {
      lastError = error;

      if (!isRetryableAiError(error) && !isRetryableTextError(error)) {
        break;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function generateGroqJsonWithLimit<T>(prompt: string, maxOutputTokens: number) {
  const text = await generateGroqCompletion({
    prompt: `${prompt}\n\nReturn valid JSON only. Do not include markdown fences.`,
    maxOutputTokens,
    responseFormat: { type: "json_object" },
    temperature: 0.2,
  });

  return parseJsonResponse<T>(text);
}

async function generateGroqTextWithLimit(prompt: string, maxOutputTokens: number) {
  let lastError: unknown;

  for (const model of getAiModelCandidates()) {
    try {
      const text = await generateGroqCompletion({
        prompt,
        maxOutputTokens,
        temperature: 0.25,
        model,
      });
      const cleaned = cleanGeneratedText(
        text
          .replace(/^```(?:text)?\s*/i, "")
          .replace(/\s*```$/i, ""),
      );

      validateCoverLetterText(cleaned, model);

      return cleaned;
    } catch (error) {
      lastError = error;

      if (!isRetryableAiError(error) && !isRetryableTextError(error)) {
        break;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function generateGroqCompletion({
  prompt,
  maxOutputTokens,
  responseFormat,
  temperature,
  model = getAiModelCandidates()[0],
}: {
  prompt: string;
  maxOutputTokens: number;
  responseFormat?: { type: "json_object" };
  temperature: number;
  model?: string;
}) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  const response = await withTimeout(
    fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You write truthful, specific job application material. Use only supplied evidence.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature,
        max_completion_tokens: maxOutputTokens,
        ...(model.startsWith("openai/gpt-oss")
          ? { include_reasoning: false, reasoning_effort: "low" }
          : {}),
        ...(responseFormat ? { response_format: responseFormat } : {}),
      }),
    }),
    aiTimeoutMs,
  );

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    const error = new Error(message || response.statusText) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new Error(`AI text response was empty for ${model}.`);
  }

  return text;
}

function validateCoverLetterText(text: string, model: string) {
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  if (wordCount < 90) {
    throw new Error(`AI text response was too short for ${model}.`);
  }

  if (/\[[^\]]+\]/.test(text) || /placeholder/i.test(text)) {
    throw new Error(`AI text response included placeholders for ${model}.`);
  }
}

function cleanGeneratedText(text: string) {
  return text.replace(/^\s*(?:\d+[\).]|[-*])\s+/, "")
    .replace(/â|‑|–|—/g, "-")
    .replace(/â|’/g, "'")
    .replace(/â|“/g, '"')
    .replace(/â|”/g, '"')
    .replace(/\u00a0/g, " ")
    .trim();
}

function isRetryableTextError(error: unknown) {
  if (!(error instanceof Error)) return false;

  return /too short|included placeholders/i.test(error.message);
}

function parseJsonResponse<T>(text: string) {
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? unfenced.slice(start, end + 1) : unfenced;

  return JSON.parse(candidate) as T;
}

function isRetryableAiError(error: unknown) {
  const status =
    error && typeof error === "object" && "status" in error
      ? Number((error as { status?: unknown }).status)
      : 0;

  return status === 429 || status === 503;
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
  },
  required: [
    "summary",
    "nextStep",
    "fitReasoning",
    "resumeBullets",
  ],
};

const combinedEnrichmentSchema = {
  type: "object",
  properties: {
    ...fitEnrichmentSchema.properties,
    coverLetter: {
      type: "string",
      description: "A finished, truthful cover letter based only on supplied evidence.",
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
