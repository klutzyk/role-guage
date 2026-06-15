import { NextRequest, NextResponse } from "next/server";
import { analyzeResumeAgainstJob } from "../analyze/route";
import { generateJobBriefs, getAiModel } from "@/lib/ai";

type NormalizedJob = {
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

type HimalayasJob = {
  guid?: string;
  title?: string;
  companyName?: string;
  excerpt?: string;
  description?: string;
  applicationLink?: string;
  pubDate?: number | string;
  employmentType?: string;
  seniority?: string[] | string;
  categories?: string[];
  locationRestrictions?: Array<{ name?: string }>;
};

type ArbeitnowJob = {
  slug?: string;
  title?: string;
  company_name?: string;
  description?: string;
  url?: string;
  remote?: boolean;
  location?: string;
  created_at?: number;
  tags?: string[];
  job_types?: string[];
};

type JSearchJob = {
  job_id?: string;
  job_title?: string;
  employer_name?: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_location?: string;
  job_description?: string;
  job_apply_link?: string;
  job_google_link?: string;
  job_publisher?: string;
  job_posted_at_datetime_utc?: string;
  job_employment_type?: string;
  job_employment_types?: string[] | string;
  job_is_remote?: boolean;
  job_min_salary?: number | null;
  job_max_salary?: number | null;
  job_salary_period?: string | null;
  job_required_skills?: string[] | null;
};

type LinkedInRapidJob = {
  id?: string;
  linkedin_id?: string;
  title?: string;
  organization?: string;
  url?: string;
  external_apply_url?: string;
  date_posted?: string;
  employment_type?: string[] | string;
  seniority?: string;
  source?: string;
  source_domain?: string;
  directapply?: boolean;
  remote_derived?: boolean;
  salary_raw?: string;
  locations_derived?: string[] | string;
  cities_derived?: string[] | string;
  regions_derived?: string[] | string;
  countries_derived?: string[] | string;
  locations_raw?: Array<{
    address?: {
      addressLocality?: string;
      addressRegion?: string;
      addressCountry?: string;
    };
  }>;
  linkedin_org_description?: string;
  linkedin_org_industry?: string;
  linkedin_org_size?: string;
  linkedin_org_specialties?: string[] | string;
};

type RapidApiJobsProvider = "linkedin" | "jsearch";

const jobSearchCache = new Map<string, { expiresAt: number; jobs: NormalizedJob[] }>();
const jobSearchCacheTtlMs = 1000 * 60 * 30;
const defaultJSearchTimeoutMs = 22000;
const defaultLinkedInRapidTimeoutMs = 18000;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { resume?: string; query?: string; location?: string }
    | null;

  const resume = body?.resume?.trim() ?? "";
  const query = normalizeSearchQuery(body?.query ?? "");
  const location = body?.location?.trim() || "Australia";

  if (resume.length < 80) {
    return NextResponse.json(
      { error: "Add or upload a resume before finding matching jobs." },
      { status: 400 },
    );
  }

  try {
    const jobs = await fetchJobs(query, location);
    const dedupedJobs = dedupeJobs(jobs).slice(0, 35);

    if (isRapidApiConfigured() && dedupedJobs.length === 0) {
      const providerName = getRapidApiJobsProvider() === "jsearch" ? "JSearch" : "LinkedIn job search";

      return NextResponse.json(
        {
          error: `${providerName} returned no usable jobs for this search. Try a broader role title, a simpler location, or a query with fewer keywords.`,
        },
        { status: 404 },
      );
    }

    const scoredJobs = dedupedJobs
      .map((job) => {
        const analysis = analyzeResumeAgainstJob(resume, buildJobText(job));

        return {
          ...job,
          score: analysis.score,
          level: analysis.level,
          decision: analysis.decision,
          summary: analysis.summary,
          nextStep: analysis.nextStep,
          matchedSkills: analysis.matchedSkills.slice(0, 5),
          missingSkills: analysis.missingSkills.slice(0, 4),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
    let aiStatus = "disabled";

    try {
      const aiBriefs = await generateJobBriefs(scoredJobs.slice(0, 8));

      if (aiBriefs.size) {
        aiStatus = "generated";

        for (const job of scoredJobs) {
          const aiBrief = aiBriefs.get(job.id);

          if (aiBrief) {
            job.descriptionSummary = aiBrief;
          }
        }
      }
    } catch {
      aiStatus = "fallback";
    }

    return NextResponse.json({
      query,
      location,
      sources: Array.from(new Set(scoredJobs.map((job) => job.source))).sort(),
      aiStatus,
      aiModel: getAiModel(),
      jobs: scoredJobs,
    });
  } catch (caughtError) {
    return NextResponse.json(
      {
        error:
          caughtError instanceof Error
            ? caughtError.message
            : "Could not fetch job recommendations right now. Try again or use the role matcher with a pasted job ad.",
      },
      { status: 502 },
    );
  }
}

async function fetchJobs(query: string, location: string) {
  if (isRapidApiConfigured()) {
    return getRapidApiJobsProvider() === "jsearch"
      ? fetchJSearchJobs(query, location)
      : fetchLinkedInRapidJobs(query, location);
  }

  const [himalayasJobs, arbeitnowJobs] = await Promise.allSettled([
    fetchHimalayasJobs(query, location),
    fetchArbeitnowJobs(query),
  ]);

  return [
    ...(himalayasJobs.status === "fulfilled" ? himalayasJobs.value : []),
    ...(arbeitnowJobs.status === "fulfilled" ? arbeitnowJobs.value : []),
  ];
}

function isRapidApiConfigured() {
  return Boolean(process.env.RAPIDAPI_KEY);
}

function getRapidApiJobsProvider(): RapidApiJobsProvider {
  const provider = (process.env.RAPIDAPI_JOBS_PROVIDER ?? "linkedin").toLowerCase();

  return provider === "jsearch" ? "jsearch" : "linkedin";
}

function getLinkedInRapidTimeoutMs() {
  const timeout = Number(process.env.RAPIDAPI_LINKEDIN_JOBS_TIMEOUT_MS ?? defaultLinkedInRapidTimeoutMs);

  if (!Number.isFinite(timeout)) return defaultLinkedInRapidTimeoutMs;

  return Math.min(Math.max(timeout, 8000), 30000);
}

async function fetchLinkedInRapidJobs(query: string, location: string): Promise<NormalizedJob[]> {
  const endpoint = process.env.RAPIDAPI_LINKEDIN_JOBS_ENDPOINT || "active-jb-24h";
  const cacheKey = `linkedin-rapid:${endpoint}:${query.toLowerCase()}:${location.toLowerCase()}`;
  const cached = jobSearchCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.jobs;
  }

  const host = process.env.RAPIDAPI_LINKEDIN_JOBS_HOST || "linkedin-job-search-api.p.rapidapi.com";
  const titleFilters = buildLinkedInRapidTitleFilters(query);
  let jobs: NormalizedJob[] = [];

  for (const titleFilter of titleFilters) {
    const url = new URL(`https://${host}/${endpoint}`);
    url.searchParams.set("offset", "0");
    url.searchParams.set("title_filter", titleFilter);
    url.searchParams.set("location_filter", location);

    let response: Response;

    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-rapidapi-host": host,
          "x-rapidapi-key": process.env.RAPIDAPI_KEY ?? "",
        },
        signal: AbortSignal.timeout(getLinkedInRapidTimeoutMs()),
      });
    } catch (caughtError) {
      if (caughtError instanceof Error && caughtError.name === "TimeoutError") {
        throw new Error("LinkedIn job search took too long to respond. Try a narrower title or location.");
      }

      throw caughtError;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("LinkedIn RapidAPI job fetch failed", response.status, errorText);

      if (response.status === 401 || response.status === 403) {
        throw new Error("LinkedIn job search is configured, but this RapidAPI key is not subscribed to the LinkedIn Job Search API.");
      }

      if (response.status === 429) {
        throw new Error("LinkedIn job search rate limit reached. Wait for the RapidAPI quota window to reset, or upgrade the plan.");
      }

      throw new Error("LinkedIn job search could not fetch jobs right now. Try again shortly.");
    }

    const data = (await response.json()) as unknown;
    const rawJobs = extractLinkedInRapidJobs(data);

    jobs = (rawJobs ?? []).map(normalizeLinkedInRapidJob);

    if (jobs.length > 0) {
      break;
    }
  }

  jobSearchCache.set(cacheKey, {
    expiresAt: Date.now() + jobSearchCacheTtlMs,
    jobs,
  });

  return jobs;
}

