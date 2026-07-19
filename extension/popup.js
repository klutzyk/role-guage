// const API_BASE = "https://roleguage.com";
const API_BASE = "http://localhost:3000";
const RESUME_KEYS = ["resume", "resumeFileName", "resumePageCount", "resumeUpdatedAt"];
const LAST_REPORT_KEY = "lastReportByPage";
const LAST_GLOBAL_REPORT_KEY = "lastReportSnapshot";
const ACCOUNT_SESSION_KEY = "accountSession";

const elements = {
  accountGate: document.querySelector("#accountGate"),
  extensionSignIn: document.querySelector("#extensionSignIn"),
  extensionSignUp: document.querySelector("#extensionSignUp"),
  extensionSignOut: document.querySelector("#extensionSignOut"),
  authEmail: document.querySelector("#authEmail"),
  authPassword: document.querySelector("#authPassword"),
  signedInBar: document.querySelector("#signedInBar"),
  signedInEmail: document.querySelector("#signedInEmail"),
  resume: document.querySelector("#resume"),
  resumeStateTitle: document.querySelector("#resumeStateTitle"),
  resumeMeta: document.querySelector("#resumeMeta"),
  resumeFile: document.querySelector("#resumeFile"),
  uploadResume: document.querySelector("#uploadResume"),
  deleteResume: document.querySelector("#deleteResume"),
  resumeEditor: document.querySelector("#resumeEditor"),
  jobText: document.querySelector("#jobText"),
  saveResume: document.querySelector("#saveResume"),
  clearResume: document.querySelector("#clearResume"),
  extractJob: document.querySelector("#extractJob"),
  analyze: document.querySelector("#analyze"),
  status: document.querySelector("#status"),
  loadingCard: document.querySelector("#loadingCard"),
  result: document.querySelector("#result"),
  decision: document.querySelector("#decision"),
  level: document.querySelector("#level"),
  score: document.querySelector("#score"),
  jobMetaCard: document.querySelector("#jobMetaCard"),
  resultRole: document.querySelector("#resultRole"),
  resultCompany: document.querySelector("#resultCompany"),
  resultMeta: document.querySelector("#resultMeta"),
  summary: document.querySelector("#summary"),
  requirementAlert: document.querySelector("#requirementAlert"),
  nextStep: document.querySelector("#nextStep"),
  matchedSkills: document.querySelector("#matchedSkills"),
  missingSkills: document.querySelector("#missingSkills"),
  dynamicRequirementsBlock: document.querySelector("#dynamicRequirementsBlock"),
  dynamicMustHave: document.querySelector("#dynamicMustHave"),
  dynamicExpectedWork: document.querySelector("#dynamicExpectedWork"),
  resumeBullets: document.querySelector("#resumeBullets"),
  coverLetterBlock: document.querySelector("#coverLetterBlock"),
  coverLetter: document.querySelector("#coverLetter"),
  copyCoverLetter: document.querySelector("#copyCoverLetter"),
  exportCoverLetterDocx: document.querySelector("#exportCoverLetterDocx"),
  exportCoverLetterPdf: document.querySelector("#exportCoverLetterPdf"),
  copyResult: document.querySelector("#copyResult"),
  openApp: document.querySelector("#openApp"),
};

let lastReport = null;
let accountSession = null;

init();

function addListener(element, eventName, handler) {
  if (!element) return;
  element.addEventListener(eventName, handler);
}

async function init() {
  const session = await getActiveSession();
  const saved = await chrome.storage.local.get([...RESUME_KEYS]);

  accountSession = session;
  if (elements.resume) {
    elements.resume.value = session?.profile?.resumeText || saved.resume || "";
  }
  updateResumeUi(profileToResumeStorage(session?.profile) || saved);
  updateAccountGate();
  const restored = accountSession ? await restoreLastReportSnapshot() : false;

  addListener(elements.extensionSignIn, "click", openSignIn);
  addListener(elements.extensionSignUp, "click", openSignUp);
  addListener(elements.extensionSignOut, "click", signOut);
  addListener(elements.authPassword, "keydown", (event) => {
    if (event.key === "Enter") openSignIn();
  });
  addListener(elements.uploadResume, "click", uploadResumePdf);
  addListener(elements.resumeFile, "change", uploadResumePdf);
  addListener(elements.deleteResume, "click", clearResume);
  addListener(elements.saveResume, "click", saveResume);
  addListener(elements.clearResume, "click", clearResume);
  addListener(elements.extractJob, "click", extractJobFromActiveTab);
  addListener(elements.analyze, "click", analyzeFit);
  addListener(elements.copyResult, "click", copyReport);
  addListener(elements.copyCoverLetter, "click", copyCoverLetter);
  addListener(elements.exportCoverLetterDocx, "click", exportCoverLetterDocx);
  addListener(elements.exportCoverLetterPdf, "click", exportCoverLetterPdf);
  addListener(elements.openApp, "click", openApp);

  if (accountSession && !restored) {
    await autoExtractCurrentPage();
  } else if (!accountSession) {
    setStatus("Sign in to use RoleGuage.");
  }
}

async function uploadResumePdf() {
  const file = elements.resumeFile.files?.[0];

  if (!file) {
    elements.resumeFile.click();
    return;
  }

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    setStatus("Upload a PDF resume.", true);
    return;
  }

  setBusy(true, "Reading your resume PDF...");

  try {
    const formData = new FormData();
    formData.append("resume", file);

    const response = await fetch(`${API_BASE}/api/extract-resume`, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();

    if (!response.ok || !data.text || data.text.length < 80) {
      throw new Error(data.error || "Could not read enough text from this PDF.");
    }

    const resumeProfile = {
      resume: data.text.trim(),
      resumeFileName: data.filename || file.name,
      resumePageCount: data.pages || "",
      resumeUpdatedAt: new Date().toISOString(),
    };

    await saveResumeToAccount(resumeProfile);
    await chrome.storage.local.set(resumeProfile);
    await chrome.storage.local.remove([LAST_REPORT_KEY, LAST_GLOBAL_REPORT_KEY]);
    elements.resume.value = resumeProfile.resume;
    elements.resumeFile.value = "";
    updateResumeUi(resumeProfile);
    setStatus("Resume saved. Open a job ad and click Analyze this job.");
  } catch (error) {
    setStatus(error.message || "Could not upload this resume.", true);
  } finally {
    setBusy(false);
  }
}

