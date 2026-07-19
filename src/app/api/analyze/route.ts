import { NextRequest, NextResponse } from "next/server";
import { cleanCandidateProfile } from "@/lib/account-profile";
import {
  cleanBoundedText,
  maxJobTextChars,
  maxResumeTextChars,
} from "@/lib/request-limits";
import { enforceRateLimit } from "@/lib/rate-limit";
import { DynamicRequirement, DynamicRequirementReport, extractDynamicJobRequirements } from "@/lib/job-requirements";
import { StructuredResumeProfile, extractStructuredResumeProfile, formatStructuredResumeForMatching } from "@/lib/resume-profile";
import { CandidateProfile, checkHardRequirements } from "@/lib/requirements";

type SkillDefinition = {
  name: string;
  category: "Language" | "Frontend" | "Backend" | "Data" | "Cloud" | "Product";
  weight: number;
  aliases: string[];
};

type Recommendation = {
  level: string;
  action: string;
  decision: "Apply" | "Tailor" | "Build" | "Skip";
  nextStep: string;
  timeToApply: string;
  confidence: string;
};

type RoleFit = {
  penalty: number;
  signals: string[];
};

const skillTaxonomy: SkillDefinition[] = [
  { name: "Python", category: "Language", weight: 9, aliases: ["python", "pandas", "numpy"] },
  { name: "Java", category: "Language", weight: 10, aliases: ["java"] },
  { name: "SQL", category: "Data", weight: 9, aliases: ["sql", "mysql", "postgres", "postgresql", "sql queries"] },
  { name: "TypeScript", category: "Language", weight: 7, aliases: ["typescript", "ts"] },
  { name: "JavaScript", category: "Language", weight: 6, aliases: ["javascript"] },
  { name: "React", category: "Frontend", weight: 7, aliases: ["react", "react.js", "reactjs"] },
  { name: "Next.js", category: "Frontend", weight: 6, aliases: ["next.js", "nextjs", "next js"] },
  { name: "Node.js", category: "Backend", weight: 7, aliases: ["node.js", "nodejs", "node js", "nestjs", "nest.js"] },
  { name: "Spring Boot", category: "Backend", weight: 9, aliases: ["spring boot", "springboot"] },
  { name: "Microservices", category: "Backend", weight: 8, aliases: ["microservices", "microservice"] },
  { name: "Kafka", category: "Backend", weight: 8, aliases: ["kafka", "messaging", "streaming", "event-driven", "event driven"] },
  { name: "PostgreSQL", category: "Backend", weight: 6, aliases: ["postgresql", "postgres"] },
  { name: "Machine learning", category: "Data", weight: 8, aliases: ["machine learning", "ml", "predictive modelling", "predictive modeling"] },
  { name: "NLP", category: "Data", weight: 6, aliases: ["nlp", "natural language processing", "text classification"] },
  { name: "Dashboards", category: "Data", weight: 7, aliases: ["dashboard", "dashboards", "bi dashboard", "reporting dashboard"] },
  { name: "Data analysis", category: "Data", weight: 8, aliases: ["data analysis", "data analytics", "business analytics"] },
  { name: "Power BI", category: "Data", weight: 6, aliases: ["power bi", "powerbi"] },
  { name: "Tableau", category: "Data", weight: 5, aliases: ["tableau"] },
  { name: "AWS", category: "Cloud", weight: 6, aliases: ["aws", "amazon web services"] },
  { name: "Azure", category: "Cloud", weight: 6, aliases: ["azure"] },
  { name: "GCP", category: "Cloud", weight: 6, aliases: ["gcp", "google cloud"] },
  { name: "Docker", category: "Cloud", weight: 5, aliases: ["docker", "container"] },
  { name: "CI/CD", category: "Cloud", weight: 6, aliases: ["ci/cd", "cicd", "ci cd", "continuous integration", "continuous delivery", "jenkins", "ansible"] },
  { name: "REST APIs", category: "Backend", weight: 7, aliases: ["rest api", "rest apis", "backend api", "backend apis", "building apis"] },
  { name: "LLM tools", category: "Product", weight: 5, aliases: ["llm", "large language model", "openai", "gemini", "generative ai"] },
  { name: "Experimentation", category: "Product", weight: 5, aliases: ["experiment", "experimentation", "a/b", "ab test"] },
  {
    name: "Stakeholder communication",
    category: "Product",
    weight: 8,
    aliases: [
      "stakeholder communication",
      "stakeholder management",
      "stakeholder engagement",
      "cross-functional",
      "cross functional",
      "client-facing",
      "customer-facing",
      "non-technical stakeholders",
      "business stakeholders",
    ],
  },
  { name: "ETL", category: "Data", weight: 6, aliases: ["etl", "extract transform load"] },
  { name: "Data pipelines", category: "Data", weight: 7, aliases: ["data pipeline", "data pipelines", "pipeline", "pipelines"] },
  { name: "Distributed processing", category: "Data", weight: 8, aliases: ["distributed processing", "spark", "ray", "dask", "emr", "tb scale", "pb scale", "terabyte", "petabyte"] },
  { name: "Data quality", category: "Data", weight: 7, aliases: ["data quality", "dedupe", "deduplication", "filter", "classifiers", "quality classification", "audit", "data cleaning"] },
  { name: "Training data", category: "Data", weight: 8, aliases: ["training data", "pretraining", "pre-training", "corpus", "dataset mixture", "tokenisation", "tokenization", "web-scale corpora"] },
  { name: "Cloud deployment", category: "Cloud", weight: 5, aliases: ["cloud deployment", "deployment", "deploy", "vercel", "netlify"] },
];