function buildLinkedInRapidTitleFilters(query: string) {
  const cleaned = cleanText(query).toLowerCase();
  const withoutSkills = stripSearchSkillTerms(cleaned);
  const inferredRole = inferRoleTitle(cleaned);

  return uniqueStrings([inferredRole, withoutSkills, cleaned])
    .filter((title) => title.length >= 2)
    .slice(0, 3);
}

function stripSearchSkillTerms(query: string) {
  const skillTerms = [
    "python",
    "sql",
    "postgresql",
    "mysql",
    "react",
    "typescript",
    "javascript",
    "node",
    "nodejs",
    "aws",
    "azure",
    "gcp",
    "docker",
    "kubernetes",
    "machine learning",
    "ml",
    "ai",
    "analytics",
    "dashboard",
    "dashboards",
    "power bi",
    "tableau",
    "excel",
  ];

  let stripped = query;

  for (const term of skillTerms) {
    stripped = stripped.replace(new RegExp(`\\b${escapeRegExp(term)}\\b`, "gi"), " ");
  }

  return cleanText(stripped.replace(/\b(jobs?|roles?|position|positions|in)\b/gi, " "));
}

function inferRoleTitle(query: string) {
  const rolePhrases = [
    "machine learning engineer",
    "software engineer",
    "data engineer",
    "data scientist",
    "data analyst",
    "business analyst",
    "product analyst",
    "frontend developer",
    "front end developer",
    "backend developer",
    "back end developer",
    "full stack developer",
    "web developer",
    "cloud engineer",
    "devops engineer",
    "systems analyst",
    "reporting analyst",
  ];

  return rolePhrases.find((role) => query.includes(role)) ?? "";
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();

  return values
    .map(cleanText)
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getJSearchTimeoutMs() {
  const timeout = Number(process.env.RAPIDAPI_JSEARCH_TIMEOUT_MS ?? defaultJSearchTimeoutMs);

  if (!Number.isFinite(timeout)) return defaultJSearchTimeoutMs;

  return Math.min(Math.max(timeout, 8000), 30000);
}

async function fetchJSearchJobs(query: string, location: string): Promise<NormalizedJob[]> {
  const cacheKey = `jsearch-v2:${query.toLowerCase()}:${location.toLowerCase()}:date_posted=all`;
  const cached = jobSearchCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.jobs;
  }

  const host = process.env.RAPIDAPI_JSEARCH_HOST || "jsearch.p.rapidapi.com";
  const url = new URL(`https://${host}/search-v2`);
  const country = inferJSearchCountry(location);
  const searchQuery = buildJSearchQuery(query, location);

  url.searchParams.set("query", searchQuery);
  url.searchParams.set("num_pages", "1");
  url.searchParams.set("country", country);
  url.searchParams.set("date_posted", "all");

  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-rapidapi-host": host,
        "x-rapidapi-key": process.env.RAPIDAPI_KEY ?? "",
      },
      signal: AbortSignal.timeout(getJSearchTimeoutMs()),
    });
  } catch (caughtError) {
    if (caughtError instanceof Error && caughtError.name === "TimeoutError") {
      throw new Error("JSearch took too long to respond. Try again, or narrow the search with a specific title, city, and publisher such as \"software engineer Sydney via LinkedIn\".");
    }

    throw caughtError;
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("JSearch job fetch failed", response.status, errorText);

    if (response.status === 401 || response.status === 403) {
      throw new Error("JSearch is configured, but this RapidAPI key is not subscribed to the JSearch API. Subscribe to JSearch in RapidAPI, rotate the exposed key, update .env.local, then restart the dev server.");
    }

    if (response.status === 429) {
      throw new Error("JSearch rate limit reached. Wait for the RapidAPI quota window to reset, or upgrade the plan.");
    }

    throw new Error("JSearch could not fetch jobs right now. Try again shortly.");
  }

  const data = (await response.json()) as {
    data?: JSearchJob[] | { jobs?: JSearchJob[] };
  };
  const rawJobs = Array.isArray(data.data) ? data.data : data.data?.jobs;

  if (!Array.isArray(rawJobs)) {
    console.error("JSearch returned an unexpected response shape", Object.keys(data));
  }

  const jobs = (rawJobs ?? []).map(normalizeJSearchJob);

  jobSearchCache.set(cacheKey, {
    expiresAt: Date.now() + jobSearchCacheTtlMs,
    jobs,
  });

  return jobs;
}