async function saveResume() {
  const resume = elements.resume.value.trim();

  if (resume.length < 80) {
    setStatus("Add more resume text before saving.", true);
    return;
  }

  const resumeProfile = {
    resume,
    resumeFileName: "Manual resume text",
    resumePageCount: "",
    resumeUpdatedAt: new Date().toISOString(),
  };

  await saveResumeToAccount(resumeProfile);
  await chrome.storage.local.set(resumeProfile);
  await chrome.storage.local.remove([LAST_REPORT_KEY, LAST_GLOBAL_REPORT_KEY]);
  updateResumeUi(resumeProfile);
  setStatus("Resume saved. Open a job ad and click Analyze this job.");
}

async function clearResume() {
  if (elements.resume) elements.resume.value = "";
  if (elements.resumeFile) elements.resumeFile.value = "";
  await saveResumeToAccount({
    resume: "",
    resumeFileName: "",
    resumePageCount: "",
    resumeUpdatedAt: new Date().toISOString(),
  });
  await chrome.storage.local.remove([...RESUME_KEYS, LAST_REPORT_KEY, LAST_GLOBAL_REPORT_KEY]);
  updateResumeUi({});
  setStatus("Resume cleared.");
}

async function saveResumeToAccount(resumeProfile) {
  accountSession = await getActiveSession();
  if (!accountSession?.accessToken) {
    throw new Error("Sign in before updating your resume profile.");
  }

  const currentProfile = accountSession.profile || {};
  const profile = {
    ...currentProfile,
    resumeText: resumeProfile.resume || "",
    resumeFileName: resumeProfile.resumeFileName || "",
    candidateProfile: currentProfile.candidateProfile || {},
    coverLetterInstructions: currentProfile.coverLetterInstructions || "",
    coverLetterExamples: Array.isArray(currentProfile.coverLetterExamples)
      ? currentProfile.coverLetterExamples
      : [],
  };

  const response = await fetch(`${API_BASE}/api/account/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accountSession.accessToken}`,
    },
    body: JSON.stringify({ profile }),
  });
  const data = await response.json();

  if (!response.ok || !data.profile) {
    throw new Error(data.error || "Could not update your account profile.");
  }

  accountSession = {
    ...accountSession,
    profile: data.profile,
  };
  await chrome.storage.local.set({ [ACCOUNT_SESSION_KEY]: accountSession });
}

function updateResumeUi(saved) {
  const resume = (saved.resume || elements.resume?.value || "").trim();
  const hasResume = resume.length >= 80;
  const name = saved.resumeFileName || "Saved resume";
  const pages = saved.resumePageCount ? `${saved.resumePageCount} page${saved.resumePageCount === 1 ? "" : "s"}` : "";
  const chars = hasResume ? `${resume.length.toLocaleString()} characters` : "";

  if (elements.resumeStateTitle) elements.resumeStateTitle.textContent = hasResume ? "Resume saved" : "Upload resume once";
  if (elements.resumeMeta) {
    elements.resumeMeta.textContent = hasResume
      ? [name, pages, chars].filter(Boolean).join(" - ")
      : "Upload a text-based PDF to start checking roles.";
  }
  if (elements.uploadResume) elements.uploadResume.textContent = hasResume ? "Replace Resume PDF" : "Upload Resume PDF";
  elements.deleteResume?.classList.toggle("hidden", !hasResume);
  elements.resumeEditor?.classList.toggle("hidden", hasResume);
}

function updateAccountGate() {
  const isSignedIn = Boolean(accountSession?.accessToken);
  const gatedElements = document.querySelectorAll(".requiresAccount:not(#loadingCard):not(#result)");

  elements.accountGate?.classList.toggle("hidden", isSignedIn);
  elements.signedInBar?.classList.toggle("hidden", !isSignedIn);
  if (elements.signedInEmail) elements.signedInEmail.textContent = accountSession?.email || "";
  gatedElements.forEach((element) => element.classList.toggle("hidden", !isSignedIn));
  if (!isSignedIn) {
    elements.loadingCard?.classList.add("hidden");
    elements.result?.classList.add("hidden");
  }
}

async function openSignIn() {
  const email = elements.authEmail?.value.trim() || "";
  const password = elements.authPassword?.value || "";

  if (!email || !password) {
    setStatus("Enter your email and password.", true);
    return;
  }

  setBusy(true, "Signing in...");

  try {
    const response = await fetch(`${API_BASE}/api/extension/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();

    if (!response.ok || !data.session?.accessToken) {
      throw new Error(data.error || "Could not sign in.");
    }

    accountSession = {
      ...data.session,
      profile: data.profile || null,
    };
    await chrome.storage.local.set({ [ACCOUNT_SESSION_KEY]: accountSession });
    if (elements.authPassword) elements.authPassword.value = "";
    await applyAccountProfile(accountSession.profile);
    updateAccountGate();
    setStatus("Signed in. Open a job ad and analyze it.");
    await autoExtractCurrentPage().catch(() => undefined);
  } catch (error) {
    setStatus(error.message || "Could not sign in.", true);
  } finally {
    setBusy(false);
  }
}

async function openSignUp() {
  await chrome.tabs.create({ url: `${API_BASE}/auth?next=/profile` });
}

async function signOut() {
  accountSession = null;
  lastReport = null;
  if (elements.resume) elements.resume.value = "";
  if (elements.jobText) elements.jobText.value = "";
  elements.result?.classList.add("hidden");
  await chrome.storage.local.remove([ACCOUNT_SESSION_KEY, ...RESUME_KEYS, LAST_REPORT_KEY, LAST_GLOBAL_REPORT_KEY]);
  updateResumeUi({});
  updateAccountGate();
  setStatus("Signed out.");
}

async function getActiveSession() {
  const saved = await chrome.storage.local.get([ACCOUNT_SESSION_KEY]);
  const session = saved[ACCOUNT_SESSION_KEY];

  if (!session?.accessToken || !session?.refreshToken) return null;

  const expiresAt = Number(session.expiresAt || 0);
  const shouldRefresh = expiresAt && expiresAt * 1000 - Date.now() < 120_000;

  if (!shouldRefresh) {
    return refreshSessionProfile(session);
  }

  try {
    const response = await fetch(`${API_BASE}/api/extension/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "refresh", refreshToken: session.refreshToken }),
    });
    const data = await response.json();

    if (!response.ok || !data.session?.accessToken) {
      await chrome.storage.local.remove([ACCOUNT_SESSION_KEY]);
      return null;
    }

    const nextSession = {
      ...data.session,
      profile: data.profile || session.profile || null,
    };
    await chrome.storage.local.set({ [ACCOUNT_SESSION_KEY]: nextSession });

    return nextSession;
  } catch {
    return session;
  }
}