const roleSignalMap = [
  { name: "Sydney", aliases: ["sydney"] },
  { name: "Melbourne", aliases: ["melbourne"] },
  { name: "Brisbane", aliases: ["brisbane"] },
  { name: "Remote", aliases: ["remote"] },
  { name: "Hybrid", aliases: ["hybrid"] },
  { name: "Graduate", aliases: ["graduate", "entry level", "entry-level"] },
  { name: "Junior", aliases: ["junior", "associate"] },
  { name: "Senior", aliases: ["senior software engineer", "senior data analyst", "senior developer", "lead engineer", "principal engineer"] },
  { name: "Data role", aliases: ["data analyst", "data scientist", "bi developer"] },
  { name: "Product role", aliases: ["product engineer", "product analyst", "product manager"] },
  { name: "Stakeholder-facing", aliases: ["stakeholder", "client-facing", "customer-facing"] },
  { name: "Visa caution", aliases: ["citizen", "permanent resident", "pr only", "must have full working rights", "security clearance"] },
  { name: "Sponsorship signal", aliases: ["visa sponsorship", "sponsorship available", "relocation support"] },
];

const mustHavePatterns = [
  "must have",
  "required",
  "requires",
  "essential",
  "you have",
  "you will need",
  "minimum",
  "strong experience",
  "experience with",
  "solid understanding",
  "working knowledge",
  "exposure to",
  "what you'll bring",
  "what you will bring",
];

const seniorRolePatterns = [
  "senior",
  "lead",
  "principal",
  "head of",
  "manager",
  "director",
  "staff",
];

const roleFamilyChecks = [
  {
    name: "Software engineering",
    jobAliases: ["software engineer", "software developer", "fullstack", "full stack", "frontend", "backend", "developer"],
    resumeAliases: ["software engineer", "software developer", "web applications", "rest apis", "react", "typescript", "backend"],
    strict: false,
  },
  {
    name: "Data analyst",
    jobAliases: ["data analyst", "analytics analyst", "business analyst", "bi analyst", "reporting analyst"],
    resumeAliases: ["data analysis", "business analytics", "dashboards", "sql", "power bi", "tableau", "analytics"],
    strict: false,
  },
  {
    name: "Data scientist",
    jobAliases: ["data scientist", "machine learning scientist", "ml scientist", "research scientist", "applied scientist"],
    resumeAliases: ["data scientist", "machine learning", "predictive modelling", "predictive modeling", "nlp", "statistical model"],
    strict: true,
  },
  {
    name: "Data engineering",
    jobAliases: ["data engineer", "analytics engineer", "data officer", "data platform", "etl developer"],
    resumeAliases: ["data pipeline", "data pipelines", "etl", "postgresql", "sql", "cloud deployment"],
    strict: true,
  },
  {
    name: "AI data engineering",
    jobAliases: ["signal engineer", "training data", "pretraining", "corpus", "dataset mixture", "web-scale corpora"],
    resumeAliases: ["data pipeline", "data pipelines", "etl", "distributed processing", "spark", "ray", "deduplication", "training data", "pretraining", "corpus"],
    strict: true,
  },
  {
    name: "Product or stakeholder role",
    jobAliases: ["product manager", "product analyst", "product owner", "stakeholder", "decision makers", "messaging"],
    resumeAliases: ["stakeholder", "product", "dashboards", "business analytics", "cross-functional", "client-facing"],
    strict: false,
  },
];

