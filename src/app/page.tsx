"use client";

import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  Clipboard,
  Download,
  FileText,
  Gauge,
  ListChecks,
  Link,
  Loader2,
  Network,
  Plus,
  Radar,
  SearchCheck,
  ShieldCheck,
  Target,
  Upload,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ChangeEvent, FormEvent, useMemo, useState, useSyncExternalStore } from "react";

type AnalysisResult = {
  score: number;
  level: string;
  decision: "Apply" | "Tailor" | "Build" | "Skip";
  nextStep: string;
  timeToApply: string;
  confidence: string;
  matchedSkills: string[];
  missingSkills: string[];
  roleSignals: string[];
  scoreBreakdown: Array<{
    label: string;
    value: string;
    detail: string;
  }>;
  skillGroups: {
    coreMatched: string[];
    coreMissing: string[];
    niceToHaveMatched: string[];
  };
  bullets: string[];
  keywordPlan: {
    keep: string[];
    add: string[];
    headline: string;
  };
  resumeBullets: string[];
  interviewPrep: string[];
  outreachMessage: string;
  atsNotes: string[];
  summary: string;
};

type ImportedJob = {
  title: string;
  company: string;
  location: string;
  description: string;
  sourceUrl: string;
};

type DiscoveredJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  applyUrl: string;
  source: string;
  postedAt: string;
  tags: string[];
  score: number;
  level: string;
  decision: AnalysisResult["decision"];
  summary: string;
  nextStep: string;
  matchedSkills: string[];
  missingSkills: string[];
};

type InputMode = "import" | "paste";
type ApplicationStatus = "Saved" | "Applied" | "Interview" | "Rejected" | "Offer";
type JobSort = "fit" | "recent";
type JobDecisionFilter = "all" | AnalysisResult["decision"];

type JobMeta = {
  title: string;
  company: string;
  location: string;
  sourceUrl: string;
};

type TrackedApplication = JobMeta & {
  id: string;
  score: number;
  level: string;
  decision: AnalysisResult["decision"];
  nextStep: string;
  timeToApply: string;
  status: ApplicationStatus;
  notes: string;
  savedAt: string;
  matchedSkills: string[];
  missingSkills: string[];
  roleSignals: string[];
  summary: string;
};

const sampleResume = `Software Engineer with 4 years of experience building web applications, REST APIs, dashboards, and data pipelines. Skilled in Python, TypeScript, React, PostgreSQL, machine learning, data analysis, cloud deployment, and stakeholder communication. Completed a Master of Data Science in Australia with projects in NLP, predictive modelling, and business analytics.`;

const sampleJob = `We are hiring a Data Analyst / AI Product Engineer in Sydney. The role requires Python, SQL, dashboards, machine learning, stakeholder communication, experimentation, API integration, and experience turning messy business data into actionable insights. Knowledge of React, cloud platforms, and LLM tools is a strong advantage.`;

const plans = [
  {
    name: "Starter",
    price: "$0",
    copy: "For checking a few roles before you spend time applying.",
    items: ["3 role checks", "Fit score", "Evidence gaps", "Manual paste workflow"],
    featured: false,
  },
  {
    name: "Active Search",
    price: "$19",
    copy: "For jobseekers who want every application to be targeted.",
    items: ["Unlimited role checks", "Resume PDF import", "Job URL import", "Application tracker", "Exportable fit reports"],
    featured: true,
  },
  {
    name: "Career Sprint",
    price: "$99",
    copy: "For a deeper job-search reset with structured review.",
    items: ["Profile audit", "Target role strategy", "Portfolio project plan", "Resume review notes"],
    featured: false,
  },
];

const jobTools: Array<[string, string, LucideIcon]> = [
  ["Resume job match", "Upload a resume and compare it with a real job ad.", Gauge],
  ["Job URL import", "Pull job text from public company and ATS pages.", Link],
  ["Evidence gap finder", "See missing proof before applying.", Target],
  ["Resume bullet guidance", "Turn matched evidence into targeted bullet ideas.", FileText],
  ["Interview prep", "Prepare stories for matched skills and visible gaps.", Users],
  ["Application tracker", "Save the decision, status, notes, and next step.", BriefcaseBusiness],
];

const workflowSteps: Array<[string, string, LucideIcon]> = [
  ["Upload once", "Keep a reusable resume profile in your browser and reuse it across role checks.", Upload],
  ["Import a role", "Paste a job URL or drop in the job description when the site blocks import.", SearchCheck],
  ["Check the fit", "Get a clear Apply, Tailor, Build, or Skip recommendation with the evidence behind it.", Gauge],
  ["Apply with a plan", "Use the generated kit to tighten bullets, prep interviews, and track next actions.", ListChecks],
];

const trustItems = [
  "No fake experience suggestions",
  "Manual review before anything is used",
  "Local-first saved profile and tracker",
  "Copy, save, or export every report",
];

const faqs: Array<[string, string]> = [
  [
    "Is this just ChatGPT with a nicer screen?",
    "No. RoleGuage is built around a repeatable job-search workflow: import a role, score fit, expose evidence gaps, generate an application kit, and save the decision to a tracker.",
  ],
  [
    "Does it rewrite my resume with fake skills?",
    "No. It highlights what your resume already supports and separates missing evidence from matched evidence.",
  ],
  [
    "Can it import jobs from LinkedIn or SEEK?",
    "Some large job boards block automated extraction. RoleGuage keeps URL import for public pages and a copy-text fallback for blocked job boards.",
  ],
  [
    "Where is my resume stored?",
    "In this MVP, saved profiles and applications stay in your browser localStorage. A production version should add accounts, encrypted storage, and delete controls.",
  ],
];

const emptyJobMeta: JobMeta = {
  title: "",
  company: "",
  location: "",
  sourceUrl: "",
};

const trackerStorageKey = "roleguage.applications.v1";
const legacyTrackerStorageKey = "applypilot.applications.v1";
const trackerChangeEvent = "roleguage-applications-changed";
const resumeProfileStorageKey = "roleguage.resume-profile.v1";
const legacyResumeProfileStorageKey = "applypilot.resume-profile.v1";
const applicationStatuses: ApplicationStatus[] = ["Saved", "Applied", "Interview", "Rejected", "Offer"];
let cachedTrackerRaw = "";
let cachedTrackerApplications: TrackedApplication[] = [];
const emptyTrackerApplications: TrackedApplication[] = [];

