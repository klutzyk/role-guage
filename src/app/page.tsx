"use client";

import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronDown,
  FileText,
  Gauge,
  Link,
  Loader2,
  Menu,
  Network,
  Plus,
  Radar,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";

type AnalysisResult = {
  score: number;
  level: string;
  matchedSkills: string[];
  missingSkills: string[];
  roleSignals: string[];
  bullets: string[];
  summary: string;
};

type ImportedJob = {
  title: string;
  company: string;
  location: string;
  description: string;
  sourceUrl: string;
};

type InputMode = "import" | "paste";

const sampleResume = `Software Engineer with 4 years of experience building web applications, REST APIs, dashboards, and data pipelines. Skilled in Python, TypeScript, React, PostgreSQL, machine learning, data analysis, cloud deployment, and stakeholder communication. Completed a Master of Data Science in Australia with projects in NLP, predictive modelling, and business analytics.`;

const sampleJob = `We are hiring a Data Analyst / AI Product Engineer in Sydney. The role requires Python, SQL, dashboards, machine learning, stakeholder communication, experimentation, API integration, and experience turning messy business data into actionable insights. Knowledge of React, cloud platforms, and LLM tools is a strong advantage.`;

const featureCards: Array<[string, string, LucideIcon]> = [
  ["Role fit score", "Compare your evidence against the job ad before you spend another hour applying.", Gauge],
  ["Skill gap map", "Separate must-have gaps from nice-to-have noise with a clear priority list.", Target],
  ["Resume rewrite", "Turn your existing projects into focused bullets for each target role.", FileText],
];

const processCards = [
  ["1", "Paste evidence", "Start with your resume summary, projects, or LinkedIn profile notes."],
  ["2", "Add job ad", "RoleReady extracts the skills, signals, and employer priorities."],
  ["3", "Apply sharper", "Use the report to decide, rewrite, and track your next move."],
];

const plans = [
  {
    name: "Starter",
    price: "$0",
    copy: "For testing job fit and creating a portfolio demo.",
    items: ["3 sample analyses", "Skill gap report", "Resume bullet suggestions"],
    featured: false,
  },
  {
    name: "Job Search",
    price: "$19",
    copy: "For active applicants who want targeted applications.",
    items: ["Unlimited role checks", "Saved application tracker", "PDF fit report", "Priority skill plan"],
    featured: true,
  },
  {
    name: "Coaching",
    price: "$99",
    copy: "For a manual audit layered on top of the matching report.",
    items: ["Full profile review", "Target role strategy", "Project recommendations"],
    featured: false,
  },
];

const testimonials = [
  ["This made it obvious which jobs I should stop wasting time on.", "Graduate data analyst"],
  ["The skill gap section gave me a better portfolio project direction.", "Software engineer"],
  ["The tailored bullets were stronger than my generic resume version.", "International graduate"],
];

const dataPrinciples: Array<[string, LucideIcon]> = [
  ["Resume", FileText],
  ["Role score", BarChart3],
  ["Application", BriefcaseBusiness],
];

const dataMetrics: Array<[string, string, LucideIcon]> = [
  ["Applications", "24", BriefcaseBusiness],
  ["Strong fits", "8", ShieldCheck],
  ["Skill gaps", "11", Target],
  ["Contacts", "16", Users],
];