export async function POST(request: NextRequest) {
  const rateLimited = enforceRateLimit(request, {
    key: "api:analyze",
    limit: 60,
    windowMs: 60_000,
  });

  if (rateLimited) return rateLimited;

  const body = (await request.json().catch(() => null)) as
    | { resume?: string; job?: string; profile?: CandidateProfile; structuredResumeProfile?: StructuredResumeProfile | null }
    | null;

  const resume = cleanBoundedText(body?.resume, maxResumeTextChars);
  const job = cleanBoundedText(body?.job, maxJobTextChars);

  if (resume.length < 80 || job.length < 80) {
    return NextResponse.json(
      { error: "Resume and job description must both be at least 80 characters." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ...(await analyzeResumeAgainstJobWithRequirements(
      resume,
      job,
      cleanCandidateProfile(body?.profile),
      body?.structuredResumeProfile ?? (await extractStructuredResumeProfile(resume)),
    )),
    aiStatus: "disabled",
  });
}

export async function analyzeResumeAgainstJobWithRequirements(
  resume: string,
  job: string,
  profile: CandidateProfile = {},
  structuredResumeProfile?: StructuredResumeProfile | null,
) {
  const baseAnalysis = analyzeResumeAgainstJob(resume, job, profile);
  const dynamicRequirements = await extractDynamicJobRequirements(resume, job);

  return dynamicRequirements
    ? applyDynamicRequirements(baseAnalysis, dynamicRequirements, structuredResumeProfile)
    : baseAnalysis;
}

export function analyzeResumeAgainstJob(resume: string, job: string, profile: CandidateProfile = {}) {
  const resumeSkills = extractSkills(resume);
  const jobSkills = extractSkills(job);
  const mustHaveSkills = detectMustHaveSkills(job, jobSkills);
  const matchedSkills = jobSkills.filter((skill) => resumeSkills.some((item) => item.name === skill.name));
  const missingSkills = jobSkills.filter((skill) => !matchedSkills.some((item) => item.name === skill.name));
  const weightedDemand = sumWeights(jobSkills);
  const weightedMatch = sumWeights(matchedSkills);
  const mustHaveMisses = missingSkills.filter((skill) => mustHaveSkills.some((item) => item.name === skill.name));
  const coverage = weightedDemand ? weightedMatch / weightedDemand : 0.45;
  const mustHavePenalty = mustHaveMisses.length * 7;
  const evidenceBonus = Math.min(resumeSkills.length * 1.5, 12);
  const roleFit = assessRoleFit(resume, job, jobSkills);
  const requirementChecks = checkHardRequirements(resume, job, profile);
  const rawScore = Math.max(
    25,
    Math.min(
      96,
      Math.round(coverage * 82 + evidenceBonus - mustHavePenalty - roleFit.penalty - requirementChecks.scorePenalty),
    ),
  );
  const score = requirementChecks.scoreCap ? Math.min(rawScore, requirementChecks.scoreCap) : rawScore;
  const roleSignals = [...requirementChecks.signals, ...roleFit.signals, ...extractSignals(job)].slice(0, 6);
  const recommendation = getRecommendation(score, mustHaveMisses.length, roleFit.penalty, requirementChecks.findings);

  return {
    score,
    level: recommendation.level,
    decision: recommendation.decision,
    nextStep: recommendation.nextStep,
    timeToApply: recommendation.timeToApply,
    confidence: recommendation.confidence,
    matchedSkills: matchedSkills.map((skill) => skill.name).slice(0, 10),
    missingSkills: missingSkills.map((skill) => skill.name).slice(0, 10),
    roleSignals: roleSignals.length ? roleSignals : ["Role intent unclear"],
    hardRequirements: requirementChecks.findings,
    salary: requirementChecks.salary,
    scoreBreakdown: [
      {
        label: "Matched job skills",
        value: `${Math.round(coverage * 100)}%`,
        detail: `${matchedSkills.length} of ${jobSkills.length || 0} detected job skills matched`,
      },
      {
        label: "Resume matches",
        value: `+${Math.round(evidenceBonus)}`,
        detail: `${resumeSkills.length} relevant resume skills detected`,
      },
      {
        label: "Required gaps",
        value: mustHavePenalty ? `-${mustHavePenalty}` : "0",
        detail: mustHaveMisses.length
          ? `${mustHaveMisses.length} must-have skill gap detected`
          : "No detected must-have gaps",
      },
      {
        label: "Role alignment",
        value: requirementChecks.scoreCap
          ? `Cap ${requirementChecks.scoreCap}`
          : roleFit.penalty
            ? `-${roleFit.penalty}`
            : "OK",
        detail: requirementChecks.findings.some((finding) => finding.status !== "matched")
          ? "Eligibility, logistics, or hard requirements need review"
          : roleFit.penalty
          ? "Role family, seniority, or evidence level needs review"
          : "Role direction appears aligned",
      },
    ],
    skillGroups: {
      coreMatched: matchedSkills
        .filter((skill) => skill.weight >= 7)
        .map((skill) => skill.name)
        .slice(0, 8),
      coreMissing: missingSkills
        .filter((skill) => skill.weight >= 7 || mustHaveMisses.some((item) => item.name === skill.name))
        .map((skill) => skill.name)
        .slice(0, 8),
      niceToHaveMatched: matchedSkills
        .filter((skill) => skill.weight < 7)
        .map((skill) => skill.name)
        .slice(0, 8),
    },
    bullets: buildActionItems(matchedSkills, missingSkills, mustHaveMisses),
    keywordPlan: buildKeywordPlan(matchedSkills, missingSkills, mustHaveMisses),
    resumeBullets: buildResumeBullets(matchedSkills, missingSkills),
    interviewPrep: buildInterviewPrep(matchedSkills, missingSkills, roleSignals),
    outreachMessage: buildOutreachMessage(matchedSkills, missingSkills),
    atsNotes: buildAtsNotes(job, jobSkills, missingSkills, mustHaveMisses),
    summary: buildSummary(score, matchedSkills, missingSkills, mustHaveMisses, recommendation.action, roleFit, requirementChecks.findings),
  };
}

function applyDynamicRequirements(
  analysis: ReturnType<typeof analyzeResumeAgainstJob>,
  dynamicRequirements: DynamicRequirementReport,
  structuredResumeProfile?: StructuredResumeProfile | null,
) {
  const enhancedRequirements = enhanceRequirementsWithStructuredProfile(dynamicRequirements, structuredResumeProfile);
  const dynamicMustMissing = enhancedRequirements.mustHave.filter((item) => !item.matched);
  const dynamicImportantMissing = enhancedRequirements.important.filter((item) => !item.matched);
  const dynamicMatched = [
    ...enhancedRequirements.mustHave,
    ...enhancedRequirements.important,
    ...enhancedRequirements.niceToHave,
  ].filter((item) => item.matched);
  const matchedSkills = mergeLabels(
    analysis.matchedSkills,
    dynamicMatched
      .filter((item) => item.priority !== "nice_to_have")
      .map((item) => item.requirement),
    12,
  );
  const missingSkills = mergeLabels(
    dynamicMustMissing.map((item) => item.requirement),
    [...dynamicImportantMissing.map((item) => item.requirement), ...analysis.missingSkills],
    12,
  );
  const dynamicPenalty = Math.min(dynamicMustMissing.length * 9 + dynamicImportantMissing.length * 3, 32);
  const score = Math.max(25, analysis.score - dynamicPenalty);
  const recommendation = getRecommendation(
    score,
    dynamicMustMissing.length || missingSkills.length,
    dynamicMustMissing.length >= 2 ? 18 : 0,
    analysis.hardRequirements,
  );

  return {
    ...analysis,
    score,
    level: recommendation.level,
    decision: recommendation.decision,
    nextStep: dynamicMustMissing.length
      ? `Check the must-have gap: ${dynamicMustMissing[0].requirement}.`
      : recommendation.nextStep,
    timeToApply: recommendation.timeToApply,
    confidence: dynamicMustMissing.length ? "Medium" : recommendation.confidence,
    matchedSkills,
    missingSkills,
    dynamicRequirements: enhancedRequirements,
    scoreBreakdown: updateScoreBreakdown(analysis.scoreBreakdown, dynamicMustMissing, dynamicImportantMissing),
    skillGroups: {
      ...analysis.skillGroups,
      coreMatched: mergeLabels(analysis.skillGroups.coreMatched, matchedSkills, 8),
      coreMissing: mergeLabels(dynamicMustMissing.map((item) => item.requirement), analysis.skillGroups.coreMissing, 8),
    },
    bullets: buildDynamicActionItems(analysis.bullets, dynamicMustMissing, dynamicImportantMissing, matchedSkills),
    keywordPlan: {
      ...analysis.keywordPlan,
      add: mergeLabels(dynamicMustMissing.map((item) => item.requirement), analysis.keywordPlan.add, 8),
      headline: matchedSkills.slice(0, 3).join(" + ") || analysis.keywordPlan.headline,
    },
    resumeBullets: buildDynamicResumeBullets(analysis.resumeBullets, dynamicMustMissing, dynamicImportantMissing),
    interviewPrep: buildDynamicInterviewPrep(analysis.interviewPrep, enhancedRequirements),
    atsNotes: buildDynamicAtsNotes(analysis.atsNotes, dynamicMustMissing),
    summary: buildDynamicSummary(analysis.summary, enhancedRequirements, score),
  };
}

function enhanceRequirementsWithStructuredProfile(
  dynamicRequirements: DynamicRequirementReport,
  structuredResumeProfile?: StructuredResumeProfile | null,
): DynamicRequirementReport {
  if (!structuredResumeProfile) return dynamicRequirements;

  const evidenceText = formatStructuredResumeForMatching(structuredResumeProfile);
  if (!evidenceText) return dynamicRequirements;

  return {
    ...dynamicRequirements,
    mustHave: dynamicRequirements.mustHave.map((item) => matchRequirementWithStructuredProfile(item, evidenceText, structuredResumeProfile)),
    important: dynamicRequirements.important.map((item) => matchRequirementWithStructuredProfile(item, evidenceText, structuredResumeProfile)),
    niceToHave: dynamicRequirements.niceToHave.map((item) => matchRequirementWithStructuredProfile(item, evidenceText, structuredResumeProfile)),
  };
}

function matchRequirementWithStructuredProfile(
  requirement: DynamicRequirement,
  evidenceText: string,
  profile: StructuredResumeProfile,
): DynamicRequirement {
  if (requirement.matched) return requirement;

  const normalizedRequirement = normalize(requirement.requirement);
  const normalizedEvidence = normalize(evidenceText);
  const requiredYears = extractExperienceYears(normalizedRequirement);

  if (isPermanentWorkRightsRequirement(normalizedRequirement) && isTemporaryWorkRights(profile.workRights)) {
    return requirement;
  }

  if (isEducationRequirement(normalizedRequirement) && profile.education.length) {
    return {
      ...requirement,
      matched: true,
      evidence: `Structured resume profile includes education: ${profile.education[0]}.`,
    };
  }

  if (
    /\b(?:software developer|software engineer|developer|commercial|professional experience)\b/.test(normalizedRequirement) &&
    profile.totalCommercialExperienceYears >= 1 &&
    hasAlias(normalizedEvidence, "software")
  ) {
    if (!requiredYears || profile.totalCommercialExperienceYears >= requiredYears) {
      return {
        ...requirement,
        matched: true,
        evidence: `${profile.totalCommercialExperienceYears} years commercial software experience extracted from resume.`,
      };
    }
  }

  const specificKeywords = getSpecificRequirementKeywords(requirement);
  const matchedKeywords = specificKeywords.filter((keyword) => hasAlias(normalizedEvidence, keyword));
  const techThreshold = getTechnologyMatchThreshold(requirement, specificKeywords);

  if (techThreshold && matchedKeywords.length >= techThreshold) {
    return {
      ...requirement,
      matched: true,
      evidence: `Structured resume profile includes ${matchedKeywords.slice(0, 4).join(", ")}.`,
    };
  }

  if (!techThreshold && matchedKeywords.length) {
    return {
      ...requirement,
      matched: true,
      evidence: `Structured resume profile includes ${matchedKeywords[0]}.`,
    };
  }

  return requirement;
}

function getSpecificRequirementKeywords(requirement: DynamicRequirement) {
  return requirement.keywords
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .filter((keyword, index, items) => items.findIndex((other) => other.toLowerCase() === keyword.toLowerCase()) === index)
    .filter((keyword) => !isGenericRequirementKeyword(keyword));
}

function getTechnologyMatchThreshold(requirement: DynamicRequirement, keywords: string[]) {
  if (requirement.category !== "technology" && !looksLikeTechnologyList(requirement.requirement)) return 0;
  if (keywords.length <= 1) return keywords.length;

  return Math.max(2, Math.ceil(keywords.length * 0.65));
}

function looksLikeTechnologyList(text: string) {
  const normalizedText = normalize(text);
  const techHits = [
    "php",
    "javascript",
    "typescript",
    "html",
    "css",
    "sass",
    "vue",
    "react",
    "node",
    ".net",
    "c#",
    "java",
    "spring",
    "sql",
    "rest",
    "grpc",
    "soap",
    "sharepoint",
    "power automate",
    "power bi",
  ].filter((term) => hasAlias(normalizedText, term)).length;

  return techHits >= 2;
}

function isGenericRequirementKeyword(keyword: string) {
  return /^(?:experience|knowledge|understanding|skills?|work|working|strong|solid|commercial|professional|development|applications?|software|similar|modern|relevant|using|with|and|or)$/i.test(
    keyword.trim(),
  );
}

function isPermanentWorkRightsRequirement(normalizedRequirement: string) {
  return /\b(?:permanent rights|permanent work rights|permanent resident|citizen|citizenship|pr only)\b/.test(
    normalizedRequirement,
  );
}

function isTemporaryWorkRights(workRights: string) {
  return /\b(?:temporary|485|visa|subclass)\b/i.test(workRights);
}

function isEducationRequirement(normalizedRequirement: string) {
  return /\b(?:tertiary qualification|degree|computer science|software development|programming|related field|data science)\b/.test(
    normalizedRequirement,
  );
}

function mergeLabels(primary: string[], secondary: string[], limit: number) {
  return [...primary, ...secondary]
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, items) => items.findIndex((other) => other.toLowerCase() === item.toLowerCase()) === index)
    .slice(0, limit);
}

