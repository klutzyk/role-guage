import { createHash } from "crypto";
import { cleanBoundedText, cleanOneLine, maxResumeTextChars } from "@/lib/request-limits";

export type StructuredResumeProfile = {
  summary: string;
  totalCommercialExperienceYears: number;
  currentEmploymentStatus: "employed" | "not_currently_employed" | "unclear";
  roles: Array<{
    title: string;
    employer: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
    evidence: string[];
  }>;
  skills: {
    languages: string[];
    frameworks: string[];
    databases: string[];
    cloud: string[];
    tools: string[];
    practices: string[];
  };
  education: string[];
  projects: Array<{
    name: string;
    summary: string;
    technologies: string[];
    evidence: string[];
  }>;
  workRights: string;
  location: string;
};

type RawStructuredResumeProfile = Partial<StructuredResumeProfile>;

const emptySkills: StructuredResumeProfile["skills"] = {
  languages: [],
  frameworks: [],
  databases: [],
  cloud: [],
  tools: [],
  practices: [],
};

const cache = new Map<string, { expiresAt: number; value: StructuredResumeProfile }>();
const cacheTtlMs = 1000 * 60 * 60 * 12;

export function emptyStructuredResumeProfile(): StructuredResumeProfile {
  return {
    summary: "",
    totalCommercialExperienceYears: 0,
    currentEmploymentStatus: "unclear",
    roles: [],
    skills: { ...emptySkills },
    education: [],
    projects: [],
    workRights: "",
    location: "",
  };
}

export function cleanStructuredResumeProfile(value: unknown): StructuredResumeProfile | null {
  if (!isRecord(value)) return null;

  const status = value.currentEmploymentStatus;
  const currentEmploymentStatus =
    status === "employed" || status === "not_currently_employed" || status === "unclear"
      ? status
      : "unclear";
  const skills = isRecord(value.skills) ? value.skills : {};

  return {
    summary: cleanOneLine(value.summary, 500),
    totalCommercialExperienceYears: cleanNumber(value.totalCommercialExperienceYears),
    currentEmploymentStatus,
    roles: toArray(value.roles)
      .map((role) => {
        const record = isRecord(role) ? role : {};
        return {
          title: cleanOneLine(record.title, 120),
          employer: cleanOneLine(record.employer, 120),
          startDate: cleanOneLine(record.startDate, 40),
          endDate: cleanOneLine(record.endDate, 40),
          isCurrent: record.isCurrent === true,
          evidence: toStringArray(record.evidence, 6, 220),
        };
      })
      .filter((role) => role.title || role.employer)
      .slice(0, 8),
    skills: {
      languages: toStringArray(skills.languages, 24, 60),
      frameworks: toStringArray(skills.frameworks, 24, 60),
      databases: toStringArray(skills.databases, 16, 60),
      cloud: toStringArray(skills.cloud, 16, 60),
      tools: toStringArray(skills.tools, 24, 60),
      practices: toStringArray(skills.practices, 24, 80),
    },
    education: toStringArray(value.education, 8, 180),
    projects: toArray(value.projects)
      .map((project) => {
        const record = isRecord(project) ? project : {};
        return {
          name: cleanOneLine(record.name, 120),
          summary: cleanOneLine(record.summary, 360),
          technologies: toStringArray(record.technologies, 16, 60),
          evidence: toStringArray(record.evidence, 6, 240),
        };
      })
      .filter((project) => project.name || project.summary)
      .slice(0, 8),
    workRights: cleanOneLine(value.workRights, 180),
    location: cleanOneLine(value.location, 180),
  };
}

export async function extractStructuredResumeProfile(resume: string): Promise<StructuredResumeProfile | null> {
  const cleanedResume = cleanBoundedText(resume, maxResumeTextChars);
  if (cleanedResume.length < 80 || !process.env.GROQ_API_KEY) return null;

  const key = createHash("sha256").update(`resume-profile-v1\n${cleanedResume}`).digest("hex");
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const raw = await extractRawStructuredProfile(cleanedResume);
    const cleaned = cleanStructuredResumeProfile(raw) ?? emptyStructuredResumeProfile();

    cache.set(key, {
      expiresAt: Date.now() + cacheTtlMs,
      value: cleaned,
    });

    return cleaned;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Structured resume extraction skipped", error instanceof Error ? error.message : String(error));
    }
    return null;
  }
}