async function refreshSessionProfile(session) {
  try {
    const response = await fetch(`${API_BASE}/api/extension/auth`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    });
    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        await chrome.storage.local.remove([ACCOUNT_SESSION_KEY]);
        return null;
      }

      return session;
    }

    const nextSession = {
      ...session,
      profile: data.profile || session.profile || null,
    };
    await chrome.storage.local.set({ [ACCOUNT_SESSION_KEY]: nextSession });

    return nextSession;
  } catch {
    return session;
  }
}

async function applyAccountProfile(profile) {
  if (!profile) return;

  const resumeProfile = profileToResumeStorage(profile);
  const stored = await chrome.storage.local.get([LAST_GLOBAL_REPORT_KEY]);
  const currentFingerprint = getProfileFingerprint(profile);
  const cachedFingerprint = stored[LAST_GLOBAL_REPORT_KEY]?.profileFingerprint || "";

  if (cachedFingerprint && currentFingerprint && cachedFingerprint !== currentFingerprint) {
    await chrome.storage.local.remove([LAST_REPORT_KEY, LAST_GLOBAL_REPORT_KEY]);
  }

  if (resumeProfile?.resume) {
    elements.resume.value = resumeProfile.resume;
    await chrome.storage.local.set(resumeProfile);
    updateResumeUi(resumeProfile);
  }
}

function profileToResumeStorage(profile) {
  if (!profile?.resumeText) return null;

  return {
    resume: profile.resumeText,
    resumeFileName: profile.resumeFileName || "Saved RoleGuage profile",
    resumePageCount: "",
    resumeUpdatedAt: new Date().toISOString(),
  };
}

async function restoreLastReportSnapshot() {
  const savedSnapshot = await chrome.storage.local.get([LAST_GLOBAL_REPORT_KEY]);
  const snapshot = savedSnapshot[LAST_GLOBAL_REPORT_KEY];
  const currentFingerprint = getProfileFingerprint(accountSession?.profile);

  if (snapshot?.report) {
    if (snapshot.profileFingerprint && currentFingerprint && snapshot.profileFingerprint !== currentFingerprint) {
      await chrome.storage.local.remove([LAST_GLOBAL_REPORT_KEY]);
    } else {
      lastReport = {
        ...snapshot.report,
        cachedResult: true,
        cachedAt: snapshot.savedAt || "",
      };
      elements.jobText.value = snapshot.jobText || "";
      elements.jobText.dataset.pageTitle = snapshot.pageTitle || "";
      elements.jobText.dataset.pageUrl = snapshot.pageUrl || "";
      showLoadingCard(false);
      renderResult(lastReport);
      return true;
    }
  }

  if (snapshot?.jobText) {
    elements.jobText.value = snapshot.jobText || "";
    elements.jobText.dataset.pageTitle = snapshot.pageTitle || "";
    elements.jobText.dataset.pageUrl = snapshot.pageUrl || "";
  }

  const pageKey = await getActivePageKey();

  if (!pageKey) return false;

  const saved = await chrome.storage.local.get([LAST_REPORT_KEY]);
  const cached = saved[LAST_REPORT_KEY]?.[pageKey];

  if (!cached?.jobText) return false;

  lastReport = null;
  elements.jobText.value = cached.jobText || "";
  elements.jobText.dataset.pageTitle = cached.pageTitle || "";
  elements.jobText.dataset.pageUrl = cached.pageUrl || "";
  elements.result?.classList.add("hidden");
  return true;
}

async function autoExtractCurrentPage() {
  try {
    const payload = await extractJobFromActiveTab({ quiet: true });
    setStatus(`Extracted ${payload.jobText.length.toLocaleString()} characters. Review, then analyze.`);
  } catch {
    setStatus("Open a job ad, then extract or paste the job text.");
  }
}

async function extractJobFromActiveTab(options = {}) {
  if (!options.quiet) {
    setBusy(true, "Extracting the current page...");
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      throw new Error("No active tab found.");
    }

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractJobTextFromPage,
    });

    const payload = result?.result;

    if (!payload?.jobText || payload.jobText.length < 80) {
      throw new Error("Could not find enough job text. Highlight the job description on the page and try again.");
    }

    elements.jobText.value = payload.jobText;
    elements.jobText.dataset.pageTitle = payload.pageTitle || "";
    elements.jobText.dataset.pageUrl = payload.pageUrl || "";
    if (!options.quiet) {
      setStatus(`Extracted ${payload.jobText.length.toLocaleString()} characters from this page.`);
    }
    return payload;
  } catch (error) {
    if (!options.quiet) {
      setStatus(error.message || "Could not extract this page.", true);
    }
    throw error;
  } finally {
    if (!options.quiet) {
      setBusy(false);
    }
  }
}

