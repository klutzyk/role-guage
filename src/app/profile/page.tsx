"use client";

import { ArrowLeft, CheckCircle2, FileText, Radar, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

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

const resumeProfileStorageKey = "roleguage.resume-profile.v1";
const legacyResumeProfileStorageKey = "applypilot.resume-profile.v1";
const matchHistoryStorageKey = "roleguage.match-history.v1";

export default function ProfilePage() {
  const [resume, setResume] = useState("");
  const [history, setHistory] = useState<MatchHistoryItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
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

    setResume(savedResume);
    setHistory(savedHistory);
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
    setError("");
    setMessage("Resume profile saved.");
  }

  function deleteResume() {
    window.localStorage.removeItem(resumeProfileStorageKey);
    window.localStorage.removeItem(legacyResumeProfileStorageKey);
    setResume("");
    setMessage("Resume profile deleted.");
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
          <Link
            href="/"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[#A7CEFC] bg-white px-4 text-sm font-bold text-[#043873] transition hover:bg-[#A7CEFC]/20"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Matcher
          </Link>
        </div>
      </header>

      <section className="bg-[#043873] px-5 py-10 text-white md:px-8 md:py-14 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#A7CEFC]">Profile</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-extrabold leading-tight md:text-6xl">
            Manage your saved resume and past job matches.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-white/82">
            This MVP stores your resume and reports in this browser so you can revisit fit scores,
            suggestions, and cover letter drafts.
          </p>
        </div>
      </section>

      <section className="px-5 py-8 md:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="rounded-md border border-[#DDE8F6] bg-white p-5 shadow-[0_16px_44px_rgba(4,56,115,0.08)] md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase text-[#4F9CF9]">Resume profile</p>
                <h2 className="mt-2 text-2xl font-extrabold text-[#212529]">
                  {resume.trim().length >= 80 ? "Resume saved" : "No saved resume"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#4F5F6F]">
                  {resume.trim().length >= 80
                    ? `${resume.length.toLocaleString()} characters saved locally.`
                    : "Upload a PDF or paste resume text to create your local profile."}
                </p>
              </div>
              <button
                type="button"
                onClick={deleteResume}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-[#d21414] bg-[#ed1515] px-3 text-sm font-bold text-white shadow-[4px_5px_0_#262626] transition hover:bg-[#c50f0f]"
              >
                <Trash2 size={16} aria-hidden="true" />
                Delete
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 rounded-md border border-[#DDE8F6] bg-[#F8FBFF] p-4">
              <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md bg-[#043873] px-4 text-sm font-bold text-white transition hover:bg-[#0b4c97]">
                <Upload size={16} aria-hidden="true" />
                Upload resume PDF
                <input className="hidden" type="file" accept="application/pdf" onChange={extractResumeFromPdf} />
              </label>
              <button
                type="button"
                onClick={saveResume}
                className="h-11 rounded-md border border-[#FFE492] bg-white px-4 text-sm font-bold text-[#043873] transition hover:bg-[#FFE492]"
              >
                Save text
              </button>
            </div>

            <textarea
              value={resume}
              onChange={(event) => setResume(event.target.value)}
              className="mt-5 min-h-80 w-full resize-y rounded-md border border-[#DDE8F6] bg-[#F8FBFF] p-4 text-sm leading-7 outline-none transition focus:border-[#4F9CF9] focus:bg-white focus:ring-4 focus:ring-[#4F9CF9]/15"
              placeholder="Paste resume text here."
            />

            {message ? <p className="mt-4 text-sm font-semibold text-[#007a52]">{message}</p> : null}
            {error ? <p className="mt-4 text-sm font-semibold text-[#b00000]">{error}</p> : null}
          </section>

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
                  className="h-10 rounded-md border border-[#d21414] bg-[#ed1515] px-3 text-sm font-bold text-white shadow-[4px_5px_0_#262626] transition hover:bg-[#c50f0f] disabled:cursor-not-allowed disabled:opacity-50"
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
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-[#d21414] bg-[#ed1515] px-3 text-sm font-bold text-white shadow-[4px_5px_0_#262626] transition hover:bg-[#c50f0f]"
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
        </div>
      </section>
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

function readMatchHistory() {
  try {
    const raw = window.localStorage.getItem(matchHistoryStorageKey) ?? "[]";
    const parsed = JSON.parse(raw) as MatchHistoryItem[];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