export default function Home() {
  const [resume, setResume] = useState(sampleResume);
  const [job, setJob] = useState(sampleJob);
  const [jobUrl, setJobUrl] = useState("");
  const [jobMeta, setJobMeta] = useState<JobMeta>({
    title: "Data Analyst / AI Product Engineer",
    company: "Sample company",
    location: "Sydney",
    sourceUrl: "",
  });
  const [inputMode, setInputMode] = useState<InputMode>("import");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const applications = useSyncExternalStore(
    subscribeToTracker,
    getTrackerSnapshot,
    getTrackerServerSnapshot,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isImportingJob, setIsImportingJob] = useState(false);
  const [isExtractingResume, setIsExtractingResume] = useState(false);
  const [error, setError] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [jobSearchQuery, setJobSearchQuery] = useState("data analyst python sql");
  const [jobSearchLocation, setJobSearchLocation] = useState("Australia");
  const [discoveredJobs, setDiscoveredJobs] = useState<DiscoveredJob[]>([]);
  const [isDiscoveringJobs, setIsDiscoveringJobs] = useState(false);
  const [jobDiscoveryError, setJobDiscoveryError] = useState("");
  const [jobSourceFilter, setJobSourceFilter] = useState("all");
  const [jobDecisionFilter, setJobDecisionFilter] = useState<JobDecisionFilter>("all");
  const [jobRemoteOnly, setJobRemoteOnly] = useState(false);
  const [jobMinScore, setJobMinScore] = useState(60);
  const [jobSort, setJobSort] = useState<JobSort>("fit");

  const canAnalyze = useMemo(
    () => resume.trim().length > 80 && job.trim().length > 80,
    [resume, job],
  );
  const hasGeneratedReport = Boolean(result);
  const jobSources = useMemo(
    () => Array.from(new Set(discoveredJobs.map((jobMatch) => jobMatch.source))).sort(),
    [discoveredJobs],
  );
  const filteredDiscoveredJobs = useMemo(() => {
    return discoveredJobs
      .filter((jobMatch) => jobMatch.score >= jobMinScore)
      .filter((jobMatch) => jobSourceFilter === "all" || jobMatch.source === jobSourceFilter)
      .filter((jobMatch) => jobDecisionFilter === "all" || jobMatch.decision === jobDecisionFilter)
      .filter((jobMatch) => !jobRemoteOnly || /remote/i.test(`${jobMatch.location} ${jobMatch.tags.join(" ")}`))
      .sort((a, b) => {
        if (jobSort === "recent") {
          return parsePostedDate(b.postedAt) - parsePostedDate(a.postedAt) || b.score - a.score;
        }

        return b.score - a.score;
      });
  }, [discoveredJobs, jobDecisionFilter, jobMinScore, jobRemoteOnly, jobSort, jobSourceFilter]);

  async function analyzeRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAnalysis(resume, job);
  }

  async function runAnalysis(resumeText: string, jobText: string) {
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume: resumeText, job: jobText }),
      });

      if (!response.ok) {
        throw new Error("Analysis failed");
      }

      const data = (await response.json()) as AnalysisResult;
      setResult(data);
    } catch {
      setError("RoleGuage could not analyze this role yet. Try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function importJobFromUrl() {
    setError("");
    setImportMessage("");
    setIsImportingJob(true);

    try {
      const response = await fetch("/api/import-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: jobUrl }),
      });
      const data = (await response.json()) as Partial<ImportedJob> & { error?: string };

      if (!response.ok || !data.description) {
        throw new Error(data.error ?? "Could not import this job URL.");
      }

      setJob(data.description);
      setJobMeta({
        title: cleanImportedTitle(data.title ?? ""),
        company: data.company ?? "",
        location: data.location ?? "",
        sourceUrl: data.sourceUrl ?? jobUrl,
      });
      setImportMessage("Job description imported. Review it, then generate the fit report.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not import this job URL. Paste the job description manually.",
      );
    } finally {
      setIsImportingJob(false);
    }
  }

  async function extractResumeFromPdf(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setError("");
    setImportMessage("");
    setIsExtractingResume(true);

    try {
      const formData = new FormData();
      formData.append("resume", file);

      const response = await fetch("/api/extract-resume", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as { text?: string; filename?: string; error?: string };

      if (!response.ok || !data.text) {
        throw new Error(data.error ?? "Could not extract this PDF.");
      }

      setResume(data.text);
      setImportMessage(`Extracted resume text from ${data.filename ?? file.name}. Review it before matching.`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not extract this PDF. Paste your resume manually.",
      );
    } finally {
      setIsExtractingResume(false);
    }
  }

  async function discoverMatchingJobs(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setJobDiscoveryError("");
    setIsDiscoveringJobs(true);

    try {
      const response = await fetch("/api/discover-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume,
          query: jobSearchQuery,
          location: jobSearchLocation,
        }),
      });
      const data = (await response.json()) as { jobs?: DiscoveredJob[]; error?: string };

      if (!response.ok || !data.jobs) {
        throw new Error(data.error ?? "Could not find matching jobs right now.");
      }

      setDiscoveredJobs(data.jobs);
    } catch (caughtError) {
      setJobDiscoveryError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not find matching jobs right now.",
      );
    } finally {
      setIsDiscoveringJobs(false);
    }
  }

  async function loadDiscoveredJob(jobToLoad: DiscoveredJob) {
    const fullJobText = buildDiscoveredJobText(jobToLoad);

    setJob(fullJobText);
    setJobMeta({
      title: jobToLoad.title,
      company: jobToLoad.company,
      location: jobToLoad.location,
      sourceUrl: jobToLoad.applyUrl,
    });
    setInputMode("paste");
    setImportMessage("Loaded this job into the matcher and generated the fit report.");
    setError("");
    document.getElementById("analyze")?.scrollIntoView({ behavior: "smooth", block: "start" });
    await runAnalysis(resume, fullJobText);
  }

  function saveCurrentApplication() {
    if (!result) {
      setError("Generate a fit report before saving this application.");
      return;
    }

    const inferredMeta = inferJobMeta(job, jobMeta);
    const application: TrackedApplication = {
      id: crypto.randomUUID(),
      ...inferredMeta,
      score: result.score,
      level: result.level,
      decision: result.decision,
      nextStep: result.nextStep,
      timeToApply: result.timeToApply,
      status: "Saved",
      notes: "",
      savedAt: new Date().toISOString(),
      matchedSkills: result.matchedSkills,
      missingSkills: result.missingSkills,
      roleSignals: result.roleSignals,
      summary: result.summary,
    };

    writeTrackerApplications((current) => [application, ...current]);
    setImportMessage("Saved to application tracker.");
  }

  function updateApplicationStatus(id: string, status: ApplicationStatus) {
    writeTrackerApplications((current) =>
      current.map((application) =>
        application.id === id ? { ...application, status } : application,
      ),
    );
  }

  function updateApplicationNotes(id: string, notes: string) {
    writeTrackerApplications((current) =>
      current.map((application) =>
        application.id === id ? { ...application, notes } : application,
      ),
    );
  }

  function removeApplication(id: string) {
    writeTrackerApplications((current) => current.filter((application) => application.id !== id));
  }

  function saveResumeProfile() {
    if (resume.trim().length < 80) {
      setError("Add your resume details before saving a profile.");
      return;
    }

    window.localStorage.setItem(resumeProfileStorageKey, resume);
    setError("");
    setImportMessage("Resume profile saved for this browser.");
  }

  function useSavedResumeProfile() {
    const savedResume =
      window.localStorage.getItem(resumeProfileStorageKey) ??
      window.localStorage.getItem(legacyResumeProfileStorageKey);

    if (!savedResume) {
      setError("No saved resume profile found in this browser yet.");
      return;
    }

    setResume(savedResume);
    setError("");
    setImportMessage("Loaded your saved resume profile.");
  }

  async function copyReport() {
    if (!result) {
      setError("Generate a fit report before copying it.");
      return;
    }

    await navigator.clipboard.writeText(buildReportText(result, inferJobMeta(job, jobMeta)));
    setImportMessage("Fit report copied to clipboard.");
  }

  function downloadReport() {
    if (!result) {
      setError("Generate a fit report before exporting it.");
      return;
    }

    const meta = inferJobMeta(job, jobMeta);
    const blob = new Blob([buildReportText(result, meta)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `${slugify(meta.title || "roleguage-report")}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    setImportMessage("Fit report downloaded.");
  }

  const activeResult =
    result ??
    ({
      score: 78,
      level: "Strong match",
      decision: "Apply",
      nextStep: "Tighten the top 2 truthful resume bullets, then apply.",
      timeToApply: "30-45 min",
      confidence: "Good",
      matchedSkills: ["Python", "SQL", "React", "PostgreSQL", "Machine learning"],
      missingSkills: ["Experimentation", "LLM tools", "Cloud platforms"],
      roleSignals: ["Sydney", "AI product", "Stakeholder-facing", "Dashboards"],
      scoreBreakdown: [
        {
          label: "Matched job skills",
          value: "78%",
          detail: "5 of 8 detected job skills matched",
        },
        {
          label: "Resume matches",
          value: "+12",
          detail: "8 relevant resume skills detected",
        },
        {
          label: "Required gaps",
          value: "0",
          detail: "No detected must-have gaps",
        },
      ],
      skillGroups: {
        coreMatched: ["Python", "SQL", "React", "Machine learning"],
        coreMissing: ["Experimentation"],
        niceToHaveMatched: ["PostgreSQL"],
      },
      bullets: [
        "Built data-backed web applications using Python, TypeScript, React, and PostgreSQL.",
        "Created dashboards and analytics workflows that convert messy business data into clear decisions.",
        "Move NLP and predictive modelling projects higher when the role asks for applied data science.",
      ],
      keywordPlan: {
        keep: ["Python", "SQL", "React", "Machine learning"],
        add: ["Experimentation", "LLM tools", "Cloud platforms"],
        headline: "Python + SQL + React",
      },
      resumeBullets: [
        "Adapt this only if true: built data-backed web applications connecting Python, SQL, and React workflows to measurable outcomes.",
        "Created dashboards and analytics workflows that made product decisions clearer.",
        "If you have done work with experimentation, add one clear proof point; otherwise keep it as a gap to build.",
      ],
      interviewPrep: [
        "Prepare a 60-second story about a dashboard or data product you shipped.",
        "Have a direct answer for whether you have experimentation evidence, and how you are building it if not.",
        "Explain why Sydney data-product roles fit your current job search direction.",
      ],
      outreachMessage:
        "Hi, I found this role and noticed a strong match around Python and SQL. I am also strengthening my experimentation evidence. I would appreciate any guidance on what the team values most for candidates at this stage.",
      atsNotes: [
        "Mirror the exact wording from the job ad where it is truthful.",
        "Keep your resume format simple: standard headings, no tables, no graphics-heavy layouts.",
        "Add a truthful mention of experimentation if you have evidence for it.",
      ],
      summary:
        "Your profile is credible for this role. Lead with the strongest matched skills and tighten the visible gaps before applying.",
    } satisfies AnalysisResult);

  return (
    <main className="min-h-screen bg-[#F8FBFF] text-[#212529]">
      <header className="border-b border-[#DDE8F6] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-8 lg:px-10">
          <a href="#" className="flex items-center gap-2 font-bold text-[#043873]">
            <span className="grid size-8 place-items-center rounded-md bg-[#043873] text-white">
              <Radar size={20} aria-hidden="true" />
            </span>
            <span className="text-xl">RoleGuage</span>
          </a>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-[#4F5F6F] md:flex">
            <a href="#job-matches" className="hover:text-[#043873]">Jobs</a>
            <a href="#workflow" className="hover:text-[#043873]">Workflow</a>
            <a href="#tools" className="hover:text-[#043873]">Tools</a>
            <a href="#application-kit" className="hover:text-[#043873]">Kit</a>
            <a href="#tracker" className="hover:text-[#043873]">Tracker</a>
            <a href="#pricing" className="hover:text-[#043873]">Pricing</a>
          </nav>

          <a href="#analyze" className="inline-flex h-10 items-center rounded-md bg-[#4F9CF9] px-4 text-sm font-bold text-white transition hover:bg-[#3b8dea]">
            Check fit
          </a>
        </div>
      </header>

      <section id="analyze" className="pb-8 md:pb-12">
        <div className="bg-[#043873] text-white">
          <div className="mx-auto max-w-7xl px-5 py-10 text-center md:px-8 md:py-14 lg:px-10">
            <p className="text-sm font-bold uppercase text-[#A7CEFC]">Resume job match checker</p>
            <h1 className="mx-auto mt-3 max-w-7xl text-4xl font-bold leading-tight md:text-6xl lg:whitespace-nowrap lg:text-5xl xl:text-6xl">
              Tailor your resume to any job ad
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-white/82">
              Upload your resume, import a job ad, and get a clear fit decision, evidence gaps, and application notes before you apply.
            </p>
            <div className="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-2">
              {trustItems.map((item) => (
                <span key={item} className="rounded-md border border-white/15 bg-white/8 px-3 py-2 text-xs font-semibold text-white/86">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto -mt-6 max-w-7xl px-5 md:px-8 lg:px-10">

          <div className={`grid items-start gap-5 transition-all duration-300 ${hasGeneratedReport ? "lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch" : "mx-auto max-w-3xl"}`}>
            <form onSubmit={analyzeRole} className="h-full rounded-md bg-white p-5 text-[#212529] shadow-[0_18px_60px_rgba(4,56,115,0.14)] md:p-7">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-extrabold">Role matcher</h3>
                  <p className="mt-2 text-sm leading-6 text-[#4F5F6F]">
                    Start with the sample, upload your resume, or paste your own job ad.
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={useSavedResumeProfile}
                    className="hidden h-10 items-center rounded-md border border-[#A7CEFC] px-3 text-xs font-semibold text-[#043873] transition hover:bg-[#A7CEFC]/20 sm:inline-flex"
                  >
                    Use profile
                  </button>
                  <button
                    type="button"
                    onClick={saveResumeProfile}
                    className="hidden h-10 items-center rounded-md border border-[#FFE492] px-3 text-xs font-semibold text-[#043873] transition hover:bg-[#FFE492] sm:inline-flex"
                  >
                    Save profile
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResume("");
                      setJob("");
                      setJobUrl("");
                      setJobMeta(emptyJobMeta);
                      setResult(null);
                      setError("");
                      setImportMessage("");
                    }}
                    className="grid size-10 place-items-center rounded-md border border-[#DDE8F6] text-[#043873] transition hover:bg-[#F4F8FF]"
                    title="Start new analysis"
                    aria-label="Start new analysis"
                  >
                    <Plus size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="mb-5 grid grid-cols-2 rounded-md border border-[#DDE8F6] bg-[#F8FBFF] p-1">
                <button
                  type="button"
                  onClick={() => setInputMode("import")}
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-bold transition ${
                    inputMode === "import"
                      ? "bg-[#043873] text-white shadow-[0_8px_20px_rgba(4,56,115,0.18)]"
                      : "text-[#043873] hover:bg-white"
                  }`}
                >
                  <Upload size={16} aria-hidden="true" />
                  PDF + URL
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode("paste")}
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-bold transition ${
                    inputMode === "paste"
                      ? "bg-[#043873] text-white shadow-[0_8px_20px_rgba(4,56,115,0.18)]"
                      : "text-[#043873] hover:bg-white"
                  }`}
                >
                  <FileText size={16} aria-hidden="true" />
                  Copy text
                </button>
              </div>

              <div className="grid gap-4">
                {inputMode === "import" ? (
                  <>
                    <div className="rounded-md border border-[#DDE8F6] bg-[#F8FBFF] p-4">
                      <div className="flex justify-center">
                        <label className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#043873] px-4 text-sm font-bold text-white transition hover:bg-[#0b4c97]">
                          {isExtractingResume ? <Loader2 className="animate-spin" size={17} aria-hidden="true" /> : <Upload size={17} aria-hidden="true" />}
                          {isExtractingResume ? "Extracting PDF" : "Upload Resume PDF"}
                          <input
                            type="file"
                            accept="application/pdf"
                            className="sr-only"
                            onChange={extractResumeFromPdf}
                            disabled={isExtractingResume}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="rounded-md border border-[#DDE8F6] bg-[#F8FBFF] p-4">
                      <label className="mb-3 flex items-center gap-2 text-sm font-bold" htmlFor="job-url">
                        <Link size={16} className="text-[#4F9CF9]" aria-hidden="true" />
                        Paste the URL of the job ad
                      </label>
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                        <input
                          id="job-url"
                          value={jobUrl}
                          onChange={(event) => setJobUrl(event.target.value)}
                          className="h-12 rounded-md border border-[#DDE8F6] bg-white px-4 text-sm outline-none transition focus:border-[#4F9CF9] focus:ring-4 focus:ring-[#4F9CF9]/15"
                          placeholder="https://company.com/careers/job-posting"
                          type="url"
                        />
                        <button
                          type="button"
                          onClick={importJobFromUrl}
                          disabled={!jobUrl.trim() || isImportingJob}
                          className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#043873] px-5 text-sm font-bold text-white transition hover:bg-[#0b4c97] disabled:cursor-not-allowed disabled:bg-[#A7CEFC]"
                        >
                          {isImportingJob ? <Loader2 className="animate-spin" size={17} aria-hidden="true" /> : <Link size={17} aria-hidden="true" />}
                          {isImportingJob ? "Importing" : "Import job"}
                        </button>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[#4F5F6F]">
                        Works best on company career pages and public ATS pages. If a job board blocks extraction, use the copy text tab.
                      </p>
                    </div>

                    <div className="grid min-w-0 gap-3 rounded-md border border-[#DDE8F6] bg-white p-4 md:grid-cols-3">
                      <SmallInput
                        label="Job title"
                        value={jobMeta.title}
                        onChange={(value) => setJobMeta((current) => ({ ...current, title: value }))}
                        placeholder="Software Engineer"
                      />
                      <SmallInput
                        label="Company"
                        value={jobMeta.company}
                        onChange={(value) => setJobMeta((current) => ({ ...current, company: value }))}
                        placeholder="Company"
                      />
                      <SmallInput
                        label="Location"
                        value={jobMeta.location}
                        onChange={(value) => setJobMeta((current) => ({ ...current, location: value }))}
                        placeholder="Sydney / Remote"
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <InputPanel
                        compact
                        icon={FileText}
                        label="Extracted resume text"
                        value={resume}
                        onChange={setResume}
                        placeholder="Upload a resume PDF or paste resume evidence here."
                      />
                      <InputPanel
                        compact
                        icon={BriefcaseBusiness}
                        label="Imported job description"
                        value={job}
                        onChange={setJob}
                        placeholder="Import a job URL or paste the target job ad here."
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <InputPanel
                      icon={FileText}
                      label="Resume evidence"
                      value={resume}
                      onChange={setResume}
                      placeholder="Paste your resume summary, project notes, skills, or experience here."
                    />
                    <InputPanel
                      icon={BriefcaseBusiness}
                      label="Job description"
                      value={job}
                      onChange={setJob}
                      placeholder="Paste the target job ad here."
                    />
                  </>
                )}
              </div>

              {importMessage ? <p className="mt-4 text-sm font-semibold text-[#0B6D4F]">{importMessage}</p> : null}
              {error ? <p className="mt-4 text-sm font-semibold text-red-600">{error}</p> : null}

              <button
                type="submit"
                disabled={!canAnalyze || isLoading}
                className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-md bg-[#4F9CF9] px-6 text-sm font-bold text-white transition hover:bg-[#3b8dea] disabled:cursor-not-allowed disabled:bg-[#A7CEFC]"
              >
                {isLoading ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : null}
                {isLoading ? "Analyzing role" : "Generate fit report"}
              </button>
            </form>

            {hasGeneratedReport ? (
            <aside className="grid h-full gap-5">
              <section className="rounded-md bg-white p-5 text-[#212529] shadow-[0_18px_60px_rgba(4,56,115,0.14)] md:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-[#4F9CF9]">Recommended move</p>
                    <h3 className="mt-2 text-4xl font-bold text-[#043873]">{activeResult.decision}</h3>
                    <p className="mt-1 text-sm font-bold text-[#4F5F6F]">{activeResult.level}</p>
                  </div>
                  <div className="grid size-24 place-items-center rounded-md bg-[#FFE492] text-[#043873]">
                    <span className="text-4xl font-bold">{activeResult.score}</span>
                  </div>
                </div>
                <p className="mt-5 leading-7 text-[#4F5F6F]">{activeResult.summary}</p>
                <div className="mt-4 rounded-md border border-[#A7CEFC] bg-white p-3">
                  <p className="text-xs font-bold uppercase text-[#043873]">Next best action</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#212529]">{activeResult.nextStep}</p>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {[
                    ["Confidence", activeResult.confidence],
                    ["Time", activeResult.timeToApply],
                    ["Headline", activeResult.keywordPlan.headline],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md border border-[#DDE8F6] bg-white p-2.5">
                      <p className="text-[11px] font-bold uppercase text-[#4F5F6F]">{label}</p>
                      <p className="mt-1 truncate text-sm font-bold text-[#043873]">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={saveCurrentApplication}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#043873] px-4 text-sm font-bold text-white transition hover:bg-[#0b4c97]"
                  >
                    <BriefcaseBusiness size={16} aria-hidden="true" />
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={copyReport}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#A7CEFC] bg-white px-4 text-sm font-semibold text-[#043873] transition hover:bg-[#A7CEFC]/20"
                  >
                    <Clipboard size={16} aria-hidden="true" />
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={downloadReport}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#FFE492] bg-white px-4 text-sm font-semibold text-[#043873] transition hover:bg-[#FFE492]"
                  >
                    <Download size={16} aria-hidden="true" />
                    Export
                  </button>
                </div>
              </section>

              <section className="rounded-md bg-white p-5 shadow-[0_18px_60px_rgba(4,56,115,0.1)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-[#212529]">Fit details</h2>
                    <p className="mt-1 text-xs leading-5 text-[#4F5F6F]">Evidence behind the recommendation.</p>
                  </div>
                  <div className="rounded-md bg-[#FFE492] px-3 py-2 text-sm font-bold text-[#043873]">
                    {activeResult.score}% fit
                  </div>
                </div>
                <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {activeResult.scoreBreakdown.map((item) => (
                    <div key={item.label} className="rounded-md border border-[#DDE8F6] bg-white p-2">
                      <p className="text-sm font-bold text-[#043873]">{item.value}</p>
                      <p className="mt-1 text-[10px] font-semibold leading-4 text-[#4F5F6F]">{item.label}</p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  <section className="grid content-start gap-3 rounded-md border border-[#DDE8F6] p-4">
                    <CompactResultBlock title="Matched skills" icon={CheckCircle2} items={activeResult.matchedSkills} tone="match" limit={4} />
                    <CompactResultBlock title="Gaps to cover" icon={Target} items={activeResult.missingSkills} tone="gap" limit={3} />
                    <CompactResultBlock title="Role signals" icon={Network} items={activeResult.roleSignals} tone="signal" limit={3} />
                  </section>

                  <section className="grid content-start gap-3 rounded-md border border-[#DDE8F6] p-4">
                    <h3 className="text-base font-bold">Score explanation</h3>
                    <CompactResultBlock title="Core matched" icon={CheckCircle2} items={activeResult.skillGroups.coreMatched} tone="match" limit={3} />
                    <CompactResultBlock title="Core missing" icon={Target} items={activeResult.skillGroups.coreMissing} tone="gap" limit={2} />
                    <CompactResultBlock title="Nice-to-have matched" icon={Network} items={activeResult.skillGroups.niceToHaveMatched} tone="signal" limit={2} />
                  </section>
                </div>
              </section>
            </aside>
            ) : null}
          </div>
        </div>
      </section>

      <section id="job-matches" className="bg-[#F8FBFF] py-10 md:py-14">
        <div className="mx-auto max-w-7xl px-5 md:px-8 lg:px-10">
          <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
            <div className="rounded-md border border-[#DDE8F6] bg-white p-5 shadow-[0_14px_40px_rgba(4,56,115,0.08)] md:p-6">
              <p className="text-sm font-bold uppercase text-[#4F9CF9]">Job discovery</p>
              <h2 className="mt-3 text-3xl font-extrabold leading-tight text-[#043873]">
                Find roles that fit your resume.
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#4F5F6F]">
                Search public job feeds by target role, then RoleGuage scores each real listing against the resume currently loaded above.
              </p>

              <form onSubmit={discoverMatchingJobs} className="mt-5 grid gap-3">
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase text-[#4F5F6F]">Target role or keywords</span>
                  <input
                    value={jobSearchQuery}
                    onChange={(event) => setJobSearchQuery(event.target.value)}
                    className="h-12 rounded-md border border-[#DDE8F6] bg-[#F8FBFF] px-4 text-sm outline-none transition focus:border-[#4F9CF9] focus:bg-white focus:ring-4 focus:ring-[#4F9CF9]/15"
                    placeholder="data analyst python sql"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase text-[#4F5F6F]">Location</span>
                  <input
                    value={jobSearchLocation}
                    onChange={(event) => setJobSearchLocation(event.target.value)}
                    className="h-12 rounded-md border border-[#DDE8F6] bg-[#F8FBFF] px-4 text-sm outline-none transition focus:border-[#4F9CF9] focus:bg-white focus:ring-4 focus:ring-[#4F9CF9]/15"
                    placeholder="Australia, Remote, United States..."
                  />
                </label>
                <button
                  type="submit"
                  disabled={resume.trim().length < 80 || isDiscoveringJobs}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#043873] px-5 text-sm font-bold text-white transition hover:bg-[#0b4c97] disabled:cursor-not-allowed disabled:bg-[#A7CEFC]"
                >
                  {isDiscoveringJobs ? <Loader2 className="animate-spin" size={17} aria-hidden="true" /> : <SearchCheck size={17} aria-hidden="true" />}
                  {isDiscoveringJobs ? "Finding jobs" : "Find matching jobs"}
                </button>
              </form>

              {jobDiscoveryError ? (
                <p className="mt-4 text-sm font-semibold text-red-600">{jobDiscoveryError}</p>
              ) : null}
              <p className="mt-4 text-xs leading-5 text-[#4F5F6F]">
                Apply opens the original listing. Current sources: Himalayas and Arbeitnow public feeds. SEEK, Indeed, and LinkedIn need approved APIs or partnerships for reliable coverage.
              </p>
            </div>

            <div className="grid gap-3">
              <div className="flex flex-col justify-between gap-2 rounded-md border border-[#DDE8F6] bg-white p-4 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-xl font-extrabold text-[#212529]">Best fitting jobs</h3>
                  <p className="mt-1 text-sm leading-6 text-[#4F5F6F]">
                    Ranked by resume fit, not by paid placement.
                  </p>
                </div>
                <span className="rounded-md bg-[#FFE492] px-3 py-2 text-sm font-bold text-[#043873]">
                  {discoveredJobs.length ? `${filteredDiscoveredJobs.length} of ${discoveredJobs.length} matches` : "Ready to search"}
                </span>
              </div>

              {discoveredJobs.length ? (
                <JobDiscoveryFilters
                  sourceFilter={jobSourceFilter}
                  onSourceFilterChange={setJobSourceFilter}
                  sources={jobSources}
                  decisionFilter={jobDecisionFilter}
                  onDecisionFilterChange={setJobDecisionFilter}
                  remoteOnly={jobRemoteOnly}
                  onRemoteOnlyChange={setJobRemoteOnly}
                  minScore={jobMinScore}
                  onMinScoreChange={setJobMinScore}
                  sort={jobSort}
                  onSortChange={setJobSort}
                />
              ) : null}

              {discoveredJobs.length ? (
                filteredDiscoveredJobs.length ? (
                  filteredDiscoveredJobs.map((jobMatch) => (
                    <JobMatchCard
                      key={jobMatch.id}
                      job={jobMatch}
                      onLoad={() => loadDiscoveredJob(jobMatch)}
                    />
                  ))
                ) : (
                  <div className="rounded-md border border-dashed border-[#A7CEFC] bg-white p-8 text-center">
                    <p className="text-lg font-extrabold text-[#043873]">No jobs match these filters</p>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#4F5F6F]">
                      Lower the minimum fit score, include more decisions, or clear the remote-only filter.
                    </p>
                  </div>
                )
              ) : (
                <div className="rounded-md border border-dashed border-[#A7CEFC] bg-white p-8 text-center">
                  <p className="text-lg font-extrabold text-[#043873]">No job matches loaded yet</p>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#4F5F6F]">
                    Upload or paste your resume, choose a target role, then search to see ranked job listings with direct apply links.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="bg-white py-10 md:py-14">
        <div className="mx-auto max-w-7xl px-5 md:px-8 lg:px-10">
          <div className="grid gap-7 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
            <div>
              <p className="text-sm font-bold uppercase text-[#4F9CF9]">How it works</p>
              <h2 className="mt-3 text-3xl font-extrabold leading-tight text-[#043873] md:text-5xl">
                One workflow from job ad to application plan.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#4F5F6F]">
                RoleGuage is designed for jobseekers who want to apply with focus, not guesswork. It keeps the useful parts of AI job tools and removes the noisy parts: no fake skills, no black-box score, no forced account before the first check.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {workflowSteps.map(([title, copy, Icon], index) => (
                <article key={title} className="rounded-md border border-[#DDE8F6] bg-[#F8FBFF] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="grid size-10 place-items-center rounded-md bg-[#043873] text-white">
                      <Icon size={19} aria-hidden="true" />
                    </span>
                    <span className="rounded-md bg-[#FFE492] px-2.5 py-1 text-xs font-bold text-[#043873]">
                      0{index + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-extrabold text-[#212529]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#4F5F6F]">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {hasGeneratedReport ? (
      <section id="application-kit" className="bg-[#043873] pb-14 pt-8 text-white md:pb-20 md:pt-12">
        <div className="mx-auto max-w-7xl px-5 md:px-8 lg:px-10">
          <div className="mb-10 grid gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
            <div>
              <h2 className="text-4xl font-extrabold leading-tight md:text-5xl">
                Your application <span className="text-[#FFE492]">kit</span>
              </h2>
              <p className="mt-5 max-w-2xl leading-8 text-white/82">
                Turn the match result into practical notes for your resume, interview prep, outreach, and next action.
              </p>
            </div>
            <div className="rounded-md border border-[#DDE8F6] bg-white p-4 shadow-[0_14px_40px_rgba(4,56,115,0.08)]">
              <p className="text-sm font-bold text-[#043873]">Current role recommendation</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-[#043873] px-3 py-2 text-sm font-extrabold text-white">{activeResult.decision}</span>
                <span className="rounded-md bg-[#FFE492] px-3 py-2 text-sm font-extrabold text-[#043873]">{activeResult.score}% fit</span>
                <span className="rounded-md border border-[#A7CEFC] bg-white px-3 py-2 text-sm font-semibold text-[#043873]">{activeResult.timeToApply}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <ApplicationKitCard
              title="Keyword plan"
              items={[
                `Lead with: ${activeResult.keywordPlan.headline}`,
                ...activeResult.keywordPlan.keep.slice(0, 4).map((item) => `Keep visible: ${item}`),
                ...activeResult.keywordPlan.add.slice(0, 4).map((item) => `Missing evidence: ${item}`),
              ]}
            />
            <ApplicationKitCard title="Resume bullet drafts" items={activeResult.resumeBullets} />
            <ApplicationKitCard title="Interview prep" items={activeResult.interviewPrep} />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-md border border-[#DDE8F6] bg-white p-6 shadow-[0_14px_40px_rgba(4,56,115,0.08)]">
              <h3 className="text-xl font-bold text-[#212529]">Outreach note</h3>
              <p className="mt-4 rounded-md border border-[#DDE8F6] bg-[#F8FBFF] p-4 text-sm leading-7 text-[#4F5F6F]">
                {activeResult.outreachMessage}
              </p>
            </section>
            <ApplicationKitCard title="ATS sanity checks" items={activeResult.atsNotes} />
          </div>
        </div>
      </section>
      ) : null}

      <section id="tools" className="bg-white pb-12 pt-8 md:pb-16 md:pt-10">
        <div className="mx-auto max-w-7xl px-5 md:px-8 lg:px-10">
          <div className="mb-7 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <h2 className="text-3xl font-extrabold text-[#043873]">Everything needed to apply with focus</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#4F5F6F]">
                Start with the matcher, then use the generated kit to tailor, prepare, save, and export without rebuilding the same work every time.
              </p>
            </div>
            <a href="#analyze" className="inline-flex h-11 items-center justify-center rounded-md bg-[#043873] px-5 text-sm font-bold text-white transition hover:bg-[#0b4c97]">
              Open matcher
            </a>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {jobTools.map(([title, copy, Icon]) => (
              <a key={title} href={title === "Application tracker" ? "#tracker" : "#analyze"} className="group rounded-md border border-[#DDE8F6] bg-[#F8FBFF] p-5 transition hover:-translate-y-0.5 hover:border-[#A7CEFC] hover:bg-white hover:shadow-[0_14px_40px_rgba(4,56,115,0.08)]">
                <span className="grid size-10 place-items-center rounded-md bg-[#A7CEFC]/45 text-[#043873]">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-extrabold text-[#212529]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#4F5F6F]">{copy}</p>
              </a>
            ))}
          </div>
          <div className="mt-6 grid gap-4 rounded-md border border-[#DDE8F6] bg-[#F8FBFF] p-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-md bg-[#043873] text-white">
                <ShieldCheck size={21} aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-lg font-extrabold text-[#212529]">Privacy-first MVP</h3>
                <p className="mt-1 text-sm leading-6 text-[#4F5F6F]">Saved resumes and tracked applications stay in this browser for now.</p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {trustItems.map((item) => (
                <div key={item} className="rounded-md border border-[#DDE8F6] bg-white px-3 py-2 text-sm font-semibold text-[#043873]">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="tracker" className="bg-[#043873] pb-14 pt-8 text-white md:pb-20 md:pt-12">
        <div className="mx-auto max-w-7xl px-5 md:px-8 lg:px-10">
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="text-4xl font-extrabold leading-tight md:text-5xl">
                Application <span className="text-[#FFE492]">tracker</span>
              </h2>
              <p className="mt-4 max-w-2xl leading-8 text-white/82">
                Save fit reports, update statuses, and keep notes so every application has a clear next action.
              </p>
            </div>
            <p className="rounded-md border border-[#DDE8F6] bg-white px-4 py-3 text-sm font-bold text-[#043873]">
              {applications.length} saved
            </p>
          </div>

          {applications.length ? (
            <div className="grid gap-4">
              {applications.map((application) => (
                <article key={application.id} className="rounded-md border border-[#DDE8F6] bg-white p-5 shadow-[0_14px_40px_rgba(4,56,115,0.08)]">
                  <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-extrabold">{application.title || "Untitled role"}</h3>
                        <span className="rounded-md bg-[#FFE492] px-3 py-1 text-sm font-extrabold text-[#043873]">
                          {application.score}%
                        </span>
                        <span className="rounded-md border border-[#A7CEFC] bg-white px-3 py-1 text-sm font-semibold text-[#043873]">
                          {application.level}
                        </span>
                        <span className="rounded-md bg-[#043873] px-3 py-1 text-sm font-bold text-white">
                          {application.decision ?? "Review"}
                        </span>
                        <span className="rounded-md border border-[#FFE492] bg-[#FFE492] px-3 py-1 text-sm font-semibold text-[#043873]">
                          {application.timeToApply ?? "Plan"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[#4F5F6F]">
                        {[application.company, application.location].filter(Boolean).join(" | ") || "No company/location saved"}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-[#4F5F6F]">{application.summary}</p>
                      {application.nextStep ? (
                        <p className="mt-3 rounded-md border border-[#DDE8F6] bg-[#F8FBFF] p-3 text-sm font-semibold leading-6 text-[#043873]">
                          {application.nextStep}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                      <select
                        value={application.status}
                        onChange={(event) => updateApplicationStatus(application.id, event.target.value as ApplicationStatus)}
                        className="h-11 rounded-md border border-[#DDE8F6] bg-white px-3 text-sm font-bold text-[#043873] outline-none focus:border-[#4F9CF9] focus:ring-4 focus:ring-[#4F9CF9]/15"
                      >
                        {applicationStatuses.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeApplication(application.id)}
                        className="h-11 rounded-md border border-[#FFE492] px-3 text-sm font-semibold text-[#043873] transition hover:bg-[#FFE492]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <TrackerSkillList label="Matched" items={application.matchedSkills} />
                    <TrackerSkillList label="Missing" items={application.missingSkills} />
                  </div>
                  <label className="mt-4 grid gap-2">
                    <span className="text-sm font-bold text-[#212529]">Notes</span>
                    <textarea
                      value={application.notes}
                      onChange={(event) => updateApplicationNotes(application.id, event.target.value)}
                      className="min-h-20 resize-y rounded-md border border-[#DDE8F6] bg-[#F8FBFF] p-3 text-sm leading-6 outline-none focus:border-[#4F9CF9] focus:ring-4 focus:ring-[#4F9CF9]/15"
                      placeholder="Next action, recruiter contact, application link, interview notes..."
                    />
                  </label>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-[#DDE8F6] bg-white p-8 text-center shadow-[0_14px_40px_rgba(4,56,115,0.08)]">
              <p className="text-lg font-extrabold text-[#043873]">No saved applications yet</p>
              <p className="mt-2 text-sm leading-6 text-[#4F5F6F]">
                Generate a fit report, then use Save to add it here.
              </p>
            </div>
          )}
        </div>
      </section>

      <section id="pricing" className="pb-16 pt-10 md:pb-24 md:pt-14">
        <div className="mx-auto max-w-7xl px-5 md:px-8 lg:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-extrabold leading-tight md:text-5xl">
              Choose your <span className="yellow-mark">plan</span>
            </h2>
            <p className="mt-5 leading-8 text-[#4F5F6F]">
              Start with fit checks, then upgrade when you want saved reports, profile reuse, and a cleaner application workflow.
            </p>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`rounded-md border p-7 ${plan.featured ? "border-[#043873] bg-[#043873] text-white shadow-[0_22px_60px_rgba(4,56,115,0.24)]" : "border-[#FFE492] bg-white text-[#212529]"}`}
              >
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <p className={`mt-3 text-sm leading-7 ${plan.featured ? "text-white/80" : "text-[#4F5F6F]"}`}>{plan.copy}</p>
                <p className="mt-6 text-4xl font-extrabold">{plan.price}</p>
                <ul className="mt-6 grid gap-3 text-sm">
                  {plan.items.map((item) => (
                    <li key={item} className="flex gap-3">
                      <Check size={17} className={plan.featured ? "text-[#FFE492]" : "text-[#043873]"} aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="#analyze"
                  className={`mt-7 inline-flex items-center justify-center rounded-md px-5 py-3 text-sm font-semibold transition ${plan.featured ? "bg-[#4F9CF9] text-white hover:bg-[#3b8dea]" : "border border-[#FFE492] text-[#043873] hover:bg-[#FFF7D6]"}`}
                >
                  Get started
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="bg-white py-12 md:py-16">
        <div className="mx-auto max-w-5xl px-5 md:px-8 lg:px-10">
          <div className="mb-7 text-center">
            <h2 className="text-3xl font-extrabold text-[#043873] md:text-4xl">Questions jobseekers ask first</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#4F5F6F]">
              RoleGuage is built to help you apply better, not to invent experience or automate low-quality applications.
            </p>
          </div>
          <div className="grid gap-3">
            {faqs.map(([question, answer]) => (
              <article key={question} className="rounded-md border border-[#DDE8F6] bg-[#F8FBFF] p-5">
                <h3 className="text-base font-extrabold text-[#212529]">{question}</h3>
                <p className="mt-2 text-sm leading-7 text-[#4F5F6F]">{answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-[#043873] text-white">
        <div className="mx-auto max-w-7xl px-5 py-10 text-center md:px-8 lg:px-10">
          <h2 className="text-4xl font-extrabold">Try RoleGuage today</h2>
          <p className="mx-auto mt-5 max-w-xl leading-8 text-white/82">
            Compare your resume against a real job ad, see the evidence gaps, and leave with a clearer plan for your next application.
          </p>
          <a href="#analyze" className="mt-7 inline-flex items-center gap-2 rounded-md bg-[#4F9CF9] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#3b8dea]">
            Start analyzing
            <ArrowRight size={17} aria-hidden="true" />
          </a>
          <div className="mt-12 flex flex-col items-center justify-between gap-5 border-t border-white/15 pt-8 text-sm text-white/70 md:flex-row">
            <a href="#" className="flex items-center gap-2 font-bold text-white">
              <span className="grid size-8 place-items-center rounded-md bg-white text-[#043873]">
                <Radar size={20} aria-hidden="true" />
              </span>
              RoleGuage
            </a>
            <p>Resume fit scoring, evidence-gap analysis, and targeted application support.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}

function inferJobMeta(jobText: string, current: JobMeta): JobMeta {
  const firstLine = jobText
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  return {
    title: current.title || firstLine?.slice(0, 90) || "Untitled role",
    company: current.company,
    location: current.location,
    sourceUrl: current.sourceUrl,
  };
}

function subscribeToTracker(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(trackerChangeEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(trackerChangeEvent, onStoreChange);
  };
}

function getTrackerSnapshot() {
  const raw =
    window.localStorage.getItem(trackerStorageKey) ??
    window.localStorage.getItem(legacyTrackerStorageKey) ??
    "[]";

  if (raw === cachedTrackerRaw) {
    return cachedTrackerApplications;
  }

  cachedTrackerRaw = raw;

  try {
    const parsed = JSON.parse(raw) as TrackedApplication[];
    cachedTrackerApplications = Array.isArray(parsed) ? parsed : [];
  } catch {
    cachedTrackerApplications = [];
  }

  return cachedTrackerApplications;
}

function getTrackerServerSnapshot() {
  return emptyTrackerApplications;
}

function writeTrackerApplications(
  update: (current: TrackedApplication[]) => TrackedApplication[],
) {
  const nextApplications = update(getTrackerSnapshot());
  const raw = JSON.stringify(nextApplications);

  cachedTrackerRaw = raw;
  cachedTrackerApplications = nextApplications;
  window.localStorage.setItem(trackerStorageKey, raw);
  window.dispatchEvent(new Event(trackerChangeEvent));
}

function cleanImportedTitle(title: string) {
  return title
    .replace(/\s+-\s+SEEK$/i, "")
    .replace(/\s+Job in .+$/i, "")
    .replace(/\s+\|\s+.+$/i, "")
    .trim();
}

function buildReportText(result: AnalysisResult, meta: JobMeta) {
  return [
    "RoleGuage Fit Report",
    "",
    `Role: ${meta.title || "Untitled role"}`,
    `Company: ${meta.company || "Not provided"}`,
    `Location: ${meta.location || "Not provided"}`,
    meta.sourceUrl ? `Source: ${meta.sourceUrl}` : "",
    "",
    `Score: ${result.score}%`,
    `Recommendation: ${result.level}`,
    `Decision: ${result.decision}`,
    `Next step: ${result.nextStep}`,
    `Time estimate: ${result.timeToApply}`,
    `Confidence: ${result.confidence}`,
    "",
    "Summary",
    result.summary,
    "",
    "Score Breakdown",
    ...result.scoreBreakdown.map((item) => `- ${item.label}: ${item.value} (${item.detail})`),
    "",
    "Matched Skills",
    result.matchedSkills.length ? result.matchedSkills.map((item) => `- ${item}`).join("\n") : "- None detected",
    "",
    "Gaps To Cover",
    result.missingSkills.length ? result.missingSkills.map((item) => `- ${item}`).join("\n") : "- None detected",
    "",
    "Role Signals",
    result.roleSignals.length ? result.roleSignals.map((item) => `- ${item}`).join("\n") : "- None detected",
    "",
    "Recommended Actions",
    ...result.bullets.map((item) => `- ${item}`),
    "",
    "Keyword Plan",
    `- Headline: ${result.keywordPlan.headline}`,
    ...result.keywordPlan.keep.map((item) => `- Keep visible: ${item}`),
    ...result.keywordPlan.add.map((item) => `- Missing evidence: ${item}`),
    "",
    "Resume Bullet Drafts",
    ...result.resumeBullets.map((item) => `- ${item}`),
    "",
    "Interview Prep",
    ...result.interviewPrep.map((item) => `- ${item}`),
    "",
    "Outreach Note",
    result.outreachMessage,
    "",
    "ATS Notes",
    ...result.atsNotes.map((item) => `- ${item}`),
  ].join("\n");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function parsePostedDate(value: string) {
  if (!value) return 0;

  const currentYear = new Date().getFullYear();
  const parsed = Date.parse(`${value} ${currentYear}`);

  return Number.isNaN(parsed) ? 0 : parsed;
}

function buildDiscoveredJobText(jobToLoad: DiscoveredJob) {
  return [
    jobToLoad.title,
    jobToLoad.company,
    jobToLoad.location,
    jobToLoad.tags.join(" "),
    "",
    jobToLoad.description,
  ]
    .filter(Boolean)
    .join("\n");
}

function SmallInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="grid min-w-0 gap-2">
      <span className="text-xs font-bold uppercase text-[#4F5F6F]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 min-w-0 truncate rounded-md border border-[#DDE8F6] bg-[#F8FBFF] px-3 text-sm outline-none transition focus:border-[#4F9CF9] focus:bg-white focus:ring-4 focus:ring-[#4F9CF9]/15"
        placeholder={placeholder}
      />
    </label>
  );
}

function JobDiscoveryFilters({
  sourceFilter,
  onSourceFilterChange,
  sources,
  decisionFilter,
  onDecisionFilterChange,
  remoteOnly,
  onRemoteOnlyChange,
  minScore,
  onMinScoreChange,
  sort,
  onSortChange,
}: {
  sourceFilter: string;
  onSourceFilterChange: (value: string) => void;
  sources: string[];
  decisionFilter: JobDecisionFilter;
  onDecisionFilterChange: (value: JobDecisionFilter) => void;
  remoteOnly: boolean;
  onRemoteOnlyChange: (value: boolean) => void;
  minScore: number;
  onMinScoreChange: (value: number) => void;
  sort: JobSort;
  onSortChange: (value: JobSort) => void;
}) {
  return (
    <section className="rounded-md border border-[#DDE8F6] bg-white p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="grid gap-1.5">
          <span className="text-xs font-bold uppercase text-[#4F5F6F]">Sort</span>
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as JobSort)}
            className="h-10 rounded-md border border-[#DDE8F6] bg-[#F8FBFF] px-3 text-sm font-semibold text-[#043873] outline-none focus:border-[#4F9CF9] focus:ring-4 focus:ring-[#4F9CF9]/15"
          >
            <option value="fit">Best fit</option>
            <option value="recent">Most recent</option>
          </select>
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-bold uppercase text-[#4F5F6F]">Source</span>
          <select
            value={sourceFilter}
            onChange={(event) => onSourceFilterChange(event.target.value)}
            className="h-10 rounded-md border border-[#DDE8F6] bg-[#F8FBFF] px-3 text-sm font-semibold text-[#043873] outline-none focus:border-[#4F9CF9] focus:ring-4 focus:ring-[#4F9CF9]/15"
          >
            <option value="all">All sources</option>
            {sources.map((source) => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-bold uppercase text-[#4F5F6F]">Decision</span>
          <select
            value={decisionFilter}
            onChange={(event) => onDecisionFilterChange(event.target.value as JobDecisionFilter)}
            className="h-10 rounded-md border border-[#DDE8F6] bg-[#F8FBFF] px-3 text-sm font-semibold text-[#043873] outline-none focus:border-[#4F9CF9] focus:ring-4 focus:ring-[#4F9CF9]/15"
          >
            <option value="all">All decisions</option>
            <option value="Apply">Apply</option>
            <option value="Tailor">Tailor</option>
            <option value="Build">Build</option>
            <option value="Skip">Skip</option>
          </select>
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-bold uppercase text-[#4F5F6F]">Minimum fit</span>
          <select
            value={minScore}
            onChange={(event) => onMinScoreChange(Number(event.target.value))}
            className="h-10 rounded-md border border-[#DDE8F6] bg-[#F8FBFF] px-3 text-sm font-semibold text-[#043873] outline-none focus:border-[#4F9CF9] focus:ring-4 focus:ring-[#4F9CF9]/15"
          >
            <option value={0}>Any score</option>
            <option value={55}>55%+</option>
            <option value={70}>70%+</option>
            <option value={82}>82%+</option>
          </select>
        </label>

        <label className="flex h-10 items-center justify-between gap-3 rounded-md border border-[#DDE8F6] bg-[#F8FBFF] px-3 xl:self-end">
          <span className="text-sm font-semibold text-[#043873]">Remote only</span>
          <input
            checked={remoteOnly}
            onChange={(event) => onRemoteOnlyChange(event.target.checked)}
            type="checkbox"
            className="size-4 accent-[#043873]"
          />
        </label>
      </div>
    </section>
  );
}

function JobMatchCard({
  job,
  onLoad,
}: {
  job: DiscoveredJob;
  onLoad: () => void;
}) {
  return (
    <article className="rounded-md border border-[#DDE8F6] bg-white p-5 shadow-[0_10px_30px_rgba(4,56,115,0.06)] transition hover:border-[#A7CEFC] hover:shadow-[0_16px_42px_rgba(4,56,115,0.1)]">
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[#A7CEFC] px-2.5 py-1 text-xs font-bold text-[#043873]">
              via {job.source}
            </span>
            {job.postedAt ? (
              <span className="rounded-md border border-[#DDE8F6] px-2.5 py-1 text-xs font-semibold text-[#4F5F6F]">
                Posted {job.postedAt}
              </span>
            ) : null}
            <span className="rounded-md border border-[#FFE492] bg-[#FFE492] px-2.5 py-1 text-xs font-bold text-[#043873]">
              {job.level}
            </span>
          </div>
          <h3 className="mt-3 text-xl font-extrabold leading-tight text-[#212529]">{job.title}</h3>
          <p className="mt-1 text-sm font-semibold text-[#4F5F6F]">
            {[job.company, job.location].filter(Boolean).join(" | ")}
          </p>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#4F5F6F]">{job.summary}</p>
        </div>

        <div className="flex items-start gap-3 md:flex-col md:items-end">
          <div className="grid size-20 shrink-0 place-items-center rounded-md bg-[#043873] text-white">
            <div className="text-center">
              <p className="text-2xl font-extrabold leading-none">{job.score}</p>
              <p className="mt-1 text-xs font-bold">fit</p>
            </div>
          </div>
          <div className="flex grow gap-2 md:grow-0">
            <button
              type="button"
              onClick={onLoad}
              className="inline-flex h-10 items-center justify-center rounded-md border border-[#A7CEFC] px-3 text-xs font-bold text-[#043873] transition hover:bg-[#A7CEFC]/25"
            >
              Review
            </button>
            <a
              href={job.applyUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center rounded-md bg-[#4F9CF9] px-3 text-xs font-bold text-white transition hover:bg-[#3b8dea]"
            >
              Apply
            </a>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 border-t border-[#DDE8F6] pt-4 lg:grid-cols-2">
        <JobChipGroup label="Matched" items={job.matchedSkills} tone="match" />
        <JobChipGroup label="Gaps" items={job.missingSkills} tone="gap" />
      </div>

      {job.tags.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {job.tags.slice(0, 5).map((tag) => (
            <span key={tag} className="rounded-md border border-[#DDE8F6] bg-[#F8FBFF] px-2.5 py-1 text-xs font-semibold text-[#4F5F6F]">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function JobChipGroup({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "match" | "gap";
}) {
  const chipClass =
    tone === "match"
      ? "border-[#A7CEFC] bg-white text-[#043873]"
      : "border-[#FFE492] bg-[#FFE492] text-[#043873]";

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase text-[#4F5F6F]">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.length ? (
          items.map((item) => (
            <span key={item} className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${chipClass}`}>
              {item}
            </span>
          ))
        ) : (
          <span className="rounded-md border border-[#DDE8F6] px-2.5 py-1 text-xs font-semibold text-[#4F5F6F]">
            None detected
          </span>
        )}
      </div>
    </div>
  );
}