async function analyzeFit() {
  accountSession = await getActiveSession();
  updateAccountGate();

  if (!accountSession?.accessToken) {
    setStatus("Sign in to analyze this job.", true);
    return;
  }

  const saved = await chrome.storage.local.get(["resume"]);
  const resume = (accountSession.profile?.resumeText || saved.resume || elements.resume.value || "").trim();
  let job = elements.jobText.value.trim();

  if (resume.length < 80) {
    elements.resumeEditor.classList.remove("hidden");
    setStatus("Upload or save your resume first.", true);
    return;
  }

  setBusy(true, "Analyzing this job...");
  showLoadingCard(true);

  try {
    if (job.length < 80) {
      setStatus("Extracting this job page...");
      const payload = await extractJobFromActiveTab({ quiet: true });
      job = payload.jobText.trim();
    }

    console.debug("RoleGuage extension analyze input", {
      resumeLength: resume.length,
      jobLength: job.length,
      profileFingerprint: getProfileFingerprint(accountSession.profile),
      profileUpdatedAt: accountSession.profile?.updatedAt || "",
      coverLetterInstructionsLength: (accountSession.profile?.coverLetterInstructions || "").length,
      coverLetterExamplesCount: Array.isArray(accountSession.profile?.coverLetterExamples)
        ? accountSession.profile.coverLetterExamples.length
        : 0,
      resumeHash: simpleHash(resume),
      jobHash: simpleHash(job),
      instructionHash: simpleHash(accountSession.profile?.coverLetterInstructions || ""),
      firstExampleHash: simpleHash(accountSession.profile?.coverLetterExamples?.[0] || ""),
    });

    const response = await fetch(`${API_BASE}/api/extension/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accountSession.accessToken}`,
      },
      body: JSON.stringify({
        resume,
        job,
        pageTitle: elements.jobText.dataset.pageTitle || "",
        pageUrl: elements.jobText.dataset.pageUrl || "",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Analysis failed.");
    }

    if (data.debugContext) {
      console.debug("RoleGuage extension analyze backend context", data.debugContext);
    }

    lastReport = {
      ...data,
      generatedAt: new Date().toISOString(),
    };
    showLoadingCard(false);
    renderResult(lastReport);
    await saveLastResultForActivePage({
      report: lastReport,
      jobText: job,
      pageTitle: elements.jobText.dataset.pageTitle || "",
      pageUrl: elements.jobText.dataset.pageUrl || "",
    });
    setStatus(data.enrichment?.aiStatus === "generated" ? "Personalized report ready." : "Report ready.");
  } catch (error) {
    setStatus(error.message || "Could not analyze this job.", true);
  } finally {
    showLoadingCard(false);
    setBusy(false);
  }
}

async function saveLastResultForActivePage(payload) {
  const pageKey = await getActivePageKey();

  if (!pageKey) return;

  const saved = await chrome.storage.local.get([LAST_REPORT_KEY]);
  const reports = saved[LAST_REPORT_KEY] || {};
  reports[pageKey] = {
    ...payload,
    savedAt: new Date().toISOString(),
    profileFingerprint: getProfileFingerprint(accountSession?.profile),
  };

  const entries = Object.entries(reports).slice(-8);
  await chrome.storage.local.set({
    [LAST_REPORT_KEY]: Object.fromEntries(entries),
    [LAST_GLOBAL_REPORT_KEY]: {
      ...payload,
      savedAt: new Date().toISOString(),
      profileFingerprint: getProfileFingerprint(accountSession?.profile),
    },
  });
}

async function getActivePageKey() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || "";

  if (!url) return "";

  return url.split("#")[0];
}

function renderResult(data) {
  const analysis = data.analysis;
  const enrichment = data.enrichment || {};
  const summary = enrichment.summary || analysis.summary;
  const nextStep = enrichment.nextStep || analysis.nextStep;
  const bullets = enrichment.resumeBullets?.length ? enrichment.resumeBullets : analysis.resumeBullets || [];
  const coverLetter = (enrichment.coverLetter || "").trim();

  elements.result.classList.remove("hidden");
  elements.decision.textContent = analysis.decision;
  elements.score.textContent = analysis.score;
  renderJobMeta(lastReport);
  renderResultMeta(data);
  elements.summary.textContent = summary;
  renderRequirementAlert(elements.requirementAlert, analysis.hardRequirements || []);
  elements.nextStep.textContent = nextStep;
  renderChips(elements.matchedSkills, analysis.matchedSkills);
  renderChips(elements.missingSkills, analysis.missingSkills.length ? analysis.missingSkills : ["None"]);
  renderDynamicRequirements(analysis.dynamicRequirements);
  renderList(elements.resumeBullets, bullets);
  elements.coverLetterBlock.classList.toggle("hidden", !coverLetter);
  elements.coverLetter.textContent = coverLetter;
}

function renderDynamicRequirements(dynamicRequirements) {
  if (!elements.dynamicRequirementsBlock) return;

  const mustHave = Array.isArray(dynamicRequirements?.mustHave) ? dynamicRequirements.mustHave : [];
  const expectedWork = Array.isArray(dynamicRequirements?.expectedWork) ? dynamicRequirements.expectedWork : [];
  const hasContent = mustHave.length || expectedWork.length;

  elements.dynamicRequirementsBlock.classList.toggle("hidden", !hasContent);
  if (!hasContent) return;

  renderRequirementItems(elements.dynamicMustHave, mustHave.slice(0, 5));
  renderList(elements.dynamicExpectedWork, expectedWork.slice(0, 4));
}

function renderRequirementItems(container, items) {
  if (!container) return;

  container.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = "No clear must-have requirements extracted.";
    container.appendChild(li);
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.className = item.matched ? "requirementMatched" : "requirementMissing";
    li.textContent = `${item.requirement}${item.matched ? " - found" : ""}`;
    container.appendChild(li);
  }
}

function renderResultMeta(data) {
  if (!elements.resultMeta) return;

  const timestamp = data.cachedAt || data.generatedAt || "";
  if (!timestamp) {
    elements.resultMeta.classList.add("hidden");
    elements.resultMeta.textContent = "";
    return;
  }

  const label = data.cachedResult ? "Restored" : "Generated";
  elements.resultMeta.textContent = `${label} ${formatTimestamp(timestamp)}`;
  elements.resultMeta.classList.remove("hidden");
}

function formatTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getProfileFingerprint(profile) {
  if (!profile) return "";

  return simpleHash(
    [
      profile.updatedAt || "",
      profile.resumeText || "",
      profile.coverLetterInstructions || "",
      ...(Array.isArray(profile.coverLetterExamples) ? profile.coverLetterExamples : []),
      JSON.stringify(profile.candidateProfile || {}),
    ].join("\n"),
  );
}

function simpleHash(value) {
  let hash = 0;
  const text = String(value || "");

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0;
  }

  return Math.abs(hash).toString(16);
}

function renderJobMeta(report) {
  const meta = inferReportJobMeta(report);
  const hasMeta = Boolean(meta.title || meta.company);

  elements.jobMetaCard?.classList.toggle("hidden", !hasMeta);
  if (!hasMeta) return;

  if (elements.resultRole) {
    elements.resultRole.textContent = meta.title || "Untitled role";
  }

  if (elements.resultCompany) {
    elements.resultCompany.textContent = meta.company || "Not provided";
  }
}