export function formatStructuredResumeForMatching(profile: StructuredResumeProfile | null | undefined) {
  if (!profile) return "";

  const skillList = [
    ...profile.skills.languages,
    ...profile.skills.frameworks,
    ...profile.skills.databases,
    ...profile.skills.cloud,
    ...profile.skills.tools,
    ...profile.skills.practices,
  ];
  const lines = [
    profile.summary ? `Structured resume summary: ${profile.summary}` : "",
    profile.totalCommercialExperienceYears
      ? `Commercial software experience: ${profile.totalCommercialExperienceYears} years`
      : "",
    `Current employment status: ${profile.currentEmploymentStatus}`,
    profile.location ? `Candidate location: ${profile.location}` : "",
    profile.workRights ? `Work rights: ${profile.workRights}` : "",
    skillList.length ? `Verified skills: ${Array.from(new Set(skillList)).join(", ")}` : "",
    ...profile.roles.map((role) =>
      [
        "Role:",
        role.title,
        role.employer ? `at ${role.employer}` : "",
        role.startDate || role.endDate ? `(${role.startDate || "unknown"} - ${role.endDate || "unknown"})` : "",
        role.evidence.length ? `Evidence: ${role.evidence.join("; ")}` : "",
      ]
        .filter(Boolean)
        .join(" "),
    ),
    ...profile.projects.map((project) =>
      [
        `Project: ${project.name || "Unnamed project"}`,
        project.summary,
        project.technologies.length ? `Tech: ${project.technologies.join(", ")}` : "",
        project.evidence.length ? `Evidence: ${project.evidence.join("; ")}` : "",
      ]
        .filter(Boolean)
        .join(" "),
    ),
    profile.education.length ? `Education: ${profile.education.join("; ")}` : "",
  ];

  return lines.filter(Boolean).join("\n");
}

async function extractRawStructuredProfile(resume: string): Promise<RawStructuredResumeProfile> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured.");

  const models = getResumeProfileModels();
  let lastError: unknown;

  for (const model of models) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
                "Extract a structured resume profile as strict JSON. Use only the resume text. Do not invent skills, employers, dates, work rights, or current employment.",
            },
            {
              role: "user",
              content: buildResumeProfilePrompt(resume),
            },
          ],
          temperature: 0,
          max_completion_tokens: 1400,
          ...(model.startsWith("openai/gpt-oss")
            ? { include_reasoning: false, reasoning_effort: "low" }
            : {}),
        }),
      });

      if (!response.ok) {
        lastError = new Error(await response.text().catch(() => response.statusText));
        continue;
      }

      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error(`Resume extraction returned empty output for ${model}.`);

      const parsed = parseJson(text) as RawStructuredResumeProfile;
      if (process.env.NODE_ENV !== "production") {
        console.log("Structured resume profile model used", model);
      }
      return parsed;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function buildResumeProfilePrompt(resume: string) {
  return `Extract the candidate's resume facts.

Return JSON only:
{
  "summary": "one factual sentence",
  "totalCommercialExperienceYears": 0,
  "currentEmploymentStatus": "employed | not_currently_employed | unclear",
  "roles": [
    {
      "title": "",
      "employer": "",
      "startDate": "YYYY-MM or stated text",
      "endDate": "YYYY-MM, present, or stated text",
      "isCurrent": false,
      "evidence": ["specific commercial work facts"]
    }
  ],
  "skills": {
    "languages": [],
    "frameworks": [],
    "databases": [],
    "cloud": [],
    "tools": [],
    "practices": []
  },
  "education": [],
  "projects": [
    {
      "name": "",
      "summary": "",
      "technologies": [],
      "evidence": ["specific project facts"]
    }
  ],
  "workRights": "",
  "location": ""
}

Rules:
- Use only explicit resume evidence.
- Do not infer current employment unless a role says Present, Current, or Now.
- Convert date ranges when clear, but do not invent missing dates.
- totalCommercialExperienceYears should count commercial/professional roles, not study or side projects.
- Separate personal/project experience from commercial employment.
- Keep evidence concise and factual.

RESUME:
${resume.slice(0, maxResumeTextChars)}`;
}

function getResumeProfileModels() {
  return Array.from(
    new Set([
      ...parseModelList([process.env.GROQ_RESUME_PROFILE_MODEL]),
      "groq/compound-mini",
      ...parseModelList([process.env.GROQ_RESUME_PROFILE_FALLBACK_MODEL, process.env.GROQ_RESUME_PROFILE_FALLBACK_MODELS]),
      "llama-3.1-8b-instant",
    ]),
  );
}

function parseModelList(values: Array<string | undefined>) {
  return values
    .flatMap((models) => (models ?? "").split(","))
    .map((model) => model.trim())
    .filter(Boolean);
}

function parseJson(text: string) {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch?.[0] ?? cleaned);
}

function toArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function toStringArray(value: unknown, limit: number, itemMaxLength: number) {
  return toArray(value)
    .map((item) => cleanOneLine(item, itemMaxLength))
    .filter(Boolean)
    .filter((item, index, items) => items.findIndex((other) => other.toLowerCase() === item.toLowerCase()) === index)
    .slice(0, limit);
}

function cleanNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(Math.max(number, 0), 60) : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
