export type CandidateProfile = {
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

export type RequirementFinding = {
  type: "work_rights" | "sponsorship" | "licence" | "drivers_licence" | "clearance" | "graduate_eligibility" | "location" | "experience" | "salary";
  severity: "hard" | "warning" | "info";
  status: "blocked" | "unknown" | "matched" | "info";
  label: string;
  jobEvidence: string;
  candidateEvidence?: string;
  message: string;
};

export type RequirementCheckResult = {
  findings: RequirementFinding[];
  salary: string | null;
  scoreCap: number | null;
  scorePenalty: number;
  signals: string[];
};

const sentenceSplit = /(?<=[.!?])\s+|\n+/;

export function checkHardRequirements(
  resume: string,
  job: string,
  profile: CandidateProfile = {},
): RequirementCheckResult {
  const findings: RequirementFinding[] = [];
  const normalizedJob = normalize(job);
  const candidateFacts = buildCandidateFacts(resume, profile);
  const salary = extractSalary(job);

  addWorkRightsFindings(findings, job, normalizedJob, candidateFacts);
  addLicenceFindings(findings, job, normalizedJob, candidateFacts);
  addClearanceFindings(findings, job, normalizedJob, candidateFacts);
  addGraduateEligibilityFindings(findings, job, normalizedJob, candidateFacts);
  addLocationFindings(findings, job, normalizedJob, candidateFacts);
  addExperienceFindings(findings, job, normalizedJob, candidateFacts);
  addSalaryFinding(findings, salary, candidateFacts);

  const scoreCap = findings.reduce<number | null>((cap, finding) => {
    const findingCap = getScoreCap(finding);
    if (!findingCap) return cap;
    return cap === null ? findingCap : Math.min(cap, findingCap);
  }, null);
  const scorePenalty = findings.reduce((total, finding) => total + getScorePenalty(finding), 0);

  return {
    findings,
    salary,
    scoreCap,
    scorePenalty,
    signals: findings
      .filter((finding) => finding.status !== "matched")
      .map((finding) => finding.label)
      .slice(0, 4),
  };
}

export function formatRequirementFindingsForPrompt(findings: RequirementFinding[]) {
  const relevant = findings.filter((finding) => finding.status !== "matched");

  if (!relevant.length) return "Hard checks: none flagged";

  return [
    "Hard checks:",
    ...relevant.slice(0, 5).map((finding) => {
      const candidate = finding.candidateEvidence ? ` Candidate: ${finding.candidateEvidence}.` : "";
      return `- ${finding.status.toUpperCase()}: ${finding.label}. Job: ${finding.jobEvidence}.${candidate} ${finding.message}`;
    }),
  ].join("\n");
}

function buildCandidateFacts(resume: string, profile: CandidateProfile) {
  const combined = normalize(
    [
      resume,
      profile.workRights,
      profile.visaExpiry,
      profile.location,
      profile.workMode,
      profile.securityClearance,
      profile.licences,
      profile.minimumSalary,
      profile.targetRoles,
    ]
      .filter(Boolean)
      .join(" "),
  );

  return {
    raw: combined,
    workRights: profile.workRights?.trim() || extractWorkRights(resume),
    location: profile.location?.trim() || extractCandidateLocation(resume),
    workMode: profile.workMode?.trim() || "",
    driversLicence: profile.driversLicence || "",
    securityClearance: profile.securityClearance?.trim() || "",
    licences: profile.licences?.trim() || "",
    minimumSalary: profile.minimumSalary?.trim() || "",
    years: extractExperienceYears(combined),
  };
}

function addWorkRightsFindings(
  findings: RequirementFinding[],
  job: string,
  normalizedJob: string,
  candidate: ReturnType<typeof buildCandidateFacts>,
) {
  const citizenEvidence = findEvidence(job, [
    /Australian or New Zealand Citizen[^.]*Permanent Resident/i,
    /Australian\/NZ citizen[^.]*permanent resident/i,
    /citizen(?:ship)?[^.]{0,80}permanent resident/i,
    /permanent resident[^.]{0,80}citizen/i,
    /\bPR only\b/i,
  ]);

  if (citizenEvidence) {
    const candidateEvidence = candidate.workRights || candidateStatusFromText(candidate.raw);
    const candidateNormalized = normalize(candidateEvidence);

    if (/(temporary|485|student|graduate visa|sponsorship required|requires sponsorship)/i.test(candidateNormalized)) {
      findings.push({
        type: "work_rights",
        severity: "hard",
        status: "blocked",
        label: "Citizen/PR requirement",
        jobEvidence: citizenEvidence,
        candidateEvidence,
        message: "This looks like a hard eligibility mismatch. Check with the employer before spending time applying.",
      });
    } else if (/(citizen|permanent resident|\bpr\b)/i.test(candidateNormalized)) {
      findings.push({
        type: "work_rights",
        severity: "info",
        status: "matched",
        label: "Citizen/PR requirement",
        jobEvidence: citizenEvidence,
        candidateEvidence,
        message: "Your profile appears to satisfy this work-rights requirement.",
      });
    } else {
      findings.push({
        type: "work_rights",
        severity: "hard",
        status: "unknown",
        label: "Citizen/PR requirement",
        jobEvidence: citizenEvidence,
        message: "This role asks for citizenship or permanent residency. Add work-rights details in Profile or confirm before applying.",
      });
    }
  }

  const noSponsorshipEvidence = findEvidence(job, [
    /(?:visa )?sponsorship (?:is )?(?:not available|not provided|unavailable)/i,
    /unable to sponsor/i,
    /must have (?:existing|current) (?:full |unrestricted )?work(?:ing)? rights/i,
    /full working rights/i,
    /unrestricted work(?:ing)? rights/i,
  ]);

  if (!noSponsorshipEvidence || citizenEvidence) return;

  const candidateEvidence = candidate.workRights || candidateStatusFromText(candidate.raw);
  const candidateNormalized = normalize(candidateEvidence);

  if (/(sponsorship required|requires sponsorship|need sponsorship)/i.test(candidateNormalized)) {
    findings.push({
      type: "sponsorship",
      severity: "hard",
      status: "blocked",
      label: "No sponsorship",
      jobEvidence: noSponsorshipEvidence,
      candidateEvidence,
      message: "The job appears to require existing work rights and no sponsorship.",
    });
  } else if (/(unrestricted|full working rights|citizen|permanent resident|\bpr\b|485)/i.test(candidateNormalized)) {
    findings.push({
      type: "sponsorship",
      severity: "info",
      status: "matched",
      label: "Work rights",
      jobEvidence: noSponsorshipEvidence,
      candidateEvidence,
      message: "Your profile appears to address this work-rights requirement.",
    });
  } else {
    findings.push({
      type: "sponsorship",
      severity: "warning",
      status: "unknown",
      label: "Work-rights check",
      jobEvidence: noSponsorshipEvidence,
      message: "The job asks about work rights. Add your work-rights status in Profile to check this automatically.",
    });
  }

  void normalizedJob;
}

function addLicenceFindings(
  findings: RequirementFinding[],
  job: string,
  normalizedJob: string,
  candidate: ReturnType<typeof buildCandidateFacts>,
) {
  const driverEvidence = findEvidence(job, [
    /(?:current |valid )?(?:Australian )?driver'?s licence/i,
    /own (?:car|vehicle)/i,
    /reliable vehicle/i,
  ]);

  if (driverEvidence) {
    if (candidate.driversLicence === "yes" || /driver'?s licence|drivers licence|driving licence/.test(candidate.raw)) {
      findings.push({
        type: "drivers_licence",
        severity: "info",
        status: "matched",
        label: "Driver licence",
        jobEvidence: driverEvidence,
        candidateEvidence: candidate.driversLicence === "yes" ? "Driver licence: yes" : "Resume mentions driver licence",
        message: "Your profile appears to satisfy this requirement.",
      });
    } else if (candidate.driversLicence === "no") {
      findings.push({
        type: "drivers_licence",
        severity: "hard",
        status: "blocked",
        label: "Driver licence required",
        jobEvidence: driverEvidence,
        candidateEvidence: "Driver licence: no",
        message: "This may block the application unless the employer can waive it.",
      });
    } else {
      findings.push({
        type: "drivers_licence",
        severity: "warning",
        status: "unknown",
        label: "Driver licence required",
        jobEvidence: driverEvidence,
        message: "This job asks for a driver licence. Add this in Profile to check it automatically.",
      });
    }
  }

  const licenceEvidence = findEvidence(job, [
    /(?:current |valid )?(?:real estate|agent'?s|property|CPA|CA|PMP|CFA|forklift|working with children|WWCC)[^.]{0,80}(?:licen[cs]e|certificate|certification|registration)/i,
    /(?:licen[cs]e|certificate|certification|registration) (?:is )?(?:required|essential)/i,
  ]);

  if (!licenceEvidence || driverEvidence === licenceEvidence) return;

  const licenceText = normalize(candidate.licences || candidate.raw);

  if (licenceText && hasMeaningfulOverlap(licenceEvidence, licenceText)) {
    findings.push({
      type: "licence",
      severity: "info",
      status: "matched",
      label: "Licence/certification",
      jobEvidence: licenceEvidence,
      candidateEvidence: candidate.licences || "Resume mentions a related licence/certification",
      message: "Your profile appears to cover this requirement.",
    });
  } else {
    findings.push({
      type: "licence",
      severity: "hard",
      status: candidate.licences ? "blocked" : "unknown",
      label: "Licence/certification required",
      jobEvidence: licenceEvidence,
      candidateEvidence: candidate.licences || undefined,
      message: candidate.licences
        ? "Your saved profile does not appear to include this required licence."
        : "This job asks for a specific licence or certification. Add licences in Profile to check it automatically.",
    });
  }

  void normalizedJob;
}

function addClearanceFindings(
  findings: RequirementFinding[],
  job: string,
  normalizedJob: string,
  candidate: ReturnType<typeof buildCandidateFacts>,
) {
  const clearanceEvidence = findEvidence(job, [
    /(?:baseline|NV1|NV2|AGSVA|security) clearance[^.]*/i,
    /must be eligible for (?:a )?clearance/i,
  ]);

  if (!clearanceEvidence) return;

  const candidateClearance = normalize(candidate.securityClearance || candidate.raw);
  const hasClearance = /baseline|nv1|nv2|agsva|security clearance/.test(candidateClearance);

  findings.push({
    type: "clearance",
    severity: hasClearance ? "info" : "hard",
    status: hasClearance ? "matched" : candidate.securityClearance ? "blocked" : "unknown",
    label: "Security clearance",
    jobEvidence: clearanceEvidence,
    candidateEvidence: candidate.securityClearance || (hasClearance ? "Resume mentions clearance" : undefined),
    message: hasClearance
      ? "Your profile appears to address this clearance requirement."
      : "This job has a security-clearance requirement. Confirm eligibility before applying.",
  });

  void normalizedJob;
}

function addGraduateEligibilityFindings(
  findings: RequirementFinding[],
  job: string,
  normalizedJob: string,
  candidate: ReturnType<typeof buildCandidateFacts>,
) {
  const gradYearEvidence = findEvidence(job, [
    /(?:completed|completing|graduat(?:ed|ing))[^.]{0,80}(?:2024|2025|2026|2027)/i,
    /undergraduate degree[^.]{0,80}(?:2024|2025|2026|2027)/i,
    /graduate program/i,
  ]);

  if (!gradYearEvidence) return;

  const resumeYears = Array.from(candidate.raw.matchAll(/\b(2024|2025|2026|2027)\b/g)).map((match) => match[1]);
  const jobYears = Array.from(gradYearEvidence.matchAll(/\b(2024|2025|2026|2027)\b/g)).map((match) => match[1]);
  const hasYearOverlap = jobYears.length ? jobYears.some((year) => resumeYears.includes(year)) : true;

  if (!hasYearOverlap) {
    findings.push({
      type: "graduate_eligibility",
      severity: "warning",
      status: "unknown",
      label: "Graduate intake timing",
      jobEvidence: gradYearEvidence,
      message: "This graduate role has timing criteria. Check whether your graduation dates satisfy the intake rules.",
    });
  }

  void normalizedJob;
}

function addLocationFindings(
  findings: RequirementFinding[],
  job: string,
  normalizedJob: string,
  candidate: ReturnType<typeof buildCandidateFacts>,
) {
  const onsiteEvidence = findEvidence(job, [
    /(?:on-site|onsite|in person|in-person)[^.]*/i,
    /must be based in [^.]+/i,
    /based in (?:Melbourne|Sydney|Brisbane|Perth|Adelaide|Canberra)[^.]*/i,
  ]);

  if (!onsiteEvidence) return;

  const candidateLocation = normalize(candidate.location);
  const jobCities = ["melbourne", "sydney", "brisbane", "perth", "adelaide", "canberra"].filter((city) =>
    normalizedJob.includes(city),
  );
  const cityMismatch = candidateLocation && jobCities.length && !jobCities.some((city) => candidateLocation.includes(city));

  if (cityMismatch) {
    findings.push({
      type: "location",
      severity: "warning",
      status: "blocked",
      label: "Location constraint",
      jobEvidence: onsiteEvidence,
      candidateEvidence: candidate.location,
      message: "The job location may not match your saved location preference.",
    });
  } else if (!candidateLocation) {
    findings.push({
      type: "location",
      severity: "info",
      status: "unknown",
      label: "Location constraint",
      jobEvidence: onsiteEvidence,
      message: "This job has a location or on-site requirement. Add location preferences in Profile for automatic checks.",
    });
  }
}

function addExperienceFindings(
  findings: RequirementFinding[],
  job: string,
  normalizedJob: string,
  candidate: ReturnType<typeof buildCandidateFacts>,
) {
  const experienceEvidence = findEvidence(job, [
    /(?:minimum|at least)?\s*\d{1,2}\+?\s+years?[^.]*(?:experience|commercial|professional)/i,
    /(?:experience|commercial experience|professional experience)[^.]{0,50}\d{1,2}\+?\s+years?/i,
  ]);

  if (!experienceEvidence) return;

  const requiredYears = extractExperienceYears(normalize(experienceEvidence));
  if (!requiredYears) return;

  if (candidate.years && candidate.years < requiredYears) {
    findings.push({
      type: "experience",
      severity: "warning",
      status: requiredYears - candidate.years >= 2 ? "blocked" : "unknown",
      label: `${requiredYears}+ years required`,
      jobEvidence: experienceEvidence,
      candidateEvidence: `${candidate.years} years detected`,
      message: "The role asks for more experience than the profile clearly shows.",
    });
  }

  void normalizedJob;
}

function addSalaryFinding(
  findings: RequirementFinding[],
  salary: string | null,
  candidate: ReturnType<typeof buildCandidateFacts>,
) {
  if (!salary) return;

  const minimumSalary = Number((candidate.minimumSalary || "").replace(/[^0-9]/g, ""));
  if (!minimumSalary) return;

  const salaryNumbers = Array.from(salary.matchAll(/\$?\s*(\d{2,3})(?:,\d{3})?\s*k?/gi))
    .map((match) => Number(match[1]) * (salary.toLowerCase().includes("k") ? 1000 : match[0].includes(",") ? 1000 : 1))
    .filter(Number.isFinite);
  const maxSalary = salaryNumbers.length ? Math.max(...salaryNumbers) : 0;

  if (maxSalary && maxSalary < minimumSalary) {
    findings.push({
      type: "salary",
      severity: "info",
      status: "blocked",
      label: "Below salary target",
      jobEvidence: salary,
      candidateEvidence: `$${minimumSalary.toLocaleString()} minimum`,
      message: "The listed salary appears below your saved minimum.",
    });
  }
}

function getScoreCap(finding: RequirementFinding) {
  if (finding.status === "matched" || finding.status === "info") return null;

  if (finding.type === "work_rights" && finding.status === "blocked") return 45;
  if (finding.type === "work_rights" && finding.status === "unknown") return 72;
  if (finding.type === "sponsorship" && finding.status === "blocked") return 45;
  if (finding.type === "licence" && finding.status === "blocked") return 55;
  if (finding.type === "drivers_licence" && finding.status === "blocked") return 55;
  if (finding.type === "clearance") return 58;
  if (finding.type === "experience" && finding.status === "blocked") return 62;
  if (finding.type === "location" && finding.status === "blocked") return 65;
  if (finding.type === "salary" && finding.status === "blocked") return 68;

  return null;
}

function getScorePenalty(finding: RequirementFinding) {
  if (finding.status === "matched" || finding.status === "info") return 0;
  if (finding.severity === "hard" && finding.status === "blocked") return 28;
  if (finding.severity === "hard") return 14;
  if (finding.status === "blocked") return 12;
  return 6;
}

function findEvidence(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const direct = text.replace(/\s+/g, " ").match(pattern)?.[0]?.trim();
    if (direct) {
      return trimEvidence(direct);
    }
  }

  return "";
}

function extractSalary(text: string) {
  const normalized = text.replace(/\s+/g, " ");
  const dollarMatch = normalized.match(
    /\$\s?\d{2,3}(?:,\d{3})?(?:\s?-\s?\$?\s?\d{2,3}(?:,\d{3})?)?(?:\s?(?:plus super|super|package|base|per year|annually))?/i,
  );
  if (dollarMatch && !looksLikeNonSalaryPayment(normalized, dollarMatch.index ?? 0)) {
    return dollarMatch[0].trim();
  }

  const shorthandMatch = normalized.match(/\b\d{2,3}k\s?-\s?\d{2,3}k\b/i);
  if (shorthandMatch) return shorthandMatch[0].trim();

  return null;
}

function trimEvidence(text: string) {
  return text.length > 180 ? `${text.slice(0, 177).trim()}...` : text;
}

function looksLikeNonSalaryPayment(text: string, index: number) {
  const context = text.slice(Math.max(0, index - 80), index + 120).toLowerCase();

  return /reimbursement|home office|discount|allowance|bonus|gift card|employee assistance|purchase up to/.test(context);
}

function extractWorkRights(text: string) {
  return findEvidence(text, [
    /485 Temporary Graduate Visa[^.]*/i,
    /unrestricted work rights[^.]*/i,
    /Australian citizen[^.]*/i,
    /permanent resident[^.]*/i,
    /requires sponsorship[^.]*/i,
  ]);
}

function extractCandidateLocation(text: string) {
  const match = text.match(/\b(Melbourne|Sydney|Brisbane|Perth|Adelaide|Canberra),?\s*(?:VIC|NSW|QLD|WA|SA|ACT)?\b/i);
  return match?.[0] ?? "";
}

function candidateStatusFromText(text: string) {
  return findEvidence(text, [
    /485 Temporary Graduate Visa[^.]*/i,
    /unrestricted work rights[^.]*/i,
    /Australian citizen[^.]*/i,
    /permanent resident[^.]*/i,
    /requires sponsorship[^.]*/i,
  ]);
}

function hasMeaningfulOverlap(evidence: string, candidateText: string) {
  const terms = normalize(evidence)
    .split(/[^a-z0-9+#.]+/)
    .filter((term) => term.length >= 4 && !["required", "essential", "current", "valid", "licence", "license", "certificate"].includes(term));

  return terms.some((term) => candidateText.includes(term));
}

function extractExperienceYears(normalizedText: string) {
  const matches = Array.from(normalizedText.matchAll(/(\d{1,2})\+?\s+years?/g));
  const years = matches.map((match) => Number(match[1])).filter(Number.isFinite);

  return years.length ? Math.max(...years) : 0;
}

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}
