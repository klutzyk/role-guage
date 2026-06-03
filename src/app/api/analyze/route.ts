import { NextRequest, NextResponse } from "next/server";

type SkillDefinition = {
  name: string;
  category: "Language" | "Frontend" | "Backend" | "Data" | "Cloud" | "Product";
  weight: number;
  aliases: string[];
};

const skillTaxonomy: SkillDefinition[] = [
  { name: "Python", category: "Language", weight: 9, aliases: ["python", "pandas", "numpy"] },
  { name: "SQL", category: "Data", weight: 9, aliases: ["sql", "mysql", "postgres", "postgresql", "sql queries"] },
  { name: "TypeScript", category: "Language", weight: 7, aliases: ["typescript", "ts"] },
  { name: "JavaScript", category: "Language", weight: 6, aliases: ["javascript"] },
  { name: "React", category: "Frontend", weight: 7, aliases: ["react", "react.js", "reactjs"] },
  { name: "Next.js", category: "Frontend", weight: 6, aliases: ["next.js", "nextjs", "next js"] },
  { name: "Node.js", category: "Backend", weight: 7, aliases: ["node.js", "nodejs", "node js", "nestjs", "nest.js"] },
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
  { name: "REST APIs", category: "Backend", weight: 7, aliases: ["rest api", "rest apis", "backend api", "backend apis", "building apis"] },
  { name: "LLM tools", category: "Product", weight: 5, aliases: ["llm", "large language model", "openai", "gemini", "generative ai"] },
  { name: "Experimentation", category: "Product", weight: 5, aliases: ["experiment", "experimentation", "a/b", "ab test"] },
  { name: "Stakeholder communication", category: "Product", weight: 8, aliases: ["stakeholder", "communication", "presenting", "presentation"] },
  { name: "ETL", category: "Data", weight: 6, aliases: ["etl", "extract transform load"] },
  { name: "Data pipelines", category: "Data", weight: 7, aliases: ["data pipeline", "data pipelines", "pipeline", "pipelines"] },
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
];

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { resume?: string; job?: string }
    | null;

  const resume = body?.resume?.trim() ?? "";
  const job = body?.job?.trim() ?? "";

  if (resume.length < 80 || job.length < 80) {
    return NextResponse.json(
      { error: "Resume and job description must both be at least 80 characters." },
      { status: 400 },
    );
  }

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
  const score = Math.max(25, Math.min(96, Math.round(coverage * 82 + evidenceBonus - mustHavePenalty)));
  const roleSignals = extractSignals(job).slice(0, 6);
  const recommendation = getRecommendation(score, mustHaveMisses.length);

  return NextResponse.json({
    score,
    level: recommendation.level,
    matchedSkills: matchedSkills.map((skill) => skill.name).slice(0, 10),
    missingSkills: missingSkills.map((skill) => skill.name).slice(0, 10),
    roleSignals: roleSignals.length ? roleSignals : ["Role intent unclear"],
    bullets: buildActionItems(matchedSkills, missingSkills, mustHaveMisses),
    summary: buildSummary(score, matchedSkills, missingSkills, mustHaveMisses, recommendation.action),
  });
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

function getRecommendation(score: number, mustHaveMisses: number) {
  if (score >= 82 && mustHaveMisses === 0) {
    return { level: "Apply now", action: "apply with a tailored resume" };
  }

  if (score >= 70) {
    return { level: "Strong match", action: "apply after tightening the strongest overlap" };
  }

  if (score >= 55) {
    return { level: "Tailor first", action: "tailor your resume before applying" };
  }

  return { level: "Stretch role", action: "save this role and build more evidence first" };
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
    `Add or rewrite one resume bullet that directly addresses ${firstGap}.`,
    `If you have project proof in ${categoryGap}, move it higher in your resume before applying.`,
  ];
}

function buildSummary(
  score: number,
  matched: SkillDefinition[],
  missing: SkillDefinition[],
  mustHaveMisses: SkillDefinition[],
  action: string,
) {
  const matchedList = matched.slice(0, 3).map((skill) => skill.name).join(", ") || "some transferable evidence";
  const gapList = (mustHaveMisses.length ? mustHaveMisses : missing)
    .slice(0, 2)
    .map((skill) => skill.name)
    .join(" and ");

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

function mostCommonCategory(skills: SkillDefinition[]) {
  if (!skills.length) return "business impact";

  const counts = skills.reduce<Record<string, number>>((acc, skill) => {
    acc[skill.category] = (acc[skill.category] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}