function normalizeJSearchJob(job: JSearchJob): NormalizedJob {
  const description = stripHtml(job.job_description ?? "");
  const publisher = cleanText(job.job_publisher) || "JSearch";
  const salary = formatJSearchSalary(job.job_min_salary, job.job_max_salary, job.job_salary_period);

  return {
    id: `jsearch-${job.job_id ?? job.job_apply_link ?? job.job_title}`,
    title: cleanText(job.job_title),
    company: cleanText(job.employer_name),
    location: cleanText(job.job_location) || [job.job_city, job.job_state, job.job_country].filter(Boolean).join(", ") || "Not listed",
    description,
    descriptionSummary: summarizeJobDescription(description),
    applyUrl: cleanText(job.job_apply_link || job.job_google_link),
    source: publisher,
    postedAt: formatDate(job.job_posted_at_datetime_utc),
    tags: [
      publisher !== "JSearch" ? `via ${publisher}` : "",
      job.job_is_remote ? "Remote" : "",
      job.job_employment_type,
      ...normalizeStringList(job.job_employment_types),
      ...(job.job_required_skills ?? []),
      salary,
    ].filter(Boolean).map(String).slice(0, 6),
  };
}

function extractLinkedInRapidJobs(data: unknown) {
  if (Array.isArray(data)) return data as LinkedInRapidJob[];

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;

    for (const key of ["data", "jobs", "results"]) {
      const value = record[key];

      if (Array.isArray(value)) return value as LinkedInRapidJob[];
    }
  }

  return [];
}