export default function Home() {
  const [resume, setResume] = useState(sampleResume);
  const [job, setJob] = useState(sampleJob);
  const [jobUrl, setJobUrl] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("import");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isImportingJob, setIsImportingJob] = useState(false);
  const [isExtractingResume, setIsExtractingResume] = useState(false);
  const [error, setError] = useState("");
  const [importMessage, setImportMessage] = useState("");

  const canAnalyze = useMemo(
    () => resume.trim().length > 80 && job.trim().length > 80,
    [resume, job],
  );

  async function analyzeRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, job }),
      });

      if (!response.ok) {
        throw new Error("Analysis failed");
      }

      const data = (await response.json()) as AnalysisResult;
      setResult(data);
    } catch {
      setError("RoleReady could not analyze this role yet. Try again.");
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

      const heading = [data.title, data.company, data.location]
        .filter(Boolean)
        .join(" | ");
      setJob(heading ? `${heading}\n\n${data.description}` : data.description);
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

  const activeResult =
    result ??
    ({
      score: 78,
      level: "Strong match",
      matchedSkills: ["Python", "SQL", "React", "PostgreSQL", "Machine learning"],
      missingSkills: ["Experimentation", "LLM tools", "Cloud platforms"],
      roleSignals: ["Sydney", "AI product", "Stakeholder-facing", "Dashboards"],
      bullets: [
        "Built data-backed web applications using Python, TypeScript, React, and PostgreSQL.",
        "Created dashboards and analytics workflows that convert messy business data into clear decisions.",
        "Move NLP and predictive modelling projects higher when the role asks for applied data science.",
      ],
      summary:
        "Your profile is credible for this role. Emphasize data products, stakeholder outcomes, and the strongest matched skills before applying.",
    } satisfies AnalysisResult);

  return (
    <main className="min-h-screen bg-white text-[#212529]">
      <section className="blue-wave bg-[#043873] text-white">
        <div className="mx-auto max-w-7xl px-5 py-4 md:px-8 lg:px-10">
          <nav className="flex items-center justify-between gap-4">
            <a href="#" className="flex items-center gap-2 font-bold">
              <span className="grid size-8 place-items-center rounded-md bg-white text-[#043873]">
                <Radar size={20} aria-hidden="true" />
              </span>
              <span className="text-xl">RoleReady</span>
            </a>

            <div className="hidden items-center gap-8 text-sm lg:flex">
              {["Product", "Solutions", "Resources", "Pricing"].map((item) => (
                <a key={item} href={`#${item.toLowerCase()}`} className="inline-flex items-center gap-1 text-white/90 hover:text-white">
                  {item}
                  <ChevronDown size={14} aria-hidden="true" />
                </a>
              ))}
            </div>

            <div className="hidden items-center gap-3 md:flex">
              <a href="#analyze" className="rounded-md bg-[#FFE492] px-5 py-3 text-sm font-semibold text-[#043873] transition hover:bg-[#ffdc6d]">
                Login
              </a>
              <a href="#analyze" className="inline-flex items-center gap-2 rounded-md bg-[#4F9CF9] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3b8dea]">
                Try RoleReady free
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>

            <button className="grid size-10 place-items-center rounded-md bg-white/10 md:hidden" aria-label="Open navigation">
              <Menu size={22} aria-hidden="true" />
            </button>
          </nav>

          <div className="grid gap-10 py-14 md:py-20 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:py-28">
            <div>
              <h1 className="max-w-2xl text-4xl font-extrabold leading-tight md:text-6xl">
                Get more done with every job application
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-white/85">
                RoleReady matches resume evidence against real job ads, reveals skill gaps, and helps candidates decide where to apply.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#analyze" className="inline-flex items-center justify-center gap-2 rounded-md bg-[#4F9CF9] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#3b8dea]">
                  Try RoleReady free
                  <ArrowRight size={17} aria-hidden="true" />
                </a>
                <a href="#product" className="inline-flex items-center justify-center rounded-md border border-white/30 px-6 py-4 text-sm font-semibold text-white transition hover:bg-white/10">
                  See how it works
                </a>
              </div>
            </div>
            <HeroMockup score={activeResult.score} />
          </div>
        </div>
      </section>

      <section id="product" className="overflow-hidden py-16 md:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 md:px-8 lg:grid-cols-2 lg:items-center lg:px-10">
          <div>
            <h2 className="max-w-lg text-4xl font-extrabold leading-tight md:text-5xl">
              Application <span className="yellow-mark">intelligence</span>
            </h2>
            <p className="mt-5 max-w-xl leading-8 text-[#4F5F6F]">
              Stop treating every job ad the same. RoleReady reads the actual requirements and turns them into a practical application plan.
            </p>
            <a href="#analyze" className="mt-7 inline-flex items-center gap-2 rounded-md bg-[#4F9CF9] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#3b8dea]">
              Get started
              <ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {featureCards.map(([title, copy, Icon]) => (
              <article key={title} className="rounded-md border border-[#E4EDF8] bg-white p-6 shadow-[0_14px_40px_rgba(4,56,115,0.08)]">
                <span className="grid size-11 place-items-center rounded-md bg-[#A7CEFC]/45 text-[#043873]">
                  <Icon size={21} aria-hidden="true" />
                </span>
                <h3 className="mt-7 text-xl font-bold">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#4F5F6F]">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-10 md:py-16">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 md:px-8 lg:grid-cols-2 lg:items-center lg:px-10">
          <OrbitVisual />
          <div>
            <h2 className="max-w-lg text-4xl font-extrabold leading-tight md:text-5xl">
              Work <span className="yellow-mark">together</span> with real evidence
            </h2>
            <p className="mt-5 max-w-xl leading-8 text-[#4F5F6F]">
              Use one workspace for resume proof, job requirements, skill gaps, and the next action for each application.
            </p>
            <div className="mt-7 grid gap-3">
              {processCards.map(([step, title, copy]) => (
                <div key={step} className="flex gap-4 rounded-md border border-[#E4EDF8] bg-white p-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#4F9CF9] text-sm font-bold text-white">{step}</span>
                  <div>
                    <h3 className="font-bold">{title}</h3>
                    <p className="mt-1 text-sm leading-6 text-[#4F5F6F]">{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="analyze" className="blue-wave bg-[#043873] py-16 text-white md:py-24">
        <div className="mx-auto max-w-7xl px-5 md:px-8 lg:px-10">
          <div className="mb-10 grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <h2 className="text-4xl font-extrabold leading-tight md:text-5xl">
                Use as your application command center
              </h2>
              <p className="mt-5 max-w-2xl leading-8 text-white/82">
                Paste your resume evidence and the job ad. The demo backend scores the match immediately, then returns skill gaps and tailored bullets.
              </p>
            </div>
            <div className="rounded-md bg-white/10 p-4 text-sm leading-7 text-white/80">
              This MVP uses a transparent matching engine. It is consistent, fast, explainable, and ready for demos now without paid model usage.
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.04fr_0.96fr]">
            <form onSubmit={analyzeRole} className="rounded-md bg-white p-5 text-[#212529] shadow-[0_18px_60px_rgba(0,0,0,0.22)] md:p-7">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-extrabold">Role matcher</h3>
                  <p className="mt-2 text-sm leading-6 text-[#4F5F6F]">
                    Use the sample content or paste your own resume and job ad.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setResume("");
                    setJob("");
                    setJobUrl("");
                    setResult(null);
                    setError("");
                    setImportMessage("");
                  }}
                  className="grid size-10 shrink-0 place-items-center rounded-md border border-[#DDE8F6] text-[#043873] transition hover:bg-[#F4F8FF]"
                  title="Start new analysis"
                  aria-label="Start new analysis"
                >
                  <Plus size={18} aria-hidden="true" />
                </button>
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
                      <div className="mb-3 flex items-center gap-2 text-sm font-bold">
                        <Upload size={16} className="text-[#4F9CF9]" aria-hidden="true" />
                        Resume PDF import
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <label className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#043873] px-4 text-sm font-bold text-white transition hover:bg-[#0b4c97]">
                          {isExtractingResume ? <Loader2 className="animate-spin" size={17} aria-hidden="true" /> : <Upload size={17} aria-hidden="true" />}
                          {isExtractingResume ? "Extracting PDF" : "Upload resume PDF"}
                          <input
                            type="file"
                            accept="application/pdf"
                            className="sr-only"
                            onChange={extractResumeFromPdf}
                            disabled={isExtractingResume}
                          />
                        </label>
                        <p className="text-sm leading-6 text-[#4F5F6F]">
                          Upload a text-based PDF resume, then review the extracted text below.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-md border border-[#DDE8F6] bg-[#F8FBFF] p-4">
                      <label className="mb-3 flex items-center gap-2 text-sm font-bold" htmlFor="job-url">
                        <Link size={16} className="text-[#4F9CF9]" aria-hidden="true" />
                        Job URL import
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
                {isLoading ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : <Sparkles size={18} aria-hidden="true" />}
                {isLoading ? "Analyzing role" : "Generate fit report"}
              </button>
            </form>

            <aside className="grid gap-5">
              <section className="rounded-md bg-white p-5 text-[#212529] shadow-[0_18px_60px_rgba(0,0,0,0.16)] md:p-7">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-[#4F9CF9]">Match signal</p>
                    <h3 className="mt-2 text-3xl font-extrabold">{activeResult.level}</h3>
                  </div>
                  <div className="grid size-24 place-items-center rounded-md bg-[#FFE492] text-[#043873]">
                    <span className="text-4xl font-extrabold">{activeResult.score}</span>
                  </div>
                </div>
                <p className="mt-5 leading-8 text-[#4F5F6F]">{activeResult.summary}</p>
              </section>

              <section className="grid gap-4 rounded-md bg-white p-5 text-[#212529] shadow-[0_18px_60px_rgba(0,0,0,0.16)] md:p-7">
                <ResultBlock title="Matched skills" icon={CheckCircle2} items={activeResult.matchedSkills} tone="match" />
                <ResultBlock title="Gaps to cover" icon={Target} items={activeResult.missingSkills} tone="gap" />
                <ResultBlock title="Role signals" icon={Network} items={activeResult.roleSignals} tone="signal" />
              </section>
            </aside>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-5 md:px-8 lg:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-extrabold leading-tight md:text-5xl">
              Choose your <span className="yellow-mark">plan</span>
            </h2>
            <p className="mt-5 leading-8 text-[#4F5F6F]">
              Keep the MVP free while the product proves demand, then turn the same workflow into reports and saved workspaces.
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

      <section className="blue-wave bg-[#043873] py-16 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 md:px-8 lg:grid-cols-2 lg:items-center lg:px-10">
          <div>
            <h2 className="text-4xl font-extrabold leading-tight md:text-5xl">
              Your work, everywhere you are
            </h2>
            <p className="mt-5 max-w-2xl leading-8 text-white/82">
              The future version can save every analysis, every target role, and every application decision in one workspace.
            </p>
            <a href="#analyze" className="mt-7 inline-flex items-center gap-2 rounded-md bg-[#4F9CF9] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#3b8dea]">
              Try it now
              <ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>
          <DataVisual />
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-5 md:px-8 lg:px-10">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <h2 className="text-4xl font-extrabold leading-tight md:text-5xl">
                100% your <span className="yellow-mark">data</span>
              </h2>
              <p className="mt-5 leading-8 text-[#4F5F6F]">
                RoleReady is built as a job-search workspace first. You decide what to paste, analyze, save, and export.
              </p>
              <a href="#analyze" className="mt-7 inline-flex items-center gap-2 rounded-md bg-[#4F9CF9] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#3b8dea]">
                Learn more
              </a>
            </div>
            <div className="grid gap-4 rounded-md border border-[#E4EDF8] bg-[#F8FBFF] p-6 sm:grid-cols-3">
              {dataPrinciples.map(([label, Icon]) => (
                <div key={String(label)} className="rounded-md bg-white p-5 text-center shadow-[0_10px_30px_rgba(4,56,115,0.08)]">
                  <Icon className="mx-auto text-[#4F9CF9]" size={28} aria-hidden="true" />
                  <p className="mt-3 text-sm font-bold">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-16 text-center">
            <h2 className="text-3xl font-extrabold">
              Our <span className="yellow-mark">signals</span>
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {["Python", "SQL", "React", "Machine Learning"].map((signal) => (
                <div key={signal} className="rounded-md border border-[#E4EDF8] px-5 py-4 font-semibold text-[#043873]">
                  {signal}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#F8FBFF] py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-5 md:px-8 lg:px-10">
          <h2 className="text-center text-4xl font-extrabold">
            What early users <span className="yellow-mark">say</span>
          </h2>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {testimonials.map(([quote, person], index) => (
              <article key={quote} className={`rounded-md p-7 shadow-[0_14px_40px_rgba(4,56,115,0.08)] ${index === 1 ? "bg-[#4F9CF9] text-white" : "bg-white text-[#212529]"}`}>
                <p className="text-6xl font-extrabold leading-none text-[#043873]/25">“</p>
                <p className={`mt-2 leading-8 ${index === 1 ? "text-white" : "text-[#4F5F6F]"}`}>{quote}</p>
                <div className="mt-7 flex items-center gap-3 border-t border-current/15 pt-5">
                  <span className="grid size-11 place-items-center rounded-md bg-[#FFE492] text-sm font-bold text-[#043873]">{person.charAt(0)}</span>
                  <p className="text-sm font-bold">{person}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="blue-wave bg-[#043873] text-white">
        <div className="mx-auto max-w-7xl px-5 py-14 text-center md:px-8 lg:px-10">
          <h2 className="text-4xl font-extrabold">Try RoleReady today</h2>
          <p className="mx-auto mt-5 max-w-xl leading-8 text-white/82">
            Use the MVP, improve the matching workflow, then add auth, database storage, PDF upload, and optional writing assistance when the product is ready.
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
              RoleReady
            </a>
            <p>Resume fit scoring, skill-gap analysis, and targeted application support.</p>
          </div>
        </div>
      </footer>
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
        className={`${compact ? "min-h-32" : "min-h-40"} resize-y rounded-md border border-[#DDE8F6] bg-[#F8FBFF] p-4 text-sm leading-7 outline-none transition focus:border-[#4F9CF9] focus:bg-white focus:ring-4 focus:ring-[#4F9CF9]/15`}
        placeholder={placeholder}
      />
    </label>
  );
}

function ResultBlock({
  title,
  icon: Icon,
  items,
  tone,
}: {
  title: string;
  icon: LucideIcon;
  items: string[];
  tone: "match" | "gap" | "signal";
}) {
  const chipClass = {
    match: "border-[#A7CEFC] bg-[#EAF4FF] text-[#043873]",
    gap: "border-[#FFE492] bg-[#FFF4C2] text-[#5F4700]",
    signal: "border-[#A7CEFC] bg-[#F4F9FF] text-[#043873]",
  }[tone];

  return (
    <div className="border-b border-[#DDE8F6] pb-5 last:border-b-0 last:pb-0">
      <h3 className="mb-4 flex items-center gap-3 text-lg font-extrabold text-[#212529]">
        <span className="grid size-6 place-items-center rounded-full border border-[#4F9CF9] text-[#4F9CF9]">
          <Icon size={14} strokeWidth={2.5} aria-hidden="true" />
        </span>
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">
        {items.length ? (
          items.map((item) => (
            <span key={item} className={`rounded-md border px-4 py-2 text-sm font-bold ${chipClass}`}>
              {item}
            </span>
          ))
        ) : (
          <span className="rounded-md border border-[#DDE8F6] bg-white px-4 py-2 text-sm font-bold text-[#4F5F6F]">
            No strong signals found yet
          </span>
        )}
      </div>
    </div>
  );
}

function HeroMockup({ score }: { score: number }) {
  return (
    <div className="rounded-md bg-[#CFE3FF] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.2)]">
      <div className="rounded-md bg-white p-5 text-[#212529]">
        <div className="flex items-center justify-between border-b border-[#E4EDF8] pb-4">
          <div>
            <p className="text-sm font-bold text-[#043873]">AI Product Engineer</p>
            <p className="mt-1 text-xs text-[#4F5F6F]">Sydney · Hybrid · Data product</p>
          </div>
          <span className="rounded-md bg-[#FFE492] px-4 py-2 text-lg font-extrabold text-[#043873]">{score}%</span>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-[0.8fr_1.2fr]">
          <div className="grid gap-3">
            {["Python", "SQL", "React"].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-md bg-[#F8FBFF] p-3 text-sm font-semibold">
                <CheckCircle2 size={16} className="text-[#4F9CF9]" aria-hidden="true" />
                {item}
              </div>
            ))}
          </div>
          <div className="rounded-md bg-[#F8FBFF] p-4">
            <div className="mb-4 h-3 w-32 rounded-md bg-[#A7CEFC]" />
            <div className="grid gap-2">
              <div className="h-3 rounded-md bg-[#DDEBFF]" />
              <div className="h-3 w-10/12 rounded-md bg-[#DDEBFF]" />
              <div className="h-3 w-8/12 rounded-md bg-[#DDEBFF]" />
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="h-16 rounded-md bg-[#4F9CF9]" />
              <div className="h-16 rounded-md bg-[#FFE492]" />
              <div className="h-16 rounded-md bg-[#043873]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrbitVisual() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-md">
      <div className="absolute inset-10 rounded-full border border-dashed border-[#A7CEFC]" />
      <div className="absolute inset-24 rounded-full border border-dashed border-[#A7CEFC]" />
      <div className="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-md bg-white text-[#4F9CF9] shadow-[0_14px_40px_rgba(4,56,115,0.12)]">
        <Radar size={30} aria-hidden="true" />
      </div>
      {[
        ["left-[8%] top-[48%]", "#ff5757"],
        ["left-[18%] top-[20%]", "#FFE492"],
        ["right-[12%] top-[22%]", "#4F9CF9"],
        ["right-[9%] top-[55%]", "#00C48C"],
        ["bottom-[11%] left-[28%]", "#4F9CF9"],
        ["bottom-[18%] right-[28%]", "#FFB84D"],
        ["left-[30%] top-[43%]", "#4F9CF9"],
        ["right-[30%] top-[43%]", "#4F9CF9"],
      ].map(([position, color]) => (
        <span key={position} className={`absolute size-5 rounded-full ${position}`} style={{ backgroundColor: color }} />
      ))}
    </div>
  );
}

function DataVisual() {
  return (
    <div className="rounded-md bg-white/10 p-6">
      <div className="grid grid-cols-2 gap-4">
        {dataMetrics.map(([label, value, Icon]) => (
          <div key={String(label)} className="rounded-md bg-white p-5 text-[#043873]">
            <Icon size={22} aria-hidden="true" />
            <p className="mt-5 text-3xl font-extrabold">{value}</p>
            <p className="mt-1 text-sm font-semibold text-[#4F5F6F]">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