function updateScoreBreakdown(
  scoreBreakdown: ReturnType<typeof analyzeResumeAgainstJob>["scoreBreakdown"],
  mustMissing: DynamicRequirement[],
  importantMissing: DynamicRequirement[],
) {
  return scoreBreakdown.map((item) =>
    item.label === "Required gaps"
      ? {
          ...item,
          value: mustMissing.length ? `-${mustMissing.length * 9}` : item.value,
          detail: mustMissing.length
            ? `${mustMissing.length} extracted must-have gap detected`
            : importantMissing.length
              ? `${importantMissing.length} important extracted gap detected`
              : item.detail,
        }
      : item,
  );
}

function buildDynamicActionItems(
  baseItems: string[],
  mustMissing: DynamicRequirement[],
  importantMissing: DynamicRequirement[],
  matchedSkills: string[],
) {
  if (!mustMissing.length && !importantMissing.length) return baseItems;

  const firstGap = mustMissing[0] ?? importantMissing[0];

  return [
    `Check whether you have real evidence for ${firstGap.requirement}; if not, treat it as a gap.`,
    `Lead with the strongest verified overlap: ${matchedSkills.slice(0, 3).join(", ") || "your closest matching evidence"}.`,
    ...baseItems,
  ].slice(0, 3);
}