function normalizeLinkedInRapidJob(job: LinkedInRapidJob): NormalizedJob {
  const location = formatLinkedInRapidLocation(job);
  const tags = [
    "LinkedIn",
    job.remote_derived ? "Remote" : "",
    ...normalizeStringList(job.employment_type).map(formatConstantLabel),
    formatConstantLabel(job.seniority),
    job.linkedin_org_industry,
    job.salary_raw,
  ].filter(Boolean).map(String).slice(0, 6);
  const description = buildLinkedInRapidDescription(job, location, tags);

  return {
    id: `linkedin-${job.linkedin_id ?? job.id ?? job.url ?? job.title}`,
    title: cleanText(job.title),
    company: cleanText(job.organization),
    location,
    description,
    descriptionSummary: summarizeJobDescription(description),
    applyUrl: cleanText(job.external_apply_url || job.url),
    source: "LinkedIn",
    postedAt: formatDate(job.date_posted),
    tags,
  };
}

function buildLinkedInRapidDescription(
  job: LinkedInRapidJob,
  location: string,
  tags: string[],
) {
  return [
    `${cleanText(job.title)} role at ${cleanText(job.organization)}.`,
    location ? `Location: ${location}.` : "",
    tags.length ? `Signals: ${tags.join(", ")}.` : "",
    job.linkedin_org_description ? `Company description: ${cleanText(job.linkedin_org_description)}` : "",
    job.linkedin_org_specialties
      ? `Company specialties: ${normalizeStringList(job.linkedin_org_specialties).join(", ")}.`
      : "",
    job.directapply ? "Direct apply is available." : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function formatLinkedInRapidLocation(job: LinkedInRapidJob) {
  const primaryLocations = normalizeStringList(job.locations_derived).filter(Boolean);

  if (primaryLocations.length) {
    return dedupeLocationParts(primaryLocations).join(", ");
  }

  const derived = [
    ...normalizeStringList(job.locations_derived),
    ...normalizeStringList(job.cities_derived),
    ...normalizeStringList(job.regions_derived),
    ...normalizeStringList(job.countries_derived),
  ].filter(isNonEmptyString);

  if (derived.length) {
    return dedupeLocationParts(derived).join(", ");
  }

  const raw = (job.locations_raw?.flatMap((location) => {
    const address = location.address;

    return [
      address?.addressLocality,
      address?.addressRegion,
      address?.addressCountry,
    ].filter(isNonEmptyString);
  }) ?? []);

  return raw.length ? dedupeLocationParts(raw).join(", ") : "Not listed";
}

async function fetchHimalayasJobs(query: string, location: string): Promise<NormalizedJob[]> {
  const url = new URL("https://himalayas.app/jobs/api/search");
  url.searchParams.set("q", query);
  url.searchParams.set("sort", "recent");

  if (location && !/remote|worldwide/i.test(location)) {
    url.searchParams.set("country", location);
  }

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) return [];

  const data = (await response.json()) as { jobs?: HimalayasJob[] };

  return (data.jobs ?? []).map((job) => {
    const locationText = formatHimalayasLocation(job.locationRestrictions);
    const seniority = Array.isArray(job.seniority) ? job.seniority : job.seniority ? [job.seniority] : [];
    const description = stripHtml(`${job.excerpt ?? ""} ${job.description ?? ""}`);

    return {
      id: `himalayas-${job.guid ?? job.applicationLink ?? job.title}`,
      title: cleanText(job.title),
      company: cleanText(job.companyName),
      location: locationText || "Remote",
      description,
      descriptionSummary: summarizeJobDescription(description),
      applyUrl: cleanText(job.applicationLink),
      source: "Himalayas",
      postedAt: formatDate(job.pubDate),
      tags: [job.employmentType, ...seniority, ...(job.categories ?? [])].filter(Boolean).map(String).slice(0, 5),
    };
  });
}

async function fetchArbeitnowJobs(query: string): Promise<NormalizedJob[]> {
  const url = new URL("https://www.arbeitnow.com/api/job-board-api");
  url.searchParams.set("search", query);

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) return [];

  const data = (await response.json()) as { data?: ArbeitnowJob[] };

  return (data.data ?? []).map((job) => {
    const description = stripHtml(job.description ?? "");

    return {
      id: `arbeitnow-${job.slug ?? job.url ?? job.title}`,
      title: cleanText(job.title),
      company: cleanText(job.company_name),
      location: [job.location, job.remote ? "Remote" : ""].filter(Boolean).join(" / ") || "Not listed",
      description,
      descriptionSummary: summarizeJobDescription(description),
      applyUrl: cleanText(job.url),
      source: "Arbeitnow",
      postedAt: job.created_at ? formatDate(job.created_at * 1000) : "",
      tags: [...(job.tags ?? []), ...(job.job_types ?? [])].slice(0, 5),
    };
  });
}

