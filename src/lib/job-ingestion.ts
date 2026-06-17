export type JobSourceKind = "greenhouse" | "smartrecruiters";

export type JobSource = {
  kind: JobSourceKind;
  name: string;
  slug: string;
};

export type IngestedJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  descriptionSummary: {
    work: string;
    requirements: string;
    experience: string;
  };
  applyUrl: string;
  source: string;
  postedAt: string;
  tags: string[];
};

type GreenhouseJob = {
  id?: number;
  title?: string;
  absolute_url?: string;
  updated_at?: string;
  content?: string;
  departments?: Array<{ name?: string }>;
  offices?: Array<{ name?: string; location?: string }>;
  metadata?: Array<{ name?: string; value?: string | string[] | null }>;
};

type SmartRecruitersJob = {
  id?: string;
  name?: string;
  releasedDate?: string;
  postingUrl?: string;
  applyUrl?: string;
  ref?: string;
  company?: { identifier?: string; name?: string };
  location?: {
    city?: string;
    country?: string;
    fullLocation?: string;
    remote?: boolean;
    hybrid?: boolean;
  };
  industry?: { label?: string };
  function?: { label?: string };
  experienceLevel?: { label?: string };
  typeOfEmployment?: { label?: string };
  customField?: Array<{ fieldLabel?: string; valueLabel?: string }>;
  jobAd?: {
    sections?: Record<string, { title?: string; text?: string } | undefined>;
  };
};

const defaultTimeoutMs = 14000;
const cacheTtlMs = 1000 * 60 * 60 * 6;
const cache = new Map<string, { expiresAt: number; jobs: IngestedJob[] }>();

const seededSources: JobSource[] = [
  { kind: "smartrecruiters", name: "Canva", slug: "canva" },
  { kind: "greenhouse", name: "Culture Amp", slug: "cultureamp" },
  { kind: "greenhouse", name: "Figma", slug: "figma" },
  { kind: "greenhouse", name: "GitLab", slug: "gitlab" },
  { kind: "greenhouse", name: "MongoDB", slug: "mongodb" },
  { kind: "greenhouse", name: "Stripe", slug: "stripe" },
  { kind: "greenhouse", name: "Databricks", slug: "databricks" },
  { kind: "greenhouse", name: "Airbnb", slug: "airbnb" },
  { kind: "greenhouse", name: "Coinbase", slug: "coinbase" },
  { kind: "greenhouse", name: "Anthropic", slug: "anthropic" },
  { kind: "greenhouse", name: "Canonical", slug: "canonical" },
];

export async function fetchOwnedJobFeed(query: string, location: string) {
  const sources = getJobSources();
  const cacheKey = `${sources.map((source) => `${source.kind}:${source.slug}`).join(",")}:${query}:${location}`;
  const cached = cache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.jobs;
  }

  const settledResults = await Promise.allSettled(
    sources.map((source) => fetchSourceJobs(source)),
  );
  const jobs = settledResults.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
  const filteredJobs = filterJobs(jobs, query, location).slice(0, getMaxIngestedJobs());

  cache.set(cacheKey, {
    expiresAt: Date.now() + cacheTtlMs,
    jobs: filteredJobs,
  });

  return filteredJobs;
}

function getJobSources() {
  const configuredSources = parseConfiguredSources();
  const maxSources = getMaxSources();

  return (configuredSources.length ? configuredSources : seededSources).slice(0, maxSources);
}

function parseConfiguredSources() {
  const raw = process.env.ROLEGUAGE_JOB_SOURCES_JSON;

  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((source) => {
        const record = source as Partial<JobSource>;

        return {
          kind: record.kind,
          name: cleanText(record.name),
          slug: cleanText(record.slug).toLowerCase(),
        };
      })
      .filter((source): source is JobSource =>
        (source.kind === "greenhouse" || source.kind === "smartrecruiters") &&
          Boolean(source.name && source.slug),
      );
  } catch {
    return [];
  }
}

