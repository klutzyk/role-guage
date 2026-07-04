"use client";

import { CheckCircle2, FileText, Radar, Trash2, Upload, X } from "lucide-react";
import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { SharedFooter } from "../shared-footer";

type AnalysisResult = {
  score: number;
  level: string;
  decision: "Apply" | "Tailor" | "Build" | "Skip";
  nextStep: string;
  matchedSkills: string[];
  missingSkills: string[];
  resumeBullets: string[];
  interviewPrep: string[];
  summary: string;
  coverLetter?: string;
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

const resumeProfileStorageKey = "roleguage.resume-profile.v1";
const resumeProfileNameStorageKey = "roleguage.resume-profile-name.v1";
const legacyResumeProfileStorageKey = "applypilot.resume-profile.v1";
const matchHistoryStorageKey = "roleguage.match-history.v1";
const candidateProfileStorageKey = "roleguage.candidate-profile.v1";
const workRightsOptions = [
  "Australian citizen",
  "485 visa",
  "Australian graduate temporary work visa",
  "Australian temporary visa with restrictions on work hours",
  "Australian temporary protection or safe haven enterprise work visa",
  "Require sponsorship to work for a new employer in Australia",
  "Australian family/partner visa with no restrictions",
  "Australian permanent resident and/or New Zealand citizen",
  "Australian holiday temporary work visa",
  "Australian temporary visa with no restrictions",
  "Australian temporary visa with restrictions on work location",
  "Australian temporary visa with restrictions on industry",
];
const locationOptions = [
  "Noble Park, Melbourne VIC, Australia",
  "Melbourne, VIC, Australia",
  "Sydney, NSW, Australia",
  "Brisbane, QLD, Australia",
  "Perth, WA, Australia",
  "Adelaide, SA, Australia",
  "Canberra, ACT, Australia",
  "Remote, Australia",
  "Auckland, New Zealand",
  "Wellington, New Zealand",
  "Colombo, Sri Lanka",
  "Singapore",
  "London, United Kingdom",
  "Toronto, Canada",
  "Vancouver, Canada",
  "New York, United States",
  "San Francisco, United States",
];
const workModeOptions = ["Remote", "Hybrid", "On-site", "Relocation open", "Melbourne only", "Sydney only"];
const clearanceOptions = ["None", "Baseline", "NV1", "NV2", "AGSVA eligible"];
const licenceOptions = ["Driver licence", "Working With Children Check", "Police check", "CPA", "CA", "PMP", "Real Estate Licence"];
const targetRoleOptions = ["Software Engineer", "Backend Engineer", "Full Stack Developer", "Data Analyst", "Data Scientist", "Machine Learning Engineer", "AI Engineer", "Analytics Engineer"];

export default function ProfilePage() {
  const [resume, setResume] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [history, setHistory] = useState<MatchHistoryItem[]>([]);
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile>({});
  const [selectedId, setSelectedId] = useState("");
  const [activePanel, setActivePanel] = useState<"details" | "history">("details");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selectedMatch = useMemo(
    () => history.find((item) => item.id === selectedId) ?? history[0],
    [history, selectedId],
  );

  useEffect(() => {
    const savedResume =
      window.localStorage.getItem(resumeProfileStorageKey) ??
      window.localStorage.getItem(legacyResumeProfileStorageKey) ??
      "";
    const savedHistory = readMatchHistory();
    const savedCandidateProfile = readCandidateProfile();
    const savedResumeFileName = window.localStorage.getItem(resumeProfileNameStorageKey) ?? "";

    setResume(savedResume);
    setResumeFileName(savedResumeFileName);
    setHistory(savedHistory);
    setCandidateProfile(savedCandidateProfile);
    setSelectedId(savedHistory[0]?.id ?? "");
  }, []);

  async function extractResumeFromPdf(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    setMessage("");

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
      window.localStorage.setItem(resumeProfileStorageKey, data.text);
      window.localStorage.setItem(resumeProfileNameStorageKey, data.filename ?? file.name);
      setResumeFileName(data.filename ?? file.name);
      setMessage(`Resume saved from ${data.filename ?? file.name}.`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not read this PDF.");
    }
  }

  function saveResume() {
    if (resume.trim().length < 80) {
      setError("Add resume text before saving.");
      return;
    }

    window.localStorage.setItem(resumeProfileStorageKey, resume);
    if (!resumeFileName) {
      window.localStorage.setItem(resumeProfileNameStorageKey, "Saved resume text");
      setResumeFileName("Saved resume text");
    }
    setError("");
    setMessage("Resume profile saved.");
  }

  function deleteResume() {
    window.localStorage.removeItem(resumeProfileStorageKey);
    window.localStorage.removeItem(resumeProfileNameStorageKey);
    window.localStorage.removeItem(legacyResumeProfileStorageKey);
    setResume("");
    setResumeFileName("");
    setMessage("Resume profile deleted.");
  }

  function updateCandidateProfile(field: keyof CandidateProfile, value: string) {
    setCandidateProfile((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function saveCandidateProfile() {
    window.localStorage.setItem(candidateProfileStorageKey, JSON.stringify(candidateProfile));
    setError("");
    setMessage("Candidate details saved.");
  }

  function clearCandidateProfile() {
    setCandidateProfile({});
    window.localStorage.removeItem(candidateProfileStorageKey);
    setMessage("Candidate details cleared.");
  }

  function deleteMatch(id: string) {
    const nextHistory = history.filter((item) => item.id !== id);

    setHistory(nextHistory);
    window.localStorage.setItem(matchHistoryStorageKey, JSON.stringify(nextHistory));
    setSelectedId(nextHistory[0]?.id ?? "");
  }

  function clearHistory() {
    setHistory([]);
    setSelectedId("");
    window.localStorage.removeItem(matchHistoryStorageKey);
  }

  return (
    <main className="min-h-screen bg-[#F8FBFF] text-[#212529]">
      <header className="border-b border-[#DDE8F6] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-8 lg:px-10">
          <Link href="/" className="flex items-center gap-2 font-bold text-[#043873]">
            <span className="grid size-8 place-items-center rounded-md bg-[#043873] text-white">
              <Radar size={20} aria-hidden="true" />
            </span>
            <span className="text-xl">RoleGuage</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-[#4F5F6F] md:flex">
            <Link href="/matcher#matcher" className="hover:text-[#043873]">Matcher</Link>
            <Link href="/#workflow" className="hover:text-[#043873]">How it works</Link>
            <Link href="/pricing" className="hover:text-[#043873]">Pricing</Link>
            <Link href="/#questions" className="hover:text-[#043873]">Questions</Link>
            <Link href="/profile" className="text-[#043873]">Profile</Link>
          </nav>
          <Link
            href="/matcher#matcher"
            className="inline-flex h-10 items-center rounded-md bg-[#4F9CF9] px-4 text-sm font-bold text-white transition hover:bg-[#3b8dea]"
          >
            Matcher
          </Link>
        </div>
      </header>

      <section className="bg-[#043873] px-5 py-10 text-white md:px-8 md:py-14 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-4xl font-extrabold leading-tight text-[#A7CEFC] md:text-6xl">Profile</h1>
          <p className="mt-4 max-w-4xl text-2xl font-extrabold leading-tight text-white md:text-4xl">
            Manage your saved resume and past job matches.
          </p>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-white/82 md:text-base">
            This MVP stores your resume and reports in this browser so you can revisit fit scores,
            suggestions, and cover letter drafts.
          </p>
        </div>
      </section>

      <section className="px-5 py-8 md:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="h-fit rounded-md border border-[#DDE8F6] bg-white p-3 shadow-[0_16px_44px_rgba(4,56,115,0.08)]">
            <button
              type="button"
              onClick={() => setActivePanel("details")}
              className={`w-full rounded-md px-4 py-3 text-left text-sm font-bold transition ${
                activePanel === "details" ? "bg-[#043873] text-white" : "text-[#4F5F6F] hover:bg-[#F8FBFF] hover:text-[#043873]"
              }`}
            >
              Basic details
            </button>
            <button
              type="button"
              onClick={() => setActivePanel("history")}
              className={`mt-1 w-full rounded-md px-4 py-3 text-left text-sm font-bold transition ${
                activePanel === "history" ? "bg-[#043873] text-white" : "text-[#4F5F6F] hover:bg-[#F8FBFF] hover:text-[#043873]"
              }`}
            >
              Match history
            </button>
          </aside>

          {activePanel === "details" ? (
            <section className="grid gap-6">
              <section className="rounded-md border border-[#DDE8F6] bg-white p-5 shadow-[0_16px_44px_rgba(4,56,115,0.08)] md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase text-[#4F9CF9]">Resume profile</p>
                <h2 className="mt-2 text-2xl font-extrabold text-[#212529]">
                  {resume.trim().length >= 80 ? "Resume saved" : "No saved resume"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#4F5F6F]">
                  {resume.trim().length >= 80
                    ? `${resumeFileName || "Saved resume profile"} - ${resume.length.toLocaleString()} characters saved locally.`
                    : "Upload a PDF or paste resume text to create your local profile."}
                </p>
              </div>
              <button
                type="button"
                onClick={deleteResume}
                className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-[#B5121B] bg-[#B5121B] px-3 text-sm font-bold text-white transition hover:bg-[#8F0E15]"
              >
                <Trash2 size={16} aria-hidden="true" />
                Delete
              </button>
            </div>

            <div className="mt-5 flex flex-col gap-4 rounded-md border border-[#DDE8F6] bg-[#F8FBFF] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-[#043873]">
                  {resume.trim().length >= 80 ? resumeFileName || "Saved resume profile" : "No resume uploaded"}
                </p>
                <p className="mt-1 text-xs font-semibold text-[#4F5F6F]">
                  {resume.trim().length >= 80 ? "Stored locally in this browser" : "Upload a text-based PDF to create your profile"}
                </p>
              </div>
              <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md bg-[#043873] px-4 text-sm font-bold text-white transition hover:bg-[#0b4c97]">
                <Upload size={16} aria-hidden="true" />
                {resume.trim().length >= 80 ? "Replace resume PDF" : "Upload resume PDF"}
                <input className="hidden" type="file" accept="application/pdf" onChange={extractResumeFromPdf} />
              </label>
            </div>

            {message ? <p className="mt-4 text-sm font-semibold text-[#007a52]">{message}</p> : null}
            {error ? <p className="mt-4 text-sm font-semibold text-[#b00000]">{error}</p> : null}
              </section>

              <section className="rounded-md border border-[#DDE8F6] bg-white p-5 shadow-[0_16px_44px_rgba(4,56,115,0.08)] md:p-6">
            <div>
              <p className="text-sm font-bold uppercase text-[#4F9CF9]">Candidate details</p>
              <h2 className="mt-2 text-2xl font-extrabold text-[#212529]">Application checks</h2>
              <p className="mt-2 text-sm leading-6 text-[#4F5F6F]">
                These facts stay in this browser and are used only when a job asks for them.
              </p>
            </div>

            <div className="mt-5 grid gap-3">
              <SelectField
                label="Work rights"
                value={candidateProfile.workRights ?? ""}
                onChange={(value) => updateCandidateProfile("workRights", value)}
                placeholder="Select right to work"
                suggestions={workRightsOptions}
              />
              <div className="grid items-start gap-3 sm:grid-cols-2">
                <LocationField
                  label="Location"
                  value={candidateProfile.location ?? ""}
                  onChange={(value) => updateCandidateProfile("location", value)}
                  placeholder="Type your suburb, city, or country"
                  suggestions={locationOptions}
                />
                <MultiSelectField
                  label="Work mode"
                  value={candidateProfile.workMode ?? ""}
                  onChange={(value) => updateCandidateProfile("workMode", value)}
                  placeholder="Select work mode"
                  suggestions={workModeOptions}
                />
              </div>
              <div className="grid items-start gap-3 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#4F5F6F]">Driver licence</span>
                  <select
                    value={candidateProfile.driversLicence ?? ""}
                    onChange={(event) => updateCandidateProfile("driversLicence", event.target.value)}
                    className="h-11 rounded-md border border-[#DDE8F6] bg-[#F8FBFF] px-3 text-sm outline-none transition focus:border-[#4F9CF9] focus:bg-white focus:ring-4 focus:ring-[#4F9CF9]/15"
                  >
                    <option value="">Not set</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                    <option value="unknown">Prefer to check manually</option>
                  </select>
                </label>
                <ProfileField
                  label="Minimum salary"
                  value={candidateProfile.minimumSalary ?? ""}
                  onChange={(value) => updateCandidateProfile("minimumSalary", value)}
                  placeholder="90000"
                />
              </div>
              <SelectField
                label="Security clearance"
                value={candidateProfile.securityClearance ?? ""}
                onChange={(value) => updateCandidateProfile("securityClearance", value)}
                placeholder="Select clearance status"
                suggestions={clearanceOptions}
              />
              <MultiSelectField
                label="Licences and certifications"
                value={candidateProfile.licences ?? ""}
                onChange={(value) => updateCandidateProfile("licences", value)}
                placeholder="Select licence or certification"
                suggestions={licenceOptions}
              />
              <TokenField
                label="Target roles"
                value={candidateProfile.targetRoles ?? ""}
                onChange={(value) => updateCandidateProfile("targetRoles", value)}
                placeholder="Type a role and press Enter"
                suggestions={targetRoleOptions}
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveCandidateProfile}
                className="h-11 cursor-pointer rounded-md bg-[#043873] px-4 text-sm font-bold text-white transition hover:bg-[#0b4c97]"
              >
                Save details
              </button>
              <button
                type="button"
                onClick={clearCandidateProfile}
                className="h-11 rounded-md border border-[#FFE492] bg-white px-4 text-sm font-bold text-[#043873] transition hover:bg-[#FFE492]"
              >
              Clear details
              </button>
            </div>
            {message ? <p className="mt-3 text-sm font-semibold text-[#007a52]">{message}</p> : null}
              </section>
            </section>
          ) : null}

          {activePanel === "history" ? (
            <section className="grid gap-5">
            <div className="rounded-md border border-[#DDE8F6] bg-white p-5 shadow-[0_16px_44px_rgba(4,56,115,0.08)] md:p-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-bold uppercase text-[#4F9CF9]">History</p>
                  <h2 className="mt-2 text-2xl font-extrabold text-[#212529]">
                    {history.length ? `${history.length} saved matches` : "No saved matches yet"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={clearHistory}
                  disabled={!history.length}
                  className="h-10 cursor-pointer rounded-md border border-[#B5121B] bg-[#B5121B] px-3 text-sm font-bold text-white transition hover:bg-[#8F0E15] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear history
                </button>
              </div>

              <div className="mt-5 grid gap-3">
                {history.length ? (
                  history.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`grid gap-3 rounded-md border p-4 text-left transition sm:grid-cols-[1fr_auto] sm:items-center ${
                        selectedMatch?.id === item.id
                          ? "border-[#4F9CF9] bg-[#F8FBFF]"
                          : "border-[#DDE8F6] bg-white hover:border-[#A7CEFC]"
                      }`}
                    >
                      <span>
                        <span className="block text-base font-extrabold text-[#212529]">
                          {item.jobMeta.title || "Untitled role"}
                        </span>
                        <span className="mt-1 block text-sm font-semibold text-[#4F5F6F]">
                          {[item.jobMeta.company, item.jobMeta.location].filter(Boolean).join(" | ") || "Job details not provided"}
                        </span>
                      </span>
                      <span className="rounded-md bg-[#FFE492] px-3 py-2 text-sm font-bold text-[#043873]">
                        {item.result.score}% fit
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="rounded-md border border-dashed border-[#A7CEFC] bg-[#F8FBFF] p-8 text-center">
                    <FileText className="mx-auto text-[#4F9CF9]" size={30} aria-hidden="true" />
                    <p className="mt-3 text-lg font-extrabold text-[#043873]">Generate a fit report first</p>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#4F5F6F]">
                      Reports generated on the matcher page are saved here with their suggestions and cover letters.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {selectedMatch ? (
              <section className="rounded-md border border-[#DDE8F6] bg-white p-5 shadow-[0_16px_44px_rgba(4,56,115,0.08)] md:p-6">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-sm font-bold uppercase text-[#4F9CF9]">Selected report</p>
                    <h2 className="mt-2 text-2xl font-extrabold text-[#212529]">
                      {selectedMatch.jobMeta.title || "Untitled role"}
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-[#4F5F6F]">
                      {[selectedMatch.jobMeta.company, selectedMatch.jobMeta.location].filter(Boolean).join(" | ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteMatch(selectedMatch.id)}
                    className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-[#B5121B] bg-[#B5121B] px-3 text-sm font-bold text-white transition hover:bg-[#8F0E15]"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    Delete
                  </button>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <ProfileMetric label="Decision" value={selectedMatch.result.decision} />
                  <ProfileMetric label="Fit" value={`${selectedMatch.result.score}%`} />
                  <ProfileMetric label="Level" value={selectedMatch.result.level} />
                </div>

                <p className="mt-5 text-sm leading-7 text-[#4F5F6F]">{selectedMatch.result.summary}</p>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <HistoryList title="Matched skills" items={selectedMatch.result.matchedSkills} />
                  <HistoryList title="Gaps" items={selectedMatch.result.missingSkills} />
                  <HistoryList title="Resume suggestions" items={selectedMatch.result.resumeBullets} />
                  <HistoryList title="Interview prep" items={selectedMatch.result.interviewPrep} />
                </div>

                <div className="mt-5 rounded-md border border-[#DDE8F6] bg-[#F8FBFF] p-4">
                  <h3 className="text-lg font-extrabold text-[#212529]">Cover letter</h3>
                  <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#4F5F6F]">
                    {selectedMatch.result.coverLetter ?? "No cover letter saved for this report."}
                  </p>
                </div>
              </section>
            ) : null}
            </section>
          ) : null}
        </div>
      </section>
      <SharedFooter />
    </main>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#DDE8F6] bg-[#F8FBFF] p-3">
      <p className="text-lg font-extrabold text-[#043873]">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase text-[#4F5F6F]">{label}</p>
    </div>
  );
}

function HistoryList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-md border border-[#DDE8F6] bg-[#F8FBFF] p-4">
      <h3 className="text-sm font-extrabold text-[#212529]">{title}</h3>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-[#4F5F6F]">
        {items.length ? (
          items.slice(0, 5).map((item) => (
            <li key={item} className="flex gap-2">
              <CheckCircle2 size={15} className="mt-1 shrink-0 text-[#4F9CF9]" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))
        ) : (
          <li>None detected.</li>
        )}
      </ul>
    </section>
  );
}

function ProfileField({
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
    <label className="grid gap-2">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#4F5F6F]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border border-[#DDE8F6] bg-[#F8FBFF] px-3 text-sm outline-none transition focus:border-[#4F9CF9] focus:bg-white focus:ring-4 focus:ring-[#4F9CF9]/15"
        placeholder={placeholder}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  placeholder,
  suggestions,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  suggestions: string[];
}) {
  const hasCustomValue = value && !suggestions.includes(value);

  return (
    <label className="grid gap-2">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#4F5F6F]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 cursor-pointer rounded-md border border-[#DDE8F6] bg-[#F8FBFF] px-3 text-sm outline-none transition focus:border-[#4F9CF9] focus:bg-white focus:ring-4 focus:ring-[#4F9CF9]/15"
      >
        <option value="">{placeholder}</option>
        {hasCustomValue ? <option value={value}>{value}</option> : null}
        {suggestions.map((suggestion) => (
          <option key={suggestion} value={suggestion}>
            {suggestion}
          </option>
        ))}
      </select>
    </label>
  );
}

function LocationField({
  label,
  value,
  onChange,
  placeholder,
  suggestions,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  suggestions: string[];
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#4F5F6F]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        list="roleguage-location-options"
        className="h-11 rounded-md border border-[#DDE8F6] bg-[#F8FBFF] px-3 text-sm outline-none transition focus:border-[#4F9CF9] focus:bg-white focus:ring-4 focus:ring-[#4F9CF9]/15"
        placeholder={placeholder}
      />
      <datalist id="roleguage-location-options">
        {suggestions.map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>
    </label>
  );
}

function MultiSelectField({
  label,
  value,
  onChange,
  placeholder,
  suggestions,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  suggestions: string[];
}) {
  const tokens = splitTokens(value);
  const available = suggestions.filter(
    (suggestion) => !tokens.some((token) => token.toLowerCase() === suggestion.toLowerCase()),
  );

  function addToken(token: string) {
    if (!token) return;
    onChange([...tokens, token].join(", "));
  }

  function removeToken(token: string) {
    onChange(tokens.filter((item) => item !== token).join(", "));
  }

  return (
    <div className="grid gap-2">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#4F5F6F]">{label}</span>
      <select
        value=""
        onChange={(event) => addToken(event.target.value)}
        className="h-11 cursor-pointer rounded-md border border-[#DDE8F6] bg-[#F8FBFF] px-3 text-sm outline-none transition focus:border-[#4F9CF9] focus:bg-white focus:ring-4 focus:ring-[#4F9CF9]/15"
      >
        <option value="">{placeholder}</option>
        {available.map((suggestion) => (
          <option key={suggestion} value={suggestion}>
            {suggestion}
          </option>
        ))}
      </select>
      {tokens.length ? (
        <div className="flex flex-wrap gap-2">
          {tokens.map((token) => (
            <span key={token} className="inline-flex h-8 items-center gap-2 rounded-md border border-[#A7CEFC] bg-white px-2 text-sm font-bold text-[#043873]">
              {token}
              <button
                type="button"
                onClick={() => removeToken(token)}
                className="grid size-5 place-items-center rounded text-[#4F5F6F] transition hover:bg-[#F8FBFF] hover:text-[#B5121B]"
                aria-label={`Remove ${token}`}
              >
                <X size={13} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TokenField({
  label,
  value,
  onChange,
  placeholder,
  suggestions,
  maxItems,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  suggestions: string[];
  maxItems?: number;
}) {
  const [draft, setDraft] = useState("");
  const tokens = splitTokens(value);
  const filteredSuggestions = suggestions
    .filter((suggestion) => !tokens.some((token) => token.toLowerCase() === suggestion.toLowerCase()))
    .filter((suggestion) => !draft.trim() || suggestion.toLowerCase().includes(draft.trim().toLowerCase()))
    .slice(0, 5);
  const showSuggestions = Boolean(draft.trim() && filteredSuggestions.length);

  function addToken(token: string) {
    const clean = token.trim();
    if (!clean) return;

    const nextTokens = maxItems === 1 ? [clean] : [...tokens, clean];
    const unique = Array.from(new Map(nextTokens.map((item) => [item.toLowerCase(), item])).values());

    onChange(unique.slice(0, maxItems ?? unique.length).join(", "));
    setDraft("");
  }

  function removeToken(token: string) {
    onChange(tokens.filter((item) => item !== token).join(", "));
  }

  return (
    <label className="grid gap-2">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#4F5F6F]">{label}</span>
      <div className="rounded-md border border-[#DDE8F6] bg-[#F8FBFF] p-2 transition focus-within:border-[#4F9CF9] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#4F9CF9]/15">
        <div className="flex min-h-9 flex-wrap items-center gap-2">
          {tokens.map((token) => (
            <span key={token} className="inline-flex items-center gap-2 rounded-md border border-[#A7CEFC] bg-white px-2 py-1 text-sm font-bold text-[#043873]">
              {token}
              <button
                type="button"
                onClick={() => removeToken(token)}
                className="grid size-5 place-items-center rounded text-[#4F5F6F] transition hover:bg-[#F8FBFF] hover:text-[#B5121B]"
                aria-label={`Remove ${token}`}
              >
                <X size={13} aria-hidden="true" />
              </button>
            </span>
          ))}
          {(!maxItems || tokens.length < maxItems) ? (
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  addToken(draft || filteredSuggestions[0] || "");
                }
              }}
              className="min-w-40 flex-1 bg-transparent px-1 py-2 text-sm outline-none"
              placeholder={tokens.length ? "" : placeholder}
            />
          ) : null}
        </div>
        {(!maxItems || tokens.length < maxItems) && showSuggestions ? (
          <div className="mt-2 flex flex-wrap gap-2 border-t border-[#DDE8F6] pt-2">
            {filteredSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => addToken(suggestion)}
                className="rounded-md border border-[#DDE8F6] bg-white px-2 py-1 text-xs font-bold text-[#4F5F6F] transition hover:border-[#A7CEFC] hover:text-[#043873]"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </label>
  );
}

function splitTokens(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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

function readCandidateProfile() {
  try {
    const raw = window.localStorage.getItem(candidateProfileStorageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CandidateProfile;

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