function buildJobText(job: NormalizedJob) {
  return [
    job.title,
    job.company,
    job.location,
    job.tags.join(" "),
    job.description,
  ].join("\n");
}

function normalizeSearchQuery(query: string) {
  const cleaned = cleanText(query);

  return cleaned.length >= 2 ? cleaned.slice(0, 120) : "data analyst python sql";
}

function dedupeJobs(jobs: NormalizedJob[]) {
  const seen = new Set<string>();

  return jobs.filter((job) => {
    if (!job.title || !job.applyUrl) return false;
    if (job.source !== "LinkedIn" && job.description.length < 80) return false;

    const key =
      job.source === "LinkedIn"
        ? `${job.source.toLowerCase()}-${job.title.toLowerCase()}-${job.company.toLowerCase()}-${job.location.toLowerCase()}`
        : `${job.title.toLowerCase()}-${job.company.toLowerCase()}-${job.applyUrl.toLowerCase()}`;
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function summarizeJobDescription(description: string) {
  const sentences = splitSentences(description);
  const work =
    findSentence(sentences, [
      "responsibilities",
      "you will",
      "you'll",
      "role",
      "build",
      "develop",
      "manage",
      "support",
      "work on",
      "mission",
    ]) ?? firstUsefulSentence(sentences);
  const requirements =
    findSentence(sentences, [
      "requirements",
      "required",
      "must have",
      "you have",
      "skills",
      "experience with",
      "proficient",
      "knowledge",
    ]) ?? "";
  const experience =
    findSentence(sentences, [
      "years",
      "senior",
      "junior",
      "graduate",
      "entry",
      "degree",
      "bachelor",
      "master",
      "qualification",
      "background",
    ]) ?? "";

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

function formatHimalayasLocation(locations: HimalayasJob["locationRestrictions"]) {
  if (!locations?.length) return "Worldwide remote";
  return locations.map((location) => location.name).filter(Boolean).join(", ");
}

function formatDate(value: number | string | undefined) {
  if (!value) return "";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-AU", {
    month: "short",
    day: "numeric",
  });
}

function buildJSearchQuery(query: string, location: string) {
  const cleanedQuery = cleanText(query);
  const cleanedLocation = cleanText(location);

  if (!cleanedLocation || /remote|worldwide/i.test(cleanedLocation)) {
    return cleanedQuery;
  }

  if (cleanedQuery.toLowerCase().includes(cleanedLocation.toLowerCase())) {
    return cleanedQuery;
  }

  return `${cleanedQuery} in ${cleanedLocation}`;
}

function inferJSearchCountry(location: string) {
  const normalized = location.toLowerCase();

  if (/new zealand|\bnz\b/.test(normalized)) return "nz";
  if (/united kingdom|\buk\b|england|scotland|wales|london/.test(normalized)) return "gb";
  if (/canada|toronto|vancouver/.test(normalized)) return "ca";
  if (
    /united states|\busa\b|\bus\b|new york|san francisco|austin|seattle|chicago|los angeles|boston|denver|miami|dallas|atlanta|\bil\b|\bny\b|\bca\b/.test(
      normalized,
    )
  ) {
    return "us";
  }

  return "au";
}

function formatJSearchSalary(
  min: number | null | undefined,
  max: number | null | undefined,
  period: string | null | undefined,
) {
  if (!min && !max) return "";

  const formatter = new Intl.NumberFormat("en-AU", {
    maximumFractionDigits: 0,
    notation: "compact",
  });
  const periodLabel = period ? `/${period.toLowerCase()}` : "";

  if (min && max) return `$${formatter.format(min)}-${formatter.format(max)}${periodLabel}`;
  if (min) return `From $${formatter.format(min)}${periodLabel}`;
  return `Up to $${formatter.format(max ?? 0)}${periodLabel}`;
}

function normalizeStringList(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) return value;
  if (!value) return [];

  return [value];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function dedupeLocationParts(parts: string[]) {
  const normalizedParts = parts.map(cleanText).filter(Boolean);

  return normalizedParts.filter((part, index) => {
    const normalized = part.toLowerCase();

    return normalizedParts.findIndex((item) => item.toLowerCase() === normalized) === index;
  });
}

function formatConstantLabel(value: string | null | undefined) {
  if (!value) return "";

  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function stripHtml(value: string) {
  return value
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