async function fetchSourceJobs(source: JobSource) {
  if (source.kind === "greenhouse") {
    return fetchGreenhouseJobs(source);
  }

  if (source.kind === "smartrecruiters") {
    return fetchSmartRecruitersJobs(source);
  }

  return [];
}

async function fetchGreenhouseJobs(source: JobSource): Promise<IngestedJob[]> {
  const url = new URL(`https://boards-api.greenhouse.io/v1/boards/${source.slug}/jobs`);
  url.searchParams.set("content", "true");

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(getTimeoutMs()),
  });

  if (!response.ok) return [];

  const data = (await response.json()) as { jobs?: GreenhouseJob[] };

  return (data.jobs ?? []).map((job) => normalizeGreenhouseJob(job, source));
}

async function fetchSmartRecruitersJobs(source: JobSource): Promise<IngestedJob[]> {
  const url = new URL(`https://api.smartrecruiters.com/v1/companies/${source.slug}/postings`);
  url.searchParams.set("limit", String(getSmartRecruitersListLimit()));

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(getTimeoutMs()),
  });

  if (!response.ok) return [];

  const data = (await response.json()) as { content?: SmartRecruitersJob[] };
  const detailCandidates = (data.content ?? []).slice(0, getSmartRecruitersDetailLimit());
  const detailResults = await Promise.allSettled(
    detailCandidates.map((job) => fetchSmartRecruitersJobDetail(job, source)),
  );

  return detailResults.flatMap((result) =>
    result.status === "fulfilled" && result.value ? [result.value] : [],
  );
}

async function fetchSmartRecruitersJobDetail(
  job: SmartRecruitersJob,
  source: JobSource,
): Promise<IngestedJob | null> {
  const detailUrl = job.ref || `https://api.smartrecruiters.com/v1/companies/${source.slug}/postings/${job.id}`;

  if (!job.id && !job.ref) return null;

  const response = await fetch(detailUrl, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(getTimeoutMs()),
  });

  if (!response.ok) return null;

  const detail = (await response.json()) as SmartRecruitersJob;

  return normalizeSmartRecruitersJob(detail, source);
}

function normalizeGreenhouseJob(job: GreenhouseJob, source: JobSource): IngestedJob {
  const description = stripHtml(job.content ?? "");
  const location = formatGreenhouseLocation(job);
  const tags = [
    "Company career page",
    source.name,
    ...((job.departments ?? []).map((department) => cleanText(department.name)).filter(Boolean)),
  ].slice(0, 6);

  return {
    id: `greenhouse-${source.slug}-${job.id ?? job.absolute_url ?? job.title}`,
    title: cleanText(job.title),
    company: source.name,
    location,
    description,
    descriptionSummary: summarizeDescription(description),
    applyUrl: cleanText(job.absolute_url),
    source: `${source.name} careers`,
    postedAt: formatDate(job.updated_at),
    tags,
  };
}

function normalizeSmartRecruitersJob(job: SmartRecruitersJob, source: JobSource): IngestedJob {
  const description = buildSmartRecruitersDescription(job);
  const location = formatSmartRecruitersLocation(job);
  const tags = [
    "Company career page",
    source.name,
    job.function?.label,
    job.experienceLevel?.label,
    job.typeOfEmployment?.label,
    job.location?.remote ? "Remote" : "",
    job.location?.hybrid ? "Hybrid" : "",
  ].map(cleanText).filter(Boolean).slice(0, 6);

  return {
    id: `smartrecruiters-${source.slug}-${job.id ?? job.postingUrl ?? job.name}`,
    title: cleanText(job.name),
    company: source.name,
    location,
    description,
    descriptionSummary: summarizeDescription(description),
    applyUrl: cleanText(job.postingUrl || job.applyUrl),
    source: `${source.name} careers`,
    postedAt: formatDate(job.releasedDate),
    tags,
  };
}