function TrackerSkillList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="mb-2 text-sm font-bold text-[#212529]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.length ? (
          items.slice(0, 8).map((item) => (
            <span key={item} className="rounded-md border border-[#A7CEFC] bg-white px-3 py-1.5 text-xs font-semibold text-[#043873]">
              {item}
            </span>
          ))
        ) : (
          <span className="rounded-md border border-[#DDE8F6] bg-white px-3 py-1.5 text-xs font-bold text-[#4F5F6F]">
            None
          </span>
        )}
      </div>
    </div>
  );
}

function ApplicationKitCard({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <section className="rounded-md border border-[#DDE8F6] bg-white p-6 shadow-[0_14px_40px_rgba(4,56,115,0.08)]">
      <h3 className="text-xl font-bold text-[#212529]">{title}</h3>
      <ul className="mt-5 grid gap-3 text-sm leading-6 text-[#4F5F6F]">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <CheckCircle2 size={16} className="mt-1 shrink-0 text-[#4F9CF9]" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function InputPanel({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  compact = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  compact?: boolean;
}) {
  return (
    <label className="grid gap-2">
      <span className="flex items-center gap-2 text-sm font-bold">
        <Icon size={16} className="text-[#4F9CF9]" aria-hidden="true" />
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${compact ? "min-h-52 md:min-h-72" : "min-h-64 md:min-h-80"} resize-y rounded-md border border-[#DDE8F6] bg-[#F8FBFF] p-4 text-sm leading-7 outline-none transition focus:border-[#4F9CF9] focus:bg-white focus:ring-4 focus:ring-[#4F9CF9]/15`}
        placeholder={placeholder}
      />
    </label>
  );
}

function CompactResultBlock({
  title,
  icon: Icon,
  items,
  tone,
  limit = 4,
}: {
  title: string;
  icon: LucideIcon;
  items: string[];
  tone: "match" | "gap" | "signal";
  limit?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const chipClass = {
    match: "border-[#A7CEFC] bg-white text-[#043873]",
    gap: "border-[#FFE492] bg-[#FFE492] text-[#043873]",
    signal: "border-[#A7CEFC] bg-[#A7CEFC] text-[#043873]",
  }[tone];

  const visibleItems = isExpanded ? items : items.slice(0, limit);
  const hiddenCount = Math.max(items.length - visibleItems.length, 0);

  return (
    <div className="border-b border-[#DDE8F6] pb-3 last:border-b-0 last:pb-0">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-[#212529]">
        <span className="grid size-5 shrink-0 place-items-center rounded-md border border-[#043873] text-[#043873]">
          <Icon size={12} strokeWidth={2.5} aria-hidden="true" />
        </span>
        <span className="leading-tight">{title}</span>
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {items.length ? (
          <>
          {visibleItems.map((item) => (
            <span key={item} className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold leading-tight ${chipClass}`}>
              {item}
            </span>
          ))}
          {hiddenCount ? (
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="rounded-md border border-[#DDE8F6] bg-white px-2.5 py-1.5 text-xs font-semibold leading-tight text-[#4F5F6F] transition hover:border-[#A7CEFC] hover:text-[#043873]"
            >
              +{hiddenCount} more
            </button>
          ) : null}
          </>
        ) : (
          <span className="rounded-md border border-[#DDE8F6] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#4F5F6F]">
            None
          </span>
        )}
      </div>
    </div>
  );
}
