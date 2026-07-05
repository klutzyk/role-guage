"use client";

import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clipboard,
  Download,
  FileText,
  Gauge,
  Link,
  ListChecks,
  Loader2,
  SearchCheck,
  Target,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  cleanCoverLetterExamples,
  cleanCoverLetterPreferences,
  coverLetterExamplesStorageKey,
  coverLetterPreferencesStorageKey,
} from "@/lib/cover-letter-preferences";
import { readJsonResponse } from "@/lib/http";
import { SharedFooter } from "../shared-footer";
import { SharedHeader } from "../shared-header";

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
  scoreBreakdown: Array<{ label: string; value: string; detail: string }>;
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
  aiStatus?: "generated" | "fallback" | "disabled";
  fitReasoning?: string[];
  coverLetter?: string;
  salary?: string | null;
  hardRequirements?: RequirementFinding[];
};

type RequirementFinding = {
  type: string;
  severity: "hard" | "warning" | "info";
  status: "blocked" | "unknown" | "matched" | "info";
  label: string;
  jobEvidence: string;
  candidateEvidence?: string;
  message: string;
};

type CandidateProfile = {
  workRights?: string;
  visaExpiry?: string;
  location?: string;
  workMode?: string;
  driversLicence?: "yes" | "no" | "unknown" | "";
  securityClearance?: string;
  licences?: string;
  minimumSalary?: string;
  targetRoles?: string;
};

type ImportedJob = {
  title: string;
  company: string;
  location: string;
  description: string;
  sourceUrl: string;
};

type JobMeta = {
  title: string;
  company: string;
  location: string;
  sourceUrl: string;
};

type MatchHistoryItem = {
  id: string;
  savedAt: string;
  jobMeta: JobMeta;
  result: AnalysisResult;
};

const sampleResume = `Software Engineer with 4 years of experience building web applications, REST APIs, dashboards, and data pipelines. Skilled in Python, TypeScript, React, PostgreSQL, machine learning, data analysis, cloud deployment, and stakeholder communication. Completed a Master of Data Science in Australia with projects in NLP, predictive modelling, and business analytics.`;

const sampleJob = `We are hiring a Data Analyst / AI Product Engineer in Sydney. The role requires Python, SQL, dashboards, machine learning, stakeholder communication, experimentation, API integration, and experience turning messy business data into actionable insights. Knowledge of React, cloud platforms, and LLM tools is a strong advantage.`;

const emptyJobMeta: JobMeta = {
  title: "Data Analyst / AI Product Engineer",
  company: "Sample company",
  location: "Sydney",
  sourceUrl: "",
};

const resumeProfileStorageKey = "roleguage.resume-profile.v1";
const resumeProfileNameStorageKey = "roleguage.resume-profile-name.v1";
const legacyResumeProfileStorageKey = "applypilot.resume-profile.v1";
const matchHistoryStorageKey = "roleguage.match-history.v1";
const candidateProfileStorageKey = "roleguage.candidate-profile.v1";
const maxResumePdfBytes = 4 * 1024 * 1024;

const workflowSteps: Array<[string, string, LucideIcon]> = [
  ["Upload once", "Use a resume PDF or saved profile as the evidence base for the match.", Upload],
  ["Import a role", "Paste a job URL or use copy text when a job board blocks import.", SearchCheck],
  ["Check the fit", "See the matched skills, evidence gaps, and what to fix before applying.", Gauge],
  ["Create application notes", "Generate resume bullets, interview prep, and a cover letter draft.", ListChecks],
];

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

const faqs: Array<[string, string]> = [
  [
    "Is this just ChatGPT with a nicer screen?",
    "No. RoleGuage gives you a structured report for each role: fit score, evidence gaps, hard requirements, cover letter draft, and next steps.",
  ],
  [
    "Does it rewrite my resume with fake skills?",
    "No. It highlights what your resume already supports and separates missing evidence from matched evidence.",
  ],
  [
    "Can it import jobs from LinkedIn or SEEK?",
    "Some large job boards block automated extraction. RoleGuage keeps URL import for public pages, copy text for blocked pages, and a Chrome extension for extracting the visible job ad.",
  ],
  [
    "Where is my resume stored?",
    "Saved profiles and match history stay in your browser, and you can delete them from your profile page.",
  ],
];