function buildSmartRecruitersDescription(job: SmartRecruitersJob) {
  const sections = job.jobAd?.sections ?? {};
  const sectionText = Object.values(sections)
    .flatMap((section) => [section?.title, section?.text])
    .map((value) => stripHtml(value ?? ""))
    .filter(Boolean)
    .join(" ");
  const customFields = (job.customField ?? [])
    .map((field) => [field.fieldLabel, field.valueLabel].map(cleanText).filter(Boolean).join(": "))
    .filter(Boolean)
    .join(" ");

  return cleanText([
    job.name,
    job.company?.name,
    job.location?.fullLocation,
    job.function?.label,
    job.experienceLevel?.label,
    job.typeOfEmployment?.label,
    customFields,
    sectionText,
  ].filter(Boolean).join(" "));
}

function filterJobs(jobs: IngestedJob[], query: string, location: string) {
  const queryMatch = getQueryMatch(query);
  const locationTerms = getLocationTerms(location);
  const titleTerms = getTitleRelevanceTerms(query);

  return jobs
    .filter((job) => job.title && job.applyUrl && job.description.length >= 80)
    .filter((job) => {
      const titleHaystack = [job.title, job.tags.join(" ")].join(" ").toLowerCase();
      const contentHaystack = [
        job.title,
        job.company,
        job.tags.join(" "),
        job.description,
      ].join(" ").toLowerCase();
      const locationHaystack = job.location.toLowerCase();

      const queryMatches = matchesQuery(contentHaystack, queryMatch);
      const locationMatches =
        locationTerms.length === 0 ||
        locationTerms.some((term) => locationHaystack.includes(term));
      const titleMatches =
        titleTerms.length === 0 ||
        titleTerms.some((term) => titleHaystack.includes(term));

      return queryMatches && locationMatches && titleMatches;
    });
}

function getQueryMatch(query: string) {
  const normalized = cleanText(query).toLowerCase();

  if (!normalized) return { phrase: "", terms: [] };
  if (/^data$/.test(normalized)) {
    return {
      phrase: "",
      terms: ["data", "analyst", "analytics", "machine learning", "business intelligence"],
    };
  }

  return {
    phrase: normalized,
    terms: normalized
    .split(/\s+/)
    .filter((term) => term.length > 2)
      .slice(0, 8),
  };
}

function matchesQuery(haystack: string, queryMatch: { phrase: string; terms: string[] }) {
  if (!queryMatch.phrase && queryMatch.terms.length === 0) return true;
  if (queryMatch.phrase && haystack.includes(queryMatch.phrase)) return true;

  if (queryMatch.phrase && queryMatch.terms.length > 1) {
    return queryMatch.terms.every((term) => haystack.includes(term));
  }

  return queryMatch.terms.some((term) => haystack.includes(term));
}

function getTitleRelevanceTerms(query: string) {
  const normalized = cleanText(query).toLowerCase();

  if (/^data$|^data jobs?$|^data roles?$/.test(normalized)) {
    return ["data", "analyst", "analytics", "scientist", "machine learning", "business intelligence"];
  }

  if (normalized.includes("data analyst")) return ["data", "analyst", "analytics"];
  if (normalized.includes("software engineer")) return ["software", "engineer", "developer"];
  if (normalized.includes("data engineer")) return ["data engineer", "engineer"];
  if (normalized.includes("data scientist")) return ["data scientist", "scientist", "machine learning"];
  if (normalized.includes("business analyst")) return ["business analyst", "analyst"];

  return [];
}

function getLocationTerms(location: string) {
  const normalized = cleanText(location).toLowerCase();

  if (!normalized || /anywhere|global|worldwide/.test(normalized)) return [];

  if (/australia|\bau\b|sydney|melbourne|brisbane|perth|adelaide|canberra/.test(normalized)) {
    return [
      "australia",
      "sydney",
      "melbourne",
      "brisbane",
      "perth",
      "adelaide",
      "canberra",
      "apac",
      "asia pacific",
    ];
  }

  return normalized
    .split(/[,\s]+/)
    .filter((term) => term.length > 2)
    .slice(0, 6);
}