function buildDynamicResumeBullets(
  baseItems: string[],
  mustMissing: DynamicRequirement[],
  importantMissing: DynamicRequirement[],
) {
  const gaps = [...mustMissing, ...importantMissing];
  if (!gaps.length) return baseItems;

  return [
    `Only add ${gaps[0].requirement} if you can support it with real resume evidence.`,
    ...baseItems,
  ].slice(0, 3);
}

function buildDynamicInterviewPrep(
  baseItems: string[],
  requirements: DynamicRequirementReport,
) {
  const mustHave = requirements.mustHave[0]?.requirement;
  const expectedWork = requirements.expectedWork[0];

  return [
    ...(mustHave ? [`Prepare a direct answer for your evidence around ${mustHave}.`] : []),
    ...(expectedWork ? [`Be ready to explain how your experience maps to ${expectedWork}.`] : []),
    ...baseItems,
  ].slice(0, 3);
}

function buildDynamicAtsNotes(baseItems: string[], mustMissing: DynamicRequirement[]) {
  return [
    ...(mustMissing.length
      ? [`Do not hide the extracted must-have gap: ${mustMissing[0].requirement}. Address it honestly.`]
      : []),
    ...baseItems,
  ].slice(0, 4);
}

function buildDynamicSummary(
  baseSummary: string,
  requirements: DynamicRequirementReport,
  score: number,
) {
  const missingMust = requirements.mustHave.filter((item) => !item.matched);
  const matched = [...requirements.mustHave, ...requirements.important].filter((item) => item.matched);

  if (missingMust.length) {
    return `This role has some overlap, but the main requirements need review. Missing or unclear must-have evidence includes ${missingMust
      .slice(0, 3)
      .map((item) => item.requirement)
      .join(", ")}.`;
  }

  if (matched.length) {
    return `This role matches verified evidence around ${matched
      .slice(0, 3)
      .map((item) => item.requirement)
      .join(", ")}. ${requirements.roleSummary || baseSummary}`;
  }

  return score >= 70 ? baseSummary : requirements.roleSummary || baseSummary;
}

