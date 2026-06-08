import { NextRequest, NextResponse } from "next/server";
import { analyzeResumeAgainstJob } from "../analyze/route";

type NormalizedJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
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

    return NextResponse.json({
      query,
      location,
      sources: ["Himalayas", "Arbeitnow"],
      jobs: scoredJobs,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not fetch job recommendations right now. Try again or use the role matcher with a pasted job ad.",
      },
      { status: 502 },
    );
  }
}

async function fetchJobs(query: string, location: string) {
  const [himalayasJobs, arbeitnowJobs] = await Promise.allSettled([
    fetchHimalayasJobs(query, location),
    fetchArbeitnowJobs(query),
  ]);

  return [
    ...(himalayasJobs.status === "fulfilled" ? himalayasJobs.value : []),
    ...(arbeitnowJobs.status === "fulfilled" ? arbeitnowJobs.value : []),
  ];
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

    return {
      id: `himalayas-${job.guid ?? job.applicationLink ?? job.title}`,
      title: cleanText(job.title),
      company: cleanText(job.companyName),
      location: locationText || "Remote",
      description: stripHtml(`${job.excerpt ?? ""} ${job.description ?? ""}`),
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

  return (data.data ?? []).map((job) => ({
    id: `arbeitnow-${job.slug ?? job.url ?? job.title}`,
    title: cleanText(job.title),
    company: cleanText(job.company_name),
    location: [job.location, job.remote ? "Remote" : ""].filter(Boolean).join(" / ") || "Not listed",
    description: stripHtml(job.description ?? ""),
    applyUrl: cleanText(job.url),
    source: "Arbeitnow",
    postedAt: job.created_at ? formatDate(job.created_at * 1000) : "",
    tags: [...(job.tags ?? []), ...(job.job_types ?? [])].slice(0, 5),
  }));
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
    if (!job.title || !job.applyUrl || job.description.length < 80) return false;

    const key = `${job.title.toLowerCase()}-${job.company.toLowerCase()}-${job.applyUrl.toLowerCase()}`;
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
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