function formatGreenhouseLocation(job: GreenhouseJob) {
  const locations = (job.offices ?? [])
    .flatMap((office) => [office.location, office.name])
    .map(cleanText)
    .filter(Boolean);

  return uniqueStrings(locations).join(", ") || "Not listed";
}

function formatSmartRecruitersLocation(job: SmartRecruitersJob) {
  const locationParts = [
    job.location?.fullLocation,
    job.location?.city,
    job.location?.country,
    job.location?.remote ? "Remote" : "",
    job.location?.hybrid ? "Hybrid" : "",
  ].map(cleanText).filter(Boolean);

  return uniqueStrings(locationParts).join(", ") || "Not listed";
}

function summarizeDescription(description: string) {
  const sentences = splitSentences(description);
  const work =
    findSentence(sentences, ["you will", "responsibilities", "build", "develop", "support", "work with"]) ??
    firstUsefulSentence(sentences);
  const requirements =
    findSentence(sentences, ["requirements", "experience", "skills", "proficient", "knowledge", "you have"]) ??
    "";
  const experience =
    findSentence(sentences, ["years", "senior", "junior", "graduate", "degree", "background"]) ??
    "";

  return {
    work: trimSummary(work || "Responsibilities are not clearly summarized in the source listing."),
    requirements: trimSummary(requirements || "Requirements are not clearly listed in the source summary."),
    experience: trimSummary(experience || "Experience level is not clearly stated in the source summary."),
  };
}

function splitSentences(value: string) {
  return value
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|\s+-\s+|•/g)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 35 && sentence.length < 260);
}

function findSentence(sentences: string[], patterns: string[]) {
  return sentences.find((sentence) => {
    const normalized = sentence.toLowerCase();

    return patterns.some((pattern) => normalized.includes(pattern));
  });
}

function firstUsefulSentence(sentences: string[]) {
  return sentences.find((sentence) => !/about us|benefits|equal opportunity|privacy/i.test(sentence)) ?? "";
}

function trimSummary(value: string) {
  const cleaned = cleanText(value);

  return cleaned.length > 180 ? `${cleaned.slice(0, 177).trim()}...` : cleaned;
}

function getMaxSources() {
  const value = Number(process.env.ROLEGUAGE_JOB_SOURCE_LIMIT ?? 6);

  return Number.isFinite(value) ? Math.min(Math.max(value, 1), 20) : 6;
}

function getMaxIngestedJobs() {
  const value = Number(process.env.ROLEGUAGE_MAX_INGESTED_JOBS ?? 80);

  return Number.isFinite(value) ? Math.min(Math.max(value, 12), 250) : 80;
}

function getSmartRecruitersListLimit() {
  const value = Number(process.env.ROLEGUAGE_SMARTRECRUITERS_LIST_LIMIT ?? 100);

  return Number.isFinite(value) ? Math.min(Math.max(value, 10), 100) : 100;
}

function getSmartRecruitersDetailLimit() {
  const value = Number(process.env.ROLEGUAGE_SMARTRECRUITERS_DETAIL_LIMIT ?? 30);

  return Number.isFinite(value) ? Math.min(Math.max(value, 5), 100) : 30;
}

function getTimeoutMs() {
  const value = Number(process.env.ROLEGUAGE_JOB_SOURCE_TIMEOUT_MS ?? defaultTimeoutMs);

  return Number.isFinite(value) ? Math.min(Math.max(value, 5000), 30000) : defaultTimeoutMs;
}

function formatDate(value: string | undefined) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-AU", {
    month: "short",
    day: "numeric",
  });
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();

  return values.filter((value) => {
    const key = value.toLowerCase();

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}