function extractSkills(text: string) {
  const normalized = normalize(text);

  return skillTaxonomy.filter((skill) =>
    skill.aliases.some((alias) => hasAlias(normalized, alias)),
  );
}

function detectMustHaveSkills(job: string, jobSkills: SkillDefinition[]) {
  const normalized = normalize(job);
  const sentences = normalized.split(/[.!?\n]/).map((sentence) => sentence.trim());

  return jobSkills.filter((skill) =>
    sentences.some((sentence) =>
      mustHavePatterns.some((pattern) => sentence.includes(pattern)) &&
      skill.aliases.some((alias) => hasAlias(sentence, alias)),
    ),
  );
}

function extractSignals(text: string) {
  const normalized = normalize(text);

  return roleSignalMap
    .filter((signal) => signal.aliases.some((alias) => hasAlias(normalized, alias)))
    .map((signal) => signal.name);
}

function sumWeights(skills: SkillDefinition[]) {
  return skills.reduce((total, skill) => total + skill.weight, 0);
}

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ");
}

function hasAlias(normalizedText: string, alias: string) {
  const normalizedAlias = normalize(alias);
  const escapedAlias = normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|[^a-z0-9+#.])${escapedAlias}([^a-z0-9+#.]|$)`, "i");

  return pattern.test(normalizedText);
}

function assessRoleFit(resume: string, job: string, jobSkills: SkillDefinition[]): RoleFit {
  const normalizedResume = normalize(resume);
  const normalizedJob = normalize(job);
  const resumeYears = extractExperienceYears(normalizedResume);
  const signals: string[] = [];
  let penalty = 0;

  const jobFamily = roleFamilyChecks.find((family) =>
    family.jobAliases.some((alias) => hasAlias(normalizedJob, alias)),
  );

  if (jobFamily) {
    signals.push(jobFamily.name);
    const hasResumeFamilyEvidence = jobFamily.resumeAliases.some((alias) => hasAlias(normalizedResume, alias));
    const hasDirectRoleEvidence = jobFamily.jobAliases.some((alias) => hasAlias(normalizedResume, alias));

    if (!hasResumeFamilyEvidence) {
      penalty += jobFamily.strict ? 24 : 14;
      signals.push("Role-family gap");
    } else if (jobFamily.strict && !hasDirectRoleEvidence) {
      penalty += 18;
      signals.push("Transferable, not direct");
    }
  }

  const seniorRole = seniorRolePatterns.some((pattern) => hasAlias(normalizedJob, pattern));

  if (seniorRole) {
    signals.push("Senior scope");

    if (resumeYears < 5) {
      penalty += 14;
      signals.push("Seniority gap");
    }
  }

  if (jobSkills.length < 4) {
    penalty += 12;
    signals.push("Low-signal job ad");
  }

  return {
    penalty: Math.min(penalty, 38),
    signals,
  };
}

function extractExperienceYears(normalizedText: string) {
  const matches = Array.from(normalizedText.matchAll(/(\d{1,2})\+?\s+years?/g));
  const years = matches.map((match) => Number(match[1])).filter(Number.isFinite);

  return years.length ? Math.max(...years) : 0;
}

function getRecommendation(
  score: number,
  mustHaveMisses: number,
  rolePenalty: number,
  hardRequirements: ReturnType<typeof checkHardRequirements>["findings"] = [],
) {
  const blocker = hardRequirements.find((finding) => finding.status === "blocked" && finding.severity === "hard");
  const unknownHardRequirement = hardRequirements.find((finding) => finding.status === "unknown" && finding.severity === "hard");

  if (blocker) {
    return {
      level: "Likely blocker",
      action: "check eligibility before applying",
      decision: "Skip",
      nextStep: blocker.message,
      timeToApply: "Check first",
      confidence: "Low",
    } satisfies Recommendation;
  }

  if (unknownHardRequirement) {
    return {
      level: "Check first",
      action: "confirm this hard requirement before applying",
      decision: "Tailor",
      nextStep: unknownHardRequirement.message,
      timeToApply: "Check first",
      confidence: "Medium",
    } satisfies Recommendation;
  }

  if (score >= 82 && mustHaveMisses === 0 && rolePenalty < 10) {
    return {
      level: "Apply now",
      action: "apply with a tailored resume",
      decision: "Apply",
      nextStep: "Use the matched skills as your resume focus, then apply with truthful examples.",
      timeToApply: "20-30 min",
      confidence: "High",
    } satisfies Recommendation;
  }

  if (score >= 70 && rolePenalty < 18) {
    return {
      level: "Strong match",
      action: "apply after tightening the strongest overlap",
      decision: "Apply",
      nextStep: "Tighten the top 2 truthful resume bullets, then apply.",
      timeToApply: "30-45 min",
      confidence: "Good",
    } satisfies Recommendation;
  }

  if (score >= 55) {
    return {
      level: "Tailor first",
      action: "tailor your resume before applying",
      decision: "Tailor",
      nextStep: "Check the required gaps before spending time on a cover letter.",
      timeToApply: "45-75 min",
      confidence: "Medium",
    } satisfies Recommendation;
  }

  return {
    level: "Stretch role",
    action: "save this role and build more evidence first",
    decision: "Build",
    nextStep: "Do not rush this application. Build real evidence for the biggest missing skill first.",
    timeToApply: "Not ready",
    confidence: "Low",
  } satisfies Recommendation;
}

function buildActionItems(
  matched: SkillDefinition[],
  missing: SkillDefinition[],
  mustHaveMisses: SkillDefinition[],
) {
  const matchedList = matched.slice(0, 4).map((skill) => skill.name).join(", ") || "your closest matching skills";
  const firstGap = mustHaveMisses[0]?.name ?? missing[0]?.name ?? "the employer's highest-priority requirement";
  const categoryGap = mostCommonCategory(missing);

  return [
    `Lead the application with evidence for ${matchedList}.`,
    `If you have real evidence for ${firstGap}, make it visible in one resume bullet.`,
    `If you have project proof in ${categoryGap}, move it higher. If not, treat it as missing evidence.`,
  ];
}

function buildKeywordPlan(
  matched: SkillDefinition[],
  missing: SkillDefinition[],
  mustHaveMisses: SkillDefinition[],
) {
  const priorityMissing = (mustHaveMisses.length ? mustHaveMisses : missing)
    .slice(0, 5)
    .map((skill) => skill.name);

  return {
    keep: matched.slice(0, 6).map((skill) => skill.name),
    add: priorityMissing,
    headline: matched.slice(0, 3).map((skill) => skill.name).join(" + ") || "Role-relevant project evidence",
  };
}

function buildResumeBullets(matched: SkillDefinition[], missing: SkillDefinition[]) {
  const primary = matched[0]?.name ?? "role-relevant work";
  const secondary = matched[1]?.name ?? "business outcomes";
  const gap = missing[0]?.name ?? "the employer's priority area";

  return [
    `Adapt this only if true: built or improved ${primary} workflows tied to a clear user or business result.`,
    `Used ${secondary} to turn ambiguous requirements into clear dashboards, tools, or decisions.`,
    `If you have done work with ${gap}, add one clear proof point; otherwise keep it as a gap to build.`,
  ];
}

function buildInterviewPrep(
  matched: SkillDefinition[],
  missing: SkillDefinition[],
  roleSignals: string[],
) {
  const matchedFocus = matched[0]?.name ?? "your strongest project";
  const missingFocus = missing[0]?.name ?? "a skill gap";
  const roleFocus = roleSignals[0] ?? "this role";

  return [
    `Prepare a 60-second story about where you used ${matchedFocus} to solve a real problem.`,
    `Have a direct answer for whether you have evidence for ${missingFocus}, and how you are building it if not.`,
    `Explain why ${roleFocus} fits your current job search direction.`,
  ];
}

function buildOutreachMessage(
  matched: SkillDefinition[],
  missing: SkillDefinition[],
) {
  const matchedList = matched.slice(0, 2).map((skill) => skill.name).join(" and ") || "the role requirements";
  const gap = missing[0]?.name;
  const gapSentence = gap ? `I am also actively strengthening my ${gap} evidence.` : "The role aligns closely with my current experience.";

  return `Hi, I found this role and noticed a strong match around ${matchedList}. ${gapSentence} I would appreciate any guidance on what the team values most for candidates at this stage.`;
}

function buildAtsNotes(
  job: string,
  jobSkills: SkillDefinition[],
  missing: SkillDefinition[],
  mustHaveMisses: SkillDefinition[],
) {
  const notes = [
    "Mirror the exact wording from the job ad where it is truthful.",
    "Keep your resume format simple: standard headings, no tables, no graphics-heavy layouts.",
  ];

  if (jobSkills.length < 4) {
    notes.push("The job ad has few detectable skills, so review the full posting manually before relying on the score.");
  }

  if (mustHaveMisses.length) {
    notes.push(`Do not hide must-have gaps. Address ${mustHaveMisses[0].name} directly in a project, summary, or cover note.`);
  } else if (missing.length) {
    notes.push(`Add a truthful mention of ${missing[0].name} if you have evidence for it.`);
  }

  if (/citizen|permanent resident|security clearance|full working rights/i.test(job)) {
    notes.push("Check work-rights wording before applying; this posting may have eligibility constraints.");
  }

  return notes;
}

function buildSummary(
  score: number,
  matched: SkillDefinition[],
  missing: SkillDefinition[],
  mustHaveMisses: SkillDefinition[],
  action: string,
  roleFit: RoleFit,
  hardRequirements: ReturnType<typeof checkHardRequirements>["findings"] = [],
) {
  const blocker = hardRequirements.find((finding) => finding.status === "blocked" && finding.severity === "hard");
  const warning = hardRequirements.find((finding) => finding.status !== "matched");

  if (blocker) {
    return buildBlockerSummary(blocker);
  }

  if (warning) {
    return `${warning.label}: ${warning.message} If this checks out, use the strongest matched evidence before applying.`;
  }

  const matchedList = matched.slice(0, 3).map((skill) => skill.name).join(", ") || "some transferable evidence";
  const gapList = (mustHaveMisses.length ? mustHaveMisses : missing)
    .slice(0, 2)
    .map((skill) => skill.name)
    .join(" and ");

  if (roleFit.penalty >= 18) {
    return `This role has useful overlap, but the role level or role family needs review. Your strongest overlap is ${matchedList}; do not treat it as a clear fit without checking the missing evidence.`;
  }

  if (score >= 82 && mustHaveMisses.length === 0) {
    return `This is a high-priority target. You match the important signals around ${matchedList}; ${action}.`;
  }

  if (score >= 70) {
    return `This role is worth pursuing. Your strongest overlap is ${matchedList}; ${action}.`;
  }

  if (score >= 55) {
    return `This role is possible, but needs tailoring. Close the visible gap around ${gapList || "the missing requirements"} before applying.`;
  }

  return `This is a stretch based on the current evidence. Build proof for ${gapList || "the missing requirements"} before investing serious time.`;
}

function buildBlockerSummary(blocker: ReturnType<typeof checkHardRequirements>["findings"][number]) {
  const source = blocker.candidateEvidence ? "Your resume or profile" : "Your profile";

  if (blocker.type === "work_rights") {
    return `This role is not a good fit because it asks for ${blocker.jobEvidence}. ${source} conflicts with that requirement, so confirm eligibility before applying.`;
  }

  if (blocker.type === "sponsorship") {
    return `This role is not a good fit because it appears to require existing work rights without sponsorship. ${source} does not clearly satisfy that requirement, so confirm eligibility before applying.`;
  }

  if (blocker.type === "licence" || blocker.type === "drivers_licence") {
    return `This role is not a good fit yet because it asks for ${blocker.jobEvidence}. ${source} does not show that requirement clearly, so confirm it before applying.`;
  }

  if (blocker.type === "clearance") {
    return `This role needs a security clearance check before applying. It asks for ${blocker.jobEvidence}, and your profile does not clearly show that clearance.`;
  }

  if (blocker.type === "location") {
    return `This role has a location constraint that may not match your profile. Check ${blocker.jobEvidence} before spending time tailoring the application.`;
  }

  if (blocker.type === "experience") {
    return `This role may be too senior based on the current profile. It asks for ${blocker.jobEvidence}, so check whether your resume proves that level clearly.`;
  }

  if (blocker.type === "salary") {
    return `This role may not meet your saved salary target. Check the listed salary before spending time tailoring the application.`;
  }

  return `${blocker.label}: ${blocker.message}`;
}

function mostCommonCategory(skills: SkillDefinition[]) {
  if (!skills.length) return "business impact";

  const counts = skills.reduce<Record<string, number>>((acc, skill) => {
    acc[skill.category] = (acc[skill.category] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}