function inferReportJobMeta(report) {
  const text = elements.jobText?.value || "";
  const titleFromText = matchLineValue(text, /^(?:job\s*)?title\s*:\s*(.+)$/im);
  const companyFromText = matchLineValue(text, /^company\s*:\s*(.+)$/im);
  const sourceTitle = cleanUiText(report?.source?.pageTitle || "");
  const titleFromPage = sourceTitle
    .replace(/\s+-\s+SEEK$/i, "")
    .replace(/\s+Job in .+$/i, "")
    .replace(/\s+\|\s+.+$/i, "")
    .trim();

  return {
    title: cleanUiText(titleFromText || titleFromPage).slice(0, 90),
    company: cleanUiText(companyFromText).slice(0, 90),
  };
}

function matchLineValue(text, pattern) {
  const match = text.match(pattern);
  return cleanUiText(match?.[1] || "");
}

function cleanUiText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, " ")
    .trim();
}

function renderRequirementAlert(container, findings) {
  if (!container) return;

  const visibleFindings = (findings || []).filter((finding) => finding.status !== "matched");
  const primary = visibleFindings[0];

  container.replaceChildren();

  if (!primary) {
    container.className = "requirementAlert hidden";
    return;
  }

  const isBlocker = primary.status === "blocked";
  const title = isBlocker
    ? "Likely blocker"
    : primary.severity === "hard"
      ? "Check before applying"
      : "Requirement to check";

  container.className = `requirementAlert ${isBlocker ? "blocker" : "warningAlert"}`;

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = title;

  const message = document.createElement("p");
  message.className = "requirementMessage";
  message.textContent = primary.message || "Check this requirement before applying.";

  container.append(eyebrow, message);

  if (primary.jobEvidence) {
    const evidence = document.createElement("p");
    evidence.className = "requirementEvidence";
    evidence.textContent = `Job says: ${primary.jobEvidence}`;
    container.append(evidence);
  }

  if (visibleFindings.length > 1) {
    const extra = document.createElement("p");
    extra.className = "requirementEvidence";
    extra.textContent = `${visibleFindings.length - 1} more requirement${visibleFindings.length > 2 ? "s" : ""} to check.`;
    container.append(extra);
  }
}

function renderChips(container, items) {
  container.replaceChildren(
    ...items.map((item) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = item;
      return chip;
    }),
  );
}

function renderList(container, items) {
  container.replaceChildren(
    ...items.map((item) => {
      const listItem = document.createElement("li");
      listItem.textContent = item;
      return listItem;
    }),
  );
}

async function copyReport() {
  if (!lastReport) return;

  const analysis = lastReport.analysis;
  const enrichment = lastReport.enrichment || {};
  const dynamicRequirements = analysis.dynamicRequirements || {};
  const mustHave = Array.isArray(dynamicRequirements.mustHave) ? dynamicRequirements.mustHave : [];
  const expectedWork = Array.isArray(dynamicRequirements.expectedWork) ? dynamicRequirements.expectedWork : [];
  const lines = [
    "RoleGuage fit report",
    `Decision: ${analysis.decision} (${analysis.score}/100)`,
    `Summary: ${enrichment.summary || analysis.summary}`,
    `Next step: ${enrichment.nextStep || analysis.nextStep}`,
    `Matched: ${analysis.matchedSkills.join(", ") || "None"}`,
    `Gaps: ${analysis.missingSkills.join(", ") || "None"}`,
    mustHave.length ? `Main requirements:\n${mustHave.slice(0, 7).map((item) => `- ${item.requirement}${item.matched ? " (found)" : ""}`).join("\n")}` : "",
    expectedWork.length ? `Expected work:\n${expectedWork.slice(0, 5).map((item) => `- ${item}`).join("\n")}` : "",
    enrichment.coverLetter ? `Cover letter:\n${enrichment.coverLetter}` : "",
  ];

  await navigator.clipboard.writeText(lines.filter(Boolean).join("\n"));
  setStatus("Report copied.");
}

async function copyCoverLetter() {
  const coverLetter = (lastReport?.enrichment?.coverLetter || "").trim();

  if (!coverLetter) return;

  await navigator.clipboard.writeText(coverLetter);
  elements.copyCoverLetter.textContent = "✓ Copied";
  elements.copyCoverLetter.classList.add("success");
  setStatus("Cover letter copied.");
  window.setTimeout(() => {
    elements.copyCoverLetter.textContent = "Copy";
    elements.copyCoverLetter.classList.remove("success");
  }, 1500);
}

function exportCoverLetterDocx() {
  const coverLetter = (lastReport?.enrichment?.coverLetter || "").trim();

  if (!coverLetter) return;

  downloadBlob(`${getCoverLetterFileBaseName()}.docx`, createDocxBlob(coverLetter));
  setStatus("Cover letter DOCX downloaded.");
}

function exportCoverLetterPdf() {
  const coverLetter = (lastReport?.enrichment?.coverLetter || "").trim();

  if (!coverLetter) return;

  downloadBlob(`${getCoverLetterFileBaseName()}.pdf`, createPdfBlob(coverLetter));
  setStatus("Cover letter PDF downloaded.");
}

async function openApp() {
  await chrome.tabs.create({ url: API_BASE });
}