export default function Home() {
  const [resume, setResume] = useState(sampleResume);
  const [job, setJob] = useState(sampleJob);
  const [jobUrl, setJobUrl] = useState("");
  const [jobMeta, setJobMeta] = useState<JobMeta>(emptyJobMeta);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [resumeFileName, setResumeFileName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isEnrichingReport, setIsEnrichingReport] = useState(false);
  const [isImportingJob, setIsImportingJob] = useState(false);
  const [isExtractingResume, setIsExtractingResume] = useState(false);
  const [copiedCoverLetter, setCopiedCoverLetter] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const activeRequest = useRef(0);

  useEffect(() => {
    const savedResume =
      window.localStorage.getItem(resumeProfileStorageKey) ??
      window.localStorage.getItem(legacyResumeProfileStorageKey);

    if (!savedResume) {
      return;
    }

    const savedName = window.localStorage.getItem(resumeProfileNameStorageKey) ?? "Saved resume profile";
    setResume(savedResume);
    setResumeFileName(savedName);
  }, []);

  const canAnalyze = useMemo(
    () => resume.trim().length > 80 && job.trim().length > 80,
    [resume, job],
  );
  const isPreparingReport = Boolean(result && isEnrichingReport);
  const coverLetter = result?.coverLetter?.trim() ?? "";

  async function analyzeRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAnalysis(resume, job);
  }

  async function runAnalysis(resumeText: string, jobText: string) {
    const requestId = activeRequest.current + 1;
    activeRequest.current = requestId;
    setError("");
    setMessage("");
    setIsLoading(true);
    setIsEnrichingReport(false);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume: resumeText, job: jobText, profile: readCandidateProfile() }),
      });

      if (!response.ok) throw new Error("Analysis failed");

      const data = (await response.json()) as AnalysisResult;
      setResult(data);
      saveMatchToHistory(data, inferJobMeta(jobText, jobMeta));
      setIsEnrichingReport(true);
      void enrichReport(resumeText, jobText, requestId, data);
    } catch {
      setError("RoleGuage could not analyze this role yet. Try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function enrichReport(
    resumeText: string,
    jobText: string,
    requestId: number,
    baseResult: AnalysisResult,
  ) {
    try {
      const response = await fetch("/api/enrich-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume: resumeText,
          job: jobText,
          profile: readCandidateProfile(),
          analysis: baseResult,
          coverLetterInstructions: readCoverLetterPreferences(),
          coverLetterExamples: readCoverLetterExamples(),
        }),
      });

      if (!response.ok) throw new Error("Enrichment failed");

      const enrichment = (await response.json()) as Partial<AnalysisResult>;
      if (activeRequest.current !== requestId) return;
      const shouldKeepLocalBlockerCopy = hasHardBlocker(baseResult);

      const enrichedResult = {
        ...baseResult,
        ...enrichment,
        summary: shouldKeepLocalBlockerCopy ? baseResult.summary : enrichment.summary ?? baseResult.summary,
        nextStep: shouldKeepLocalBlockerCopy ? baseResult.nextStep : enrichment.nextStep ?? baseResult.nextStep,
        coverLetter: enrichment.coverLetter?.trim() ?? "",
      };
      setResult(enrichedResult);
      saveMatchToHistory(enrichedResult, inferJobMeta(jobText, jobMeta));
    } catch {
      if (activeRequest.current === requestId) {
        const fallbackResult = {
          ...baseResult,
          coverLetter: "",
          aiStatus: "fallback" as const,
        };
        setResult(fallbackResult);
        saveMatchToHistory(fallbackResult, inferJobMeta(jobText, jobMeta));
      }
    } finally {
      if (activeRequest.current === requestId) setIsEnrichingReport(false);
    }
  }

  async function importJobFromUrl() {
    setError("");
    setMessage("");
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
      setMessage("Job description imported. Review it, then generate the fit report.");
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

    if (file.size > maxResumePdfBytes) {
      setError("Resume PDF must be smaller than 4 MB.");
      return;
    }

    setError("");
    setMessage("");
    setIsExtractingResume(true);

    try {
      const formData = new FormData();
      formData.append("resume", file);

      const response = await fetch("/api/extract-resume", {
        method: "POST",
        body: formData,
      });
      const data = await readJsonResponse<{ text?: string; filename?: string; error?: string }>(response);

      if (!response.ok || !data.text) {
        throw new Error(data.error ?? "Could not extract this PDF.");
      }

      setResume(data.text);
      const filename = data.filename ?? file.name;
      setResumeFileName(filename);
      window.localStorage.setItem(resumeProfileStorageKey, data.text);
      window.localStorage.setItem(resumeProfileNameStorageKey, filename);
      setMessage(`Extracted and saved resume text from ${filename}. Review it before matching.`);
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

  async function copyReport() {
    if (!result) return;
    await navigator.clipboard.writeText(buildReportText(result, inferJobMeta(job, jobMeta)));
    setMessage("Fit report copied.");
  }

  async function copyCoverLetter() {
    if (!coverLetter) return;
    await navigator.clipboard.writeText(coverLetter);
    setCopiedCoverLetter(true);
    setMessage("Cover letter copied.");
    window.setTimeout(() => setCopiedCoverLetter(false), 1800);
  }

  function downloadReport() {
    if (!result) return;
    const meta = inferJobMeta(job, jobMeta);
    const blob = new Blob([buildReportText(result, meta)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `${slugify(meta.title || "roleguage-report")}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Fit report downloaded.");
  }

  return (
    <main className="min-h-screen bg-[#F8FBFF] text-[#212529]">
      <SharedHeader active="matcher" />

      <section className="bg-[#043873] px-5 py-10 text-white md:px-8 md:py-14 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-4xl font-extrabold leading-tight text-[#A7CEFC] md:text-6xl">Resume to Job Matcher</h1>
          <p className="mt-4 max-w-5xl text-2xl font-extrabold leading-tight text-white md:text-4xl">
            Check one role before you spend time applying.
          </p>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-white/82 md:text-base">
            Reuse your resume, add the job ad, and get the fit score, blockers, cover letter draft,
            and next steps for this specific application.
          </p>
        </div>
      </section>

      <section id="matcher" className="px-5 py-8 md:px-8 lg:px-10">
        <div className="mx-auto max-w-4xl rounded-md bg-white p-5 shadow-[0_24px_70px_rgba(4,56,115,0.16)] md:p-7">
          <form onSubmit={analyzeRole}>
            <div>
              <div>
                <h2 className="text-2xl font-extrabold text-[#212529]">Upload your resume</h2>
                <p className="mt-3 text-sm leading-6 text-[#4F5F6F]">
                  Upload your resume, import a job URL when available, or paste the job description directly below if the page blocks extraction.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-5">
              <div className={`rounded-md border border-[#DDE8F6] bg-[#F8FBFF] p-5 ${resumeFileName ? "grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center" : "text-center"}`}>
                {resumeFileName ? (
                  <div className="min-w-0 text-left">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#4F9CF9]">Resume uploaded</p>
                    <p className="mt-1 truncate text-sm font-extrabold text-[#043873]">{resumeFileName}</p>
                  </div>
                ) : null}
                <label className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#043873] px-5 text-sm font-extrabold text-white transition hover:bg-[#0b4c97]">
                  {isExtractingResume ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Upload size={17} aria-hidden="true" />}
                  {isExtractingResume ? "Reading resume" : resumeFileName ? "Replace Resume PDF" : "Upload Resume PDF"}
                  <input className="hidden" type="file" accept="application/pdf" onChange={extractResumeFromPdf} />
                </label>
              </div>

              <div className="rounded-md border border-[#DDE8F6] bg-[#F8FBFF] p-5">
                <p className="flex items-center gap-2 text-sm font-extrabold text-[#212529]">
                  <Link size={17} className="text-[#4F9CF9]" aria-hidden="true" />
                  Paste the URL of the job ad
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <input
                    value={jobUrl}
                    onChange={(event) => setJobUrl(event.target.value)}
                    className="h-12 min-w-0 rounded-md border border-[#DDE8F6] bg-white px-4 text-sm outline-none transition focus:border-[#4F9CF9] focus:ring-4 focus:ring-[#4F9CF9]/15"
                    placeholder="https://company.com/careers/job-posting"
                  />
                  <button
                    type="button"
                    onClick={importJobFromUrl}
                    disabled={isImportingJob}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#043873] px-5 text-sm font-extrabold text-white transition hover:bg-[#0b4c97] disabled:cursor-not-allowed disabled:bg-[#A7CEFC]"
                  >
                    {isImportingJob ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Link size={17} aria-hidden="true" />}
                    Import job
                  </button>
                </div>
                <p className="mt-4 text-sm leading-6 text-[#4F5F6F]">
                  URL import works best on company career pages and public ATS pages. If a job board blocks extraction, copy the job description from the page and paste it into the job description box below.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <InputPanel icon={FileText} label="Resume text" value={resume} onChange={setResume} placeholder="Resume text appears here after upload. You can also paste it manually." compact />
              <InputPanel icon={FileText} label="Job description" value={job} onChange={setJob} placeholder="Import a job URL above, or paste the job description here." compact />
            </div>

            {message ? <p className="mt-4 text-sm font-semibold text-[#007a52]">{message}</p> : null}
            {error ? <p className="mt-4 text-sm font-semibold text-[#b00000]">{error}</p> : null}

            <button
              type="submit"
              disabled={!canAnalyze || isLoading}
              className="mt-6 inline-flex h-14 w-full cursor-pointer items-center justify-center rounded-md bg-[#043873] px-5 text-base font-extrabold text-white transition hover:bg-[#0b4c97] disabled:cursor-not-allowed disabled:bg-[#A7CEFC]"
            >
              {isLoading ? "Generating Fit Report" : "Generate Fit Report"}
            </button>
          </form>
        </div>
      </section>

      {result ? (
        <section id="report" className="px-5 py-10 md:px-8 md:py-14 lg:px-10">
          <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[0.92fr_1.08fr]">
            <section className="flex flex-col rounded-md bg-white p-5 shadow-[0_18px_60px_rgba(4,56,115,0.1)] md:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-[#4F9CF9]">Recommended move</p>
                  <h2 className="mt-2 text-4xl font-extrabold text-[#043873]">{result.decision}</h2>
              <p className="mt-1 text-sm font-semibold text-[#4F5F6F]">{result.level}</p>
                </div>
                <div className="grid size-24 place-items-center rounded-md bg-[#FFE492] text-4xl font-extrabold text-[#043873]">
                  {result.score}
                </div>
              </div>

              <div className="mt-5 w-fit max-w-full rounded-md border border-[#DDE8F6] bg-white px-3 py-2 text-sm font-bold text-[#043873]">
                Salary: {result.salary || "Not available"}
              </div>

              <p className="mt-6 text-sm leading-7 text-[#4F5F6F]">
                {isPreparingReport ? "Preparing your personalized report..." : <SummaryText text={result.summary} />}
              </p>

              <RequirementAlert findings={result.hardRequirements ?? []} />

              <div className="mt-5 rounded-md border border-[#A7CEFC] bg-[#F8FBFF] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#043873]">Next best action</p>
                <p className="mt-2 text-sm font-bold leading-6 text-[#212529]">
                  {isPreparingReport ? "Reviewing your resume and this job description." : result.nextStep}
                </p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <MiniMetric label="Confidence" value={result.confidence} />
                <MiniMetric label="Time" value={result.timeToApply} />
                <MiniMetric label="Headline" value={result.keywordPlan.headline || "Role fit"} />
              </div>

              <div className="mt-auto flex flex-wrap gap-2 pt-5">
                <button
                  type="button"
                  onClick={copyReport}
                  className="inline-flex h-11 grow cursor-pointer items-center justify-center gap-2 rounded-md bg-[#043873] px-4 text-sm font-bold text-white transition hover:bg-[#0b4c97]"
                >
                  <Clipboard size={16} aria-hidden="true" />
                  Copy report
                </button>
                <button
                  type="button"
                  onClick={downloadReport}
                  className="inline-flex h-11 grow cursor-pointer items-center justify-center gap-2 rounded-md border border-[#FFE492] bg-white px-4 text-sm font-bold text-[#043873] transition hover:bg-[#FFE492]"
                >
                  <Download size={16} aria-hidden="true" />
                  Export
                </button>
              </div>
            </section>

            <section className="rounded-md bg-white p-5 shadow-[0_18px_60px_rgba(4,56,115,0.1)] md:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-extrabold text-[#212529]">Fit details</h2>
                  <p className="mt-1 text-sm text-[#4F5F6F]">Evidence behind the recommendation.</p>
                </div>
                <span className="rounded-md bg-[#FFE492] px-3 py-2 text-sm font-bold text-[#043873]">
                  {result.score}% fit
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {result.scoreBreakdown.map((item) => (
                  <MiniMetric key={item.label} label={item.label} value={item.value} detail={item.detail} />
                ))}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <DetailGroup title="Matched skills" icon={<CheckCircle2 size={16} />} items={result.matchedSkills} tone="match" />
                <DetailGroup title="Gaps to cover" icon={<Target size={16} />} items={result.missingSkills} tone="gap" />
              </div>

              {result.fitReasoning?.length ? (
                <div className="mt-5 rounded-md border border-[#DDE8F6] bg-[#F8FBFF] p-4">
                  <h3 className="text-sm font-bold text-[#212529]">Our reasoning</h3>
                  <ul className="mt-3 grid gap-2 text-sm leading-6 text-[#4F5F6F]">
                    {result.fitReasoning.slice(0, 4).map((item) => (
                      <li key={item} className="flex gap-2">
                        <CheckCircle2 size={15} className="mt-1 shrink-0 text-[#4F9CF9]" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          </div>
        </section>
      ) : null}

      {result ? (
        <section id="application-kit" className="bg-[#043873] px-5 py-10 text-white md:px-8 md:py-14 lg:px-10">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <p className="text-sm font-bold uppercase text-[#A7CEFC]">Cover letter kit</p>
              <h2 className="mt-3 text-4xl font-extrabold leading-tight">
                Write the cover letter around the strongest evidence.
              </h2>
              <p className="mt-4 text-sm leading-7 text-white/82">
                RoleGuage uses the job ad, your resume evidence, and your fit report to draft a plain,
                role-specific cover letter. Resume bullets and interview notes sit underneath as supporting material.
              </p>
            </div>
            <div className="grid gap-5">
              <section className="rounded-md border border-[#DDE8F6] bg-white p-5 text-[#212529] shadow-[0_14px_40px_rgba(4,56,115,0.12)]">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-extrabold">Cover letter draft</h3>
                  <button
                    type="button"
                    onClick={copyCoverLetter}
                    disabled={!coverLetter}
                    className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      copiedCoverLetter
                        ? "border-[#0F7A57] bg-[#0F7A57] text-white"
                        : "border-[#A7CEFC] text-[#043873] hover:bg-[#A7CEFC]/20"
                    }`}
                  >
                    {copiedCoverLetter ? <Check size={16} aria-hidden="true" /> : <Clipboard size={16} aria-hidden="true" />}
                    {copiedCoverLetter ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="mt-4 whitespace-pre-line rounded-md border border-[#DDE8F6] bg-[#F8FBFF] p-4 text-sm leading-7 text-[#4F5F6F]">
                  {isPreparingReport
                    ? "Writing a role-specific cover letter from your resume evidence..."
                    : coverLetter || "The cover letter could not be generated this time. Try generating the report again."}
                </div>
              </section>
              <div className="grid gap-5 lg:grid-cols-2">
                <ApplicationKitCard title="Resume bullet ideas" items={result.resumeBullets} />
                <ApplicationKitCard title="Interview prep" items={result.interviewPrep} />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div className="h-12 bg-[#F8FBFF]" />
      <SharedFooter />
    </main>
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
        className={`${compact ? "min-h-44 md:min-h-52" : "min-h-64 md:min-h-80"} resize-y rounded-md border border-[#DDE8F6] bg-[#F8FBFF] p-4 text-sm leading-7 outline-none transition placeholder:text-[#7A8795] focus:border-[#4F9CF9] focus:bg-white focus:ring-4 focus:ring-[#4F9CF9]/15`}
        placeholder={placeholder}
      />
    </label>
  );
}

function MiniMetric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-md border border-[#DDE8F6] bg-white p-3">
      <p className="text-base font-extrabold text-[#043873]">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase text-[#4F5F6F]">{label}</p>
      {detail ? <p className="mt-1 text-xs leading-5 text-[#4F5F6F]">{detail}</p> : null}
    </div>
  );
}

function SummaryText({ text }: { text: string }) {
  const parts = text.split(/(not a good fit|Australian or New Zealand citizenship or permanent residency|Australian or New Zealand Citizen, or Australian Permanent Resident|Australian citizenship or permanent residency|citizenship\/PR|citizenship or permanent residency)/gi);

  return (
    <>
      {parts.map((part, index) => {
        if (/not a good fit/i.test(part)) {
          const [notWord, ...rest] = part.split(/\s+/);

          return (
            <span key={`${part}-${index}`}>
              <strong className="text-[#B5121B]">{notWord}</strong>{" "}
              <span>{rest.join(" ")}</span>
            </span>
          );
        }

        if (/Australian or New Zealand citizenship or permanent residency|Australian or New Zealand Citizen, or Australian Permanent Resident|Australian citizenship or permanent residency/i.test(part)) {
          return (
            <strong key={`${part}-${index}`} className="text-[#B5121B]">
              {part}
            </strong>
          );
        }

        if (/citizenship\/PR|citizenship or permanent residency/i.test(part)) {
          return (
            <strong key={`${part}-${index}`} className="text-[#043873]">
              {part}
            </strong>
          );
        }

        return <span key={`${part}-${index}`}>{part}</span>;
      })}
    </>
  );
}

function RequirementAlert({
  findings,
}: {
  findings: RequirementFinding[];
}) {
  const visibleFindings = findings.filter((finding) => finding.status !== "matched");
  const primary = visibleFindings[0];

  if (!primary) return null;

  const isBlocker = primary?.status === "blocked";
  const title = primary
    ? isBlocker
      ? "Likely blocker"
      : primary.severity === "hard"
        ? "Check before applying"
        : "Requirement to check"
    : "Salary listed";

  return (
    <div
      className={`mt-5 rounded-md border p-4 ${
        isBlocker ? "border-[#B5121B] bg-[#FFF1F2]" : "border-[#FFE492] bg-[#FFF8DD]"
      }`}
    >
      <div className="grid gap-3">
        <div className="min-w-0">
          <p className={`text-xs font-bold uppercase tracking-[0.16em] ${isBlocker ? "text-[#B5121B]" : "text-[#7A5900]"}`}>
            {title}
          </p>
          {primary ? <p className="mt-2 text-sm font-bold leading-6 text-[#212529]">{primary.message}</p> : null}
          {primary?.jobEvidence ? (
            <p className="mt-2 text-xs leading-5 text-[#4F5F6F]">Job says: {primary.jobEvidence}</p>
          ) : null}
          {visibleFindings.length > 1 ? (
            <p className="mt-2 text-xs font-semibold text-[#4F5F6F]">
              {visibleFindings.length - 1} more requirement{visibleFindings.length > 2 ? "s" : ""} to check.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DetailGroup({
  title,
  icon,
  items,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  tone: "match" | "gap";
}) {
  const chipClass =
    tone === "match"
      ? "border-[#A7CEFC] bg-white text-[#043873]"
      : "border-[#FFE492] bg-[#FFE492] text-[#043873]";

  return (
    <section className="rounded-md border border-[#DDE8F6] bg-[#F8FBFF] p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold text-[#212529]">
        <span className="text-[#043873]">{icon}</span>
        {title}
      </h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.length ? (
          items.slice(0, 8).map((item) => (
            <span key={item} className={`rounded-md border px-3 py-1.5 text-xs font-bold ${chipClass}`}>
              {item}
            </span>
          ))
        ) : (
          <span className="rounded-md border border-[#DDE8F6] bg-white px-3 py-1.5 text-xs font-bold text-[#4F5F6F]">
            None
          </span>
        )}
      </div>
    </section>
  );
}

function ApplicationKitCard({ title, items }: { title: string; items: string[] }) {
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

function PricingCard({
  name,
  price,
  copy,
  items,
  featured,
}: {
  name: string;
  price: string;
  copy: string;
  items: string[];
  featured: boolean;
}) {
  const isPaid = price !== "$0";

  return (
    <article
      className={`rounded-md border p-7 shadow-[0_14px_40px_rgba(4,56,115,0.08)] ${
        featured
          ? "border-[#043873] bg-[#043873] text-white"
          : "border-[#FFE492] bg-white text-[#212529]"
      }`}
    >
      <h3 className="text-2xl font-extrabold">{name}</h3>
      <p className={`mt-5 text-sm leading-7 ${featured ? "text-white/82" : "text-[#4F5F6F]"}`}>{copy}</p>
      <p className={`mt-9 text-4xl font-extrabold ${featured ? "text-white" : "text-[#212529]"}`}>{price}</p>
      <ul className="mt-8 grid gap-4">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-sm font-semibold leading-6">
            <Check size={17} className={`mt-1 shrink-0 ${featured ? "text-[#FFE492]" : "text-[#043873]"}`} aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      {isPaid ? (
        <button
          type="button"
          disabled
          className={`mt-9 inline-flex h-12 cursor-not-allowed items-center justify-center rounded-md px-5 text-sm font-bold ${
            featured ? "bg-white/18 text-white/70" : "border border-[#DDE8F6] bg-[#F1F5FA] text-[#6B7886]"
          }`}
        >
          Coming soon
        </button>
      ) : (
        <a
          href="#matcher"
          className="mt-9 inline-flex h-12 cursor-pointer items-center justify-center rounded-md border border-[#FFE492] bg-white px-5 text-sm font-bold text-[#043873] transition hover:bg-[#FFE492]"
        >
          Get started
        </a>
      )}
    </article>
  );
}

function saveMatchToHistory(result: AnalysisResult, jobMeta: JobMeta) {
  if (typeof window === "undefined") return;

  const item: MatchHistoryItem = {
    id: `${slugify(jobMeta.title || "role")}-${Date.now()}`,
    savedAt: new Date().toISOString(),
    jobMeta,
    result,
  };
  const existing = readMatchHistory();
  const withoutSameRole = existing.filter(
    (historyItem) =>
      `${historyItem.jobMeta.title}-${historyItem.jobMeta.company}` !== `${jobMeta.title}-${jobMeta.company}`,
  );

  window.localStorage.setItem(matchHistoryStorageKey, JSON.stringify([item, ...withoutSameRole].slice(0, 30)));
}

function readMatchHistory() {
  try {
    const raw = window.localStorage.getItem(matchHistoryStorageKey) ?? "[]";
    const parsed = JSON.parse(raw) as MatchHistoryItem[];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readCandidateProfile(): CandidateProfile {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(candidateProfileStorageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CandidateProfile;

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function readCoverLetterPreferences() {
  if (typeof window === "undefined") return "";

  return cleanCoverLetterPreferences(window.localStorage.getItem(coverLetterPreferencesStorageKey) ?? "");
}

function readCoverLetterExamples() {
  if (typeof window === "undefined") return [];

  try {
    return cleanCoverLetterExamples(JSON.parse(window.localStorage.getItem(coverLetterExamplesStorageKey) ?? "[]"));
  } catch {
    return [];
  }
}

function hasHardBlocker(result: AnalysisResult) {
  return Boolean(
    result.hardRequirements?.some((finding) => finding.status === "blocked" && finding.severity === "hard"),
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
    "",
    "Summary",
    result.summary,
    "",
    "Matched Skills",
    result.matchedSkills.length ? result.matchedSkills.map((item) => `- ${item}`).join("\n") : "- None detected",
    "",
    "Gaps To Cover",
    result.missingSkills.length ? result.missingSkills.map((item) => `- ${item}`).join("\n") : "- None detected",
    "",
    "Resume Bullet Ideas",
    ...result.resumeBullets.map((item) => `- ${item}`),
    "",
    "Cover Letter Draft",
    result.coverLetter?.trim() || "No cover letter was generated for this report.",
  ].join("\n");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
