const API_BASE = "http://localhost:3000";
const RESUME_KEYS = ["resume", "resumeFileName", "resumePageCount", "resumeUpdatedAt"];

const elements = {
  resume: document.querySelector("#resume"),
  resumeStateTitle: document.querySelector("#resumeStateTitle"),
  resumeMeta: document.querySelector("#resumeMeta"),
  resumeFile: document.querySelector("#resumeFile"),
  uploadResume: document.querySelector("#uploadResume"),
  reviewResume: document.querySelector("#reviewResume"),
  resumeEditor: document.querySelector("#resumeEditor"),
  jobText: document.querySelector("#jobText"),
  saveResume: document.querySelector("#saveResume"),
  clearResume: document.querySelector("#clearResume"),
  extractJob: document.querySelector("#extractJob"),
  analyze: document.querySelector("#analyze"),
  status: document.querySelector("#status"),
  result: document.querySelector("#result"),
  decision: document.querySelector("#decision"),
  level: document.querySelector("#level"),
  score: document.querySelector("#score"),
  summary: document.querySelector("#summary"),
  nextStep: document.querySelector("#nextStep"),
  matchedSkills: document.querySelector("#matchedSkills"),
  missingSkills: document.querySelector("#missingSkills"),
  resumeBullets: document.querySelector("#resumeBullets"),
  copyResult: document.querySelector("#copyResult"),
  openApp: document.querySelector("#openApp"),
};

let lastReport = null;

init();

async function init() {
  const saved = await chrome.storage.local.get(RESUME_KEYS);
  elements.resume.value = saved.resume || "";
  updateResumeUi(saved);

  elements.uploadResume.addEventListener("click", uploadResumePdf);
  elements.resumeFile.addEventListener("change", uploadResumePdf);
  elements.reviewResume.addEventListener("click", toggleResumeReview);
  elements.saveResume.addEventListener("click", saveResume);
  elements.clearResume.addEventListener("click", clearResume);
  elements.extractJob.addEventListener("click", extractJobFromActiveTab);
  elements.analyze.addEventListener("click", analyzeFit);
  elements.copyResult.addEventListener("click", copyReport);
  elements.openApp.addEventListener("click", openApp);
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

    await chrome.storage.local.set(resumeProfile);
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

  await chrome.storage.local.set(resumeProfile);
  updateResumeUi(resumeProfile);
  setStatus("Resume saved. Open a job ad and click Analyze this job.");
}

async function clearResume() {
  elements.resume.value = "";
  elements.resumeFile.value = "";
  await chrome.storage.local.remove(RESUME_KEYS);
  updateResumeUi({});
  setStatus("Resume cleared.");
}

function toggleResumeReview() {
  const isHidden = elements.resumeEditor.classList.toggle("hidden");
  elements.reviewResume.textContent = isHidden ? "Review" : "Hide";
}

function updateResumeUi(saved) {
  const resume = (saved.resume || elements.resume.value || "").trim();
  const hasResume = resume.length >= 80;
  const name = saved.resumeFileName || "Saved resume";
  const pages = saved.resumePageCount ? `${saved.resumePageCount} page${saved.resumePageCount === 1 ? "" : "s"}` : "";
  const chars = hasResume ? `${resume.length.toLocaleString()} characters` : "";

  elements.resumeStateTitle.textContent = hasResume ? "Resume saved" : "Upload resume once";
  elements.resumeMeta.textContent = hasResume
    ? [name, pages, chars].filter(Boolean).join(" - ")
    : "Upload a text-based PDF. RoleGuage stores only the extracted text in this browser.";
  elements.uploadResume.textContent = hasResume ? "Replace Resume PDF" : "Upload Resume PDF";
  elements.reviewResume.classList.toggle("hidden", !hasResume);
  elements.resumeEditor.classList.toggle("hidden", hasResume);
  elements.reviewResume.textContent = "Review";
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
  const saved = await chrome.storage.local.get(["resume"]);
  const resume = (saved.resume || elements.resume.value || "").trim();
  let job = elements.jobText.value.trim();

  if (resume.length < 80) {
    elements.resumeEditor.classList.remove("hidden");
    setStatus("Upload or save your resume first.", true);
    return;
  }

  setBusy(true, "Analyzing this job...");

  try {
    if (job.length < 80) {
      setStatus("Extracting this job page...");
      const payload = await extractJobFromActiveTab({ quiet: true });
      job = payload.jobText.trim();
    }

    const response = await fetch(`${API_BASE}/api/extension/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

    lastReport = data;
    renderResult(data);
    setStatus(data.enrichment?.aiStatus === "generated" ? "Personalized report ready." : "Report ready.");
  } catch (error) {
    setStatus(error.message || "Could not analyze this job.", true);
  } finally {
    setBusy(false);
  }
}

function renderResult(data) {
  const analysis = data.analysis;
  const enrichment = data.enrichment || {};
  const summary = enrichment.summary || analysis.summary;
  const nextStep = enrichment.nextStep || analysis.nextStep;
  const bullets = enrichment.resumeBullets?.length ? enrichment.resumeBullets : analysis.resumeBullets || [];

  elements.result.classList.remove("hidden");
  elements.decision.textContent = analysis.decision;
  elements.level.textContent = analysis.level;
  elements.score.textContent = analysis.score;
  elements.summary.textContent = summary;
  elements.nextStep.textContent = nextStep;
  renderChips(elements.matchedSkills, analysis.matchedSkills);
  renderChips(elements.missingSkills, analysis.missingSkills.length ? analysis.missingSkills : ["None"]);
  elements.resumeBullets.innerHTML = bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderChips(container, items) {
  container.innerHTML = items.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("");
}

async function copyReport() {
  if (!lastReport) return;

  const analysis = lastReport.analysis;
  const enrichment = lastReport.enrichment || {};
  const lines = [
    "RoleGuage fit report",
    `Decision: ${analysis.decision} (${analysis.score}/100)`,
    `Summary: ${enrichment.summary || analysis.summary}`,
    `Next step: ${enrichment.nextStep || analysis.nextStep}`,
    `Matched: ${analysis.matchedSkills.join(", ") || "None"}`,
    `Gaps: ${analysis.missingSkills.join(", ") || "None"}`,
  ];

  await navigator.clipboard.writeText(lines.join("\n"));
  setStatus("Report copied.");
}

async function openApp() {
  await chrome.tabs.create({ url: API_BASE });
}

function setBusy(isBusy, message) {
  elements.uploadResume.disabled = isBusy;
  elements.saveResume.disabled = isBusy;
  elements.clearResume.disabled = isBusy;
  elements.reviewResume.disabled = isBusy;
  elements.extractJob.disabled = isBusy;
  elements.analyze.disabled = isBusy;

  if (message) {
    setStatus(message);
  }
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
      "Welcome, Kulunu",
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