function getCoverLetterFileBaseName() {
  const title = elements.jobText.dataset.pageTitle || "cover-letter";
  return `${slugify(title) || "cover-letter"}-cover-letter`;
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function createDocxBlob(text) {
  const files = [
    {
      path: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    },
    {
      path: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    },
    {
      path: "word/document.xml",
      content: buildDocumentXml(text),
    },
  ];

  return new Blob([createZip(files)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

function buildDocumentXml(text) {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const body = paragraphs
    .map((paragraph) => {
      const lines = paragraph.split("\n");
      const runs = lines
        .map((line, index) => {
          const textNode = `<w:t xml:space="preserve">${escapeXml(line)}</w:t>`;
          return index === 0 ? textNode : `<w:br/>${textNode}`;
        })
        .join("");

      return `<w:p><w:r>${runs}</w:r></w:p>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function createPdfBlob(text) {
  const lines = wrapPdfText(text);
  const pages = [];
  const linesPerPage = 42;

  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }

  if (!pages.length) {
    pages.push([""]);
  }

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  ];

  pages.forEach((pageLines, index) => {
    const pageObject = 3 + index * 2;
    const contentObject = pageObject + 1;
    const stream = buildPdfContentStream(pageLines);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents ${contentObject} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(chunks.join("").length);
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  });

  const xrefOffset = chunks.join("").length;
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  offsets.slice(1).forEach((offset) => {
    chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  });
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Blob([chunks.join("")], { type: "application/pdf" });
}

function buildPdfContentStream(lines) {
  const output = ["BT", "/F1 11 Tf", "50 742 Td", "14 TL"];
  lines.forEach((line, index) => {
    if (index > 0) output.push("T*");
    output.push(`(${escapePdf(line)}) Tj`);
  });
  output.push("ET");
  return output.join("\n");
}

function wrapPdfText(text) {
  const wrapped = [];
  const maxLineLength = 88;

  text.replace(/\r\n/g, "\n").split("\n").forEach((line) => {
    if (!line.trim()) {
      wrapped.push("");
      return;
    }

    let current = "";
    line.split(/\s+/).forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > maxLineLength && current) {
        wrapped.push(current);
        current = word;
      } else {
        current = candidate;
      }
    });
    if (current) wrapped.push(current);
  });

  return wrapped;
}

function createZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  files.forEach((file) => {
    const name = encoder.encode(file.path);
    const content = encoder.encode(file.content);
    const crc = crc32(content);
    const local = new Uint8Array(30 + name.length + content.length);
    const localView = new DataView(local.buffer);

    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, content.length, true);
    localView.setUint32(22, content.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(content, 30 + name.length);
    localParts.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, content.length, true);
    centralView.setUint32(24, content.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    centralParts.push(central);

    offset += local.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  return new Blob([...localParts, ...centralParts, end]);
}

function crc32(input) {
  let crc = 0xffffffff;

  for (const byte of input) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapePdf(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function setBusy(isBusy, message) {
  elements.uploadResume.disabled = isBusy;
  elements.saveResume.disabled = isBusy;
  elements.clearResume.disabled = isBusy;
  elements.deleteResume.disabled = isBusy;
  elements.extractJob.disabled = isBusy;
  elements.analyze.disabled = isBusy;

  if (message) {
    setStatus(message);
  }
}

function showLoadingCard(isLoading) {
  elements.loadingCard?.classList.toggle("hidden", !isLoading);
  if (isLoading) {
    elements.result?.classList.add("hidden");
  }
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

function extractJobTextFromPage() {
  const selectedText = window.getSelection?.().toString().trim();
  const pageTitle = document.title || "";
  const pageUrl = location.href;

  if (selectedText && selectedText.length > 120) {
    return {
      pageTitle,
      pageUrl,
      jobText: cleanText(selectedText),
    };
  }

  if (location.hostname.includes("seek.")) {
    const seekJob = extractSeekJob();

    if (seekJob.length > 120) {
      return {
        pageTitle,
        pageUrl,
        jobText: seekJob.slice(0, 18000),
      };
    }
  }

  if (location.hostname.includes("linkedin.")) {
    const linkedInJob = extractLinkedInJob();

    if (linkedInJob.length > 120) {
      return {
        pageTitle,
        pageUrl,
        jobText: linkedInJob.slice(0, 18000),
      };
    }
  }

  if (location.hostname.includes("indeed.")) {
    const indeedJob = extractIndeedJob();

    if (indeedJob.length > 120) {
      return {
        pageTitle,
        pageUrl,
        jobText: indeedJob.slice(0, 18000),
      };
    }
  }

  const titleText = getFirstText([
    "h1",
    "[data-automation='job-detail-title']",
    "[data-testid*='job-title' i]",
    "[data-test*='job-title' i]",
    "[class*='job-title' i]",
  ]);
  const companyText = getFirstText([
    "[data-automation='advertiser-name']",
    "[data-testid*='company' i]",
    "[data-test*='company' i]",
    "[class*='company' i]",
  ]);
  const locationText = getFirstText([
    "[data-automation='job-detail-location']",
    "[data-testid*='location' i]",
    "[data-test*='location' i]",
    "[class*='location' i]",
  ]);
  const descriptionText = getBestDescriptionText();
  const combined = [titleText, companyText, locationText, descriptionText]
    .filter(Boolean)
    .join("\n\n");

  return {
    pageTitle,
    pageUrl,
    jobText: cleanText(combined).slice(0, 18000),
  };

  function extractSeekJob() {
    const detailsPage = document.querySelector("[data-automation='jobDetailsPage']");
    const title = getTextFrom(detailsPage, "[data-automation='job-detail-title']");
    const company = getTextFrom(detailsPage, "[data-automation='advertiser-name']");
    const locationText = getTextFrom(detailsPage, "[data-automation='job-detail-location']");
    const workType = getTextFrom(detailsPage, "[data-automation='job-detail-work-type']");
    const classifications = getTextFrom(detailsPage, "[data-automation='job-detail-classifications']");
    const adDetails = detailsPage?.querySelector("[data-automation='jobAdDetails']");
    const postedText = findSeekSignal(detailsPage, /posted\s+\d+/i);
    const applicationVolume = findSeekSignal(detailsPage, /application volume/i);
    const employerQuestions = extractSeekEmployerQuestions(detailsPage);
    const description = cleanSeekText(adDetails?.innerText || adDetails?.textContent || "");
    const parts = [
      title ? `Job title: ${title}` : "",
      company ? `Company: ${company}` : "",
      locationText ? `Location: ${locationText}` : "",
      workType ? `Work type: ${workType}` : "",
      classifications ? `Category: ${classifications}` : "",
      postedText ? `Posted: ${postedText}` : "",
      applicationVolume ? `Application volume: ${applicationVolume}` : "",
      description,
      employerQuestions,
    ];

    return cleanText(parts.filter(Boolean).join("\n\n"));
  }

  function extractIndeedJob() {
    const root =
      document.querySelector("#job-full-details") ||
      document.querySelector("#vjs-container") ||
      document.querySelector(".jobsearch-ViewJobContainer");

    if (!root) return "";

    const title = cleanIndeedText(
      getTextFrom(root, "[data-testid='jobsearch-JobInfoHeader-title']") ||
        getTextFrom(root, ".jobsearch-JobInfoHeader-title") ||
        getTextFrom(root, "h1, h2"),
    ).replace(/\s+-\s+job post$/i, "");
    const company = cleanIndeedText(
      getTextFrom(root, "[data-testid='inlineHeader-companyName']") ||
        getTextFrom(root, "[data-company-name='true']") ||
        getTextFrom(root, "#companyLink"),
    );
    const locationText = cleanIndeedText(
      getTextFrom(root, "[data-testid='inlineHeader-companyLocation'] [data-testid='job-location']") ||
        getTextFrom(root, "#jobLocationText [data-testid='job-location']") ||
        getTextFrom(root, "[data-testid='job-location']"),
    );
    const payAndType = cleanIndeedText(getTextFrom(root, "#salaryInfoAndJobType"));
    const description = cleanIndeedText(getTextFrom(root, "#jobDescriptionText"));
    const parts = [
      title ? `Job title: ${title}` : "",
      company ? `Company: ${company}` : "",
      locationText ? `Location: ${locationText}` : "",
      payAndType ? `Pay / job type: ${payAndType}` : "",
      description ? `Full job description\n${description}` : "",
    ];

    return cleanText(parts.filter(Boolean).join("\n\n"));
  }

  function extractLinkedInJob() {
    const detailsPane = getLinkedInDetailsPane();

    if (!detailsPane) return "";

    const lines = cleanLinkedInText(detailsPane.innerText || detailsPane.textContent || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const title = getLinkedInTitle(detailsPane, lines);
    const company = getLinkedInCompany(detailsPane, lines);
    const locationAndMeta = getLinkedInLocationAndMeta(lines, title, company);
    const description = getLinkedInDescription(lines);
    const parts = [
      title ? `Job title: ${title}` : "",
      company ? `Company: ${company}` : "",
      locationAndMeta,
      description,
    ];

    return cleanText(parts.filter(Boolean).join("\n\n"));
  }

  function getLinkedInDetailsPane() {
    const selectors = [
      "[data-sdui-screen*='SemanticJobDetails']",
      ".jobs-search__job-details--container",
      ".jobs-search__job-details",
      ".jobs-details",
      ".job-view-layout",
    ];

    for (const selector of selectors) {
      const node = document.querySelector(selector);
      const text = cleanText(node?.innerText || node?.textContent || "");

      if (text.length > 300 && /about the job|apply|full-time|hybrid|remote|on-site/i.test(text)) {
        return node;
      }
    }

    const candidates = Array.from(document.querySelectorAll("main, aside, section, div"))
      .map((node) => ({
        node,
        text: cleanText(node.innerText || node.textContent || ""),
      }))
      .filter(({ text }) => text.length > 500 && /about the job/i.test(text))
      .sort((a, b) => scoreLinkedInPane(b.text) - scoreLinkedInPane(a.text));

    return candidates[0]?.node || null;
  }

  function scoreLinkedInPane(text) {
    const lower = text.toLowerCase();
    const hasListNoise = lower.includes("jobs based on your preferences") || lower.includes("99+ results");
    const keywordScore = [
      "about the job",
      "apply",
      "full-time",
      "hybrid",
      "remote",
      "people clicked apply",
      "responses managed",
    ].reduce((score, keyword) => score + (lower.includes(keyword) ? 1000 : 0), 0);

    return keywordScore + Math.min(text.length, 8000) - (hasListNoise ? 5000 : 0);
  }

  function getLinkedInTitle(root, lines) {
    const linkedTitle = Array.from(root.querySelectorAll("a[href*='/jobs/view/']"))
      .map((node) => cleanLinkedInText(node.innerText || node.textContent || ""))
      .find((text) => text.length > 3 && text.length < 120 && !/^show|^apply/i.test(text));

    if (linkedTitle) return linkedTitle;

    return lines.find((line) => line.length > 3 && line.length < 120 && !isLinkedInNoiseLine(line)) || "";
  }

  function getLinkedInCompany(root, lines) {
    const companyLink = Array.from(root.querySelectorAll("a[href*='/company/']"))
      .map((node) => cleanLinkedInText(node.innerText || node.textContent || ""))
      .find((text) => text.length > 1 && text.length < 100 && !/^show|^view/i.test(text));

    if (companyLink) return companyLink;

    const companyMeta = lines.find((line) => line.includes(" • ") && !line.toLowerCase().includes("promoted"));

    return companyMeta?.split(" • ")[0]?.trim() || "";
  }

  function getLinkedInLocationAndMeta(lines, title, company) {
    const usefulLines = [];

    for (const line of lines) {
      const lower = line.toLowerCase();
      const isUseful =
        line.includes("•") ||
        lower.includes("hybrid") ||
        lower.includes("remote") ||
        lower.includes("on-site") ||
        lower.includes("full-time") ||
        lower.includes("part-time") ||
        lower.includes("contract") ||
        lower.includes("people clicked apply") ||
        lower.includes("responses managed off linkedin") ||
        lower.includes("promoted by hirer");

      if (!isUseful) continue;
      if (line === title || line === company) continue;
      if (isLinkedInNoiseLine(line)) continue;

      usefulLines.push(line);
    }

    return uniqueLines(usefulLines).slice(0, 6).join("\n");
  }

  function getLinkedInDescription(lines) {
    const startIndex = lines.findIndex((line) => line.toLowerCase() === "about the job");

    if (startIndex === -1) return "";

    const stopPatterns = [
      /^people you can reach out to$/i,
      /^school alumni/i,
      /^meet the hiring team$/i,
      /^about the company$/i,
      /^similar jobs$/i,
      /^job search faster with premium$/i,
      /^access company insights/i,
      /^try premium/i,
      /^premium$/i,
      /^show more$/i,
      /^show all$/i,
      /^company photos$/i,
    ];
    const descriptionLines = [];

    for (let index = startIndex; index < lines.length; index += 1) {
      const line = lines[index];
      const enoughDescription = descriptionLines.join("\n").length > 500;

      if (enoughDescription && stopPatterns.some((pattern) => pattern.test(line))) {
        break;
      }

      if (isLinkedInNoiseLine(line)) continue;
      descriptionLines.push(line);
    }

    return cleanText(uniqueLines(descriptionLines).join("\n"));
  }

  function cleanLinkedInText(value) {
    return cleanText(value)
      .replace(/\u00b7/g, "•")
      .replace(/\u2060/g, "")
      .replace(/\s+•\s+/g, " • ");
  }

  function isLinkedInNoiseLine(line) {
    const normalized = line.trim().toLowerCase();
    const exactNoise = new Set([
      "save",
      "apply",
      "show all",
      "show more",
      "show less",
      "back to results list",
      "more options",
      "beta • is this information helpful?",
      "your profile and resume match some required qualifications",
      "show match details",
      "people you can reach out to",
      "job search faster with premium",
      "try premium for a$0",
      "1-month free trial. easy to cancel. we’ll remind you 7 days before your trial ends.",
    ]);
    const noisePatterns = [
      /^company logo for/i,
      /^verified job$/i,
      /^view company photo$/i,
      /^jobs based on your preferences/i,
      /^\d+\+ results$/i,
      /^how promoted jobs are ranked$/i,
      /^selected,/i,
      /^viewed$/i,
      /^easy apply$/i,
      /^be an early applicant$/i,
      /^school alumni/i,
      /^company alumni/i,
      /^connections? work here/i,
      /^access company insights/i,
      /^.+ and millions of other members use premium$/i,
      /^actvely reviewing applicants/i,
      /^actively reviewing applicants/i,
      /^compare /i,
    ];

    if (exactNoise.has(normalized)) return true;

    return noisePatterns.some((pattern) => pattern.test(line));
  }

  function uniqueLines(lines) {
    const seen = new Set();

    return lines.filter((line) => {
      const key = line.toLowerCase();

      if (seen.has(key)) return false;
      seen.add(key);

      return true;
    });
  }

  function extractSeekEmployerQuestions(root) {
    const headings = Array.from(root?.querySelectorAll("h2") || []);
    const employerQuestionHeading = headings.find((heading) =>
      cleanText(heading.innerText || heading.textContent || "").toLowerCase() === "employer questions",
    );
    const section = employerQuestionHeading?.closest("section");
    const questions = Array.from(section?.querySelectorAll("li") || [])
      .map((item) => cleanSeekText(item.innerText || item.textContent || ""))
      .filter((item) => item.length > 12);

    if (!questions.length) return "";

    return ["Employer questions:", ...questions.map((question) => `- ${question}`)].join("\n");
  }

  function findSeekSignal(root, pattern) {
    const nodes = Array.from(root?.querySelectorAll("span, div") || []);
    const match = nodes
      .map((node) => cleanText(node.innerText || node.textContent || ""))
      .find((text) => text.length < 80 && pattern.test(text));

    return match || "";
  }

  function getTextFrom(root, selector) {
    const node = root?.querySelector(selector) || document.querySelector(selector);

    return cleanText(node?.innerText || node?.textContent || "");
  }

  function getBestDescriptionText() {
    const selectors = [
      "[data-automation='jobAdDetails']",
      "[data-automation='jobDetailsPage'] [data-automation='jobAdDetails']",
      "[data-testid*='job-description' i]",
      "[data-test*='job-description' i]",
      "[id*='jobDescription' i]",
      "[id*='job-description' i]",
      "[class*='jobDescription' i]",
      "[class*='job-description' i]",
      "[class*='description' i]",
      "article",
      "main",
    ];
    const candidates = selectors
      .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
      .map((node) => cleanText(node.innerText || node.textContent || ""))
      .filter((text) => text.length > 300)
      .sort((a, b) => scoreText(b) - scoreText(a));

    return candidates[0] || cleanText(document.body.innerText || "").slice(0, 18000);
  }

  function scoreText(text) {
    const lower = text.toLowerCase();
    const keywords = [
      "responsibilities",
      "requirements",
      "qualifications",
      "about the role",
      "what you'll do",
      "experience",
      "skills",
      "apply",
    ];
    const keywordScore = keywords.reduce((score, keyword) => score + (lower.includes(keyword) ? 800 : 0), 0);
    const lengthScore = Math.min(text.length, 6000);

    return keywordScore + lengthScore;
  }

  function getFirstText(selectors) {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      const text = cleanText(node?.innerText || node?.textContent || "");

      if (text.length > 2 && text.length < 240) {
        return text;
      }
    }

    return "";
  }

  function cleanText(value) {
    return String(value)
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  function cleanSeekText(value) {
    const removeExact = new Set([
      "View all jobs",
      "Add expected salary to your profile for insights",
      "How you match",
      "Skills and credentials from the job description",
      "Apply now",
      "Quick apply",
      "Save",
      "Report this job advert",
      "Report this job ad",
      "Be careful",
      "Learn how to protect yourself",
      "Your email address",
      "Reason for reporting job",
      "Additional comments",
      "Report job",
      "Cancel",
    ]);
    const removePatterns = [
      /^\+\d+\s+more/i,
      /^don.?t provide your bank or credit card details/i,
      /^to help fast track investigation/i,
      /^what can i earn as/i,
      /^see more detailed salary information/i,
      /^please select$/i,
      /^fraudulent$/i,
      /^discrimination$/i,
      /^misleading$/i,
      /^salary below minimum wage$/i,
    ];

    return String(value)
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => {
        if (!line) return false;
        if (removeExact.has(line)) return false;

        return !removePatterns.some((pattern) => pattern.test(line));
      })
      .join("\n")
      .trim();
  }

  function cleanIndeedText(value) {
    const removeExact = new Set([
      "Job details",
      "Here’s how the job details align with your profile.",
      "Here's how the job details align with your profile.",
      "Location",
      "Estimated commute",
      "Add commute preference",
      "Job address",
      "Apply with Indeed",
      "Save job",
      "Not interested",
      "Share Job",
      "Report job",
    ]);
    const removePatterns = [
      /^welcome,\s+\S+/i,
      /^here.?s how the job details align with your profile/i,
      /^missing preference$/i,
      /^matching preference$/i,
      /^save-icon$/i,
      /^&nbsp;$/i,
    ];

    return String(value)
      .replace(/\u00a0/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => {
        if (!line) return false;
        if (removeExact.has(line)) return false;

        return !removePatterns.some((pattern) => pattern.test(line));
      })
      .join("\n")
      .trim();
  }
}
