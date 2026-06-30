const API_BASE = "http://localhost:3000";

const elements = {
  resume: document.querySelector("#resume"),
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
  const saved = await chrome.storage.local.get(["resume"]);
  elements.resume.value = saved.resume || "";

  elements.saveResume.addEventListener("click", saveResume);
  elements.clearResume.addEventListener("click", clearResume);
  elements.extractJob.addEventListener("click", extractJobFromActiveTab);
  elements.analyze.addEventListener("click", analyzeFit);
  elements.copyResult.addEventListener("click", copyReport);
  elements.openApp.addEventListener("click", openApp);
}

async function saveResume() {
  await chrome.storage.local.set({ resume: elements.resume.value.trim() });
  setStatus("Resume saved in Chrome local storage.");
}

async function clearResume() {
  elements.resume.value = "";
  await chrome.storage.local.remove(["resume"]);
  setStatus("Resume cleared.");
}

async function extractJobFromActiveTab() {
  setBusy(true, "Extracting the current page...");

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
    setStatus(`Extracted ${payload.jobText.length.toLocaleString()} characters from this page.`);
  } catch (error) {
    setStatus(error.message || "Could not extract this page.", true);
  } finally {
    setBusy(false);
  }
}

async function analyzeFit() {
  const resume = elements.resume.value.trim();
  const job = elements.jobText.value.trim();

  if (resume.length < 80) {
    setStatus("Paste or save a resume first.", true);
    return;
  }

  if (job.length < 80) {
    setStatus("Extract or paste the job description first.", true);
    return;
  }

  setBusy(true, "Analyzing fit...");

  try {
    await chrome.storage.local.set({ resume });

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
    const description = cleanText(adDetails?.innerText || adDetails?.textContent || "");
    const parts = [
      title ? `Job title: ${title}` : "",
      company ? `Company: ${company}` : "",
      locationText ? `Location: ${locationText}` : "",
      workType ? `Work type: ${workType}` : "",
      classifications ? `Category: ${classifications}` : "",
      description,
    ];

    return cleanText(parts.filter(Boolean).join("\n\n"));
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
}
