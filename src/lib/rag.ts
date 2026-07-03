export type RagChunk = {
  id: string;
  source: "resume" | "job" | "profile";
  title: string;
  text: string;
};

export type RetrievedChunk = RagChunk & {
  score: number;
};

const stopWords = new Set([
  "and",
  "are",
  "for",
  "from",
  "have",
  "into",
  "that",
  "the",
  "this",
  "with",
  "you",
  "your",
]);

export function buildRagCorpus(resume: string, job: string) {
  return [
    ...buildProfileChunks(resume),
    ...chunkText("resume", "Resume evidence", resume),
    ...chunkText("job", "Job description", job),
  ];
}

export function buildStructuredProfile(resume: string) {
  const normalized = resume.replace(/\s+/g, " ").trim();
  const name = extractCandidateName(resume);
  const experienceYears = extractExperienceYears(normalized);
  const education = extractEducation(normalized);
  const skills = findKnownSkills(normalized);
  const projects = findProjectSignals(normalized);

  return {
    name,
    experienceYears,
    education,
    skills,
    projects,
    writingPreferences: {
      tone: "professional, direct, conversational",
      avoid: [
        "I am passionate",
        "What attracted me",
        "What stood out",
        "I thrive",
        "I am excited to apply",
        "perfect fit",
      ],
    },
  };
}

export function retrieveContext(query: string, corpus: RagChunk[], limit = 8) {
  const queryTerms = tokenize(query);

  return corpus
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(queryTerms, chunk.text),
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function formatRetrievedContext(chunks: RetrievedChunk[]) {
  return chunks
    .map(
      (chunk, index) =>
        `[${index + 1}] ${chunk.source.toUpperCase()} - ${chunk.title}: ${chunk.text}`,
    )
    .join("\n\n");
}

function chunkText(source: RagChunk["source"], title: string, text: string) {
  const paragraphs = text
    .split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z])/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 40);

  const chunks: RagChunk[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if ((current + paragraph).length > 850 && current) {
      chunks.push(makeChunk(source, title, current, chunks.length));
      current = "";
    }

    current = current ? `${current} ${paragraph}` : paragraph;
  }

  if (current) {
    chunks.push(makeChunk(source, title, current, chunks.length));
  }

  return chunks.length ? chunks : [makeChunk(source, title, text.slice(0, 850), 0)];
}

function makeChunk(source: RagChunk["source"], title: string, text: string, index: number) {
  return {
    id: `${source}-${index}`,
    source,
    title,
    text: text.replace(/\s+/g, " ").trim().slice(0, 900),
  };
}

function buildProfileChunks(resume: string) {
  const profile = buildStructuredProfile(resume);
  const chunks: RagChunk[] = [];

  if (profile.name) {
    chunks.push(makeChunk("profile", "Candidate name", profile.name, chunks.length));
  }

  if (profile.experienceYears) {
    chunks.push(makeChunk("profile", "Experience length", `${profile.experienceYears} years of relevant experience are evidenced in the resume.`, chunks.length));
  }

  if (profile.education.length) {
    chunks.push(makeChunk("profile", "Education", profile.education.join("; "), chunks.length));
  }

  if (profile.skills.length) {
    chunks.push(makeChunk("profile", "Technical skills", profile.skills.join(", "), chunks.length));
  }

  for (const project of profile.projects) {
    chunks.push(makeChunk("profile", project.title, project.text, chunks.length));
  }

  return chunks;
}

function extractExperienceYears(text: string) {
  const years = Array.from(text.matchAll(/(\d{1,2}(?:\.\d+)?)\+?\s+years?/gi))
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);

  return years.length ? Math.max(...years) : 0;
}

function extractCandidateName(resume: string) {
  const lines = resume
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);
  const rejected = /resume|curriculum|vitae|email|phone|linkedin|github|portfolio|address|software|engineer|developer|analyst|scientist|data/i;

  return (
    lines.find((line) => {
      const words = line.split(/\s+/);

      return (
        words.length >= 2 &&
        words.length <= 4 &&
        !rejected.test(line) &&
        words.every((word) => /^[A-Z][A-Za-z.'-]+$/.test(word))
      );
    }) ?? ""
  );
}

function extractEducation(text: string) {
  const degreeMatches = findMatches(text, [
    /master'?s? of [a-z ]{3,40}(?=\s+(?:at|from|with|,|\.|;)|$)/gi,
    /bachelor'?s? of [a-z ]{3,40}(?=\s+(?:at|from|with|,|\.|;)|$)/gi,
    /graduate diploma in [a-z ]{3,40}(?=\s+(?:at|from|with|,|\.|;)|$)/gi,
  ]);
  const universities = findMatches(text, [
    /monash university/gi,
    /university of [a-z ]{3,60}/gi,
    /[a-z ]{3,60} university/gi,
    /rmit/gi,
    /deakin/gi,
  ]);

  if (!degreeMatches.length) return universities;

  return degreeMatches.map((degree) => {
    const nearbyUniversity = universities.find((university) =>
      text.includes(`${degree.toLowerCase()} ${university.toLowerCase()}`) ||
      text.includes(`${university.toLowerCase()} ${degree.toLowerCase()}`),
    );

    return nearbyUniversity ? `${degree}, ${nearbyUniversity}` : degree;
  });
}

function findMatches(text: string, patterns: RegExp[]) {
  return Array.from(
    new Set(
      patterns.flatMap((pattern) =>
        Array.from(text.matchAll(pattern)).map((match) => cleanMatch(match[0])),
      ),
    ),
  ).slice(0, 6);
}

function findKnownSkills(text: string) {
  const candidates = [
    "Python",
    "SQL",
    "PostgreSQL",
    "React",
    "TypeScript",
    "JavaScript",
    "C#",
    ".NET",
    "REST APIs",
    "FastAPI",
    "Machine learning",
    "NLP",
    "Power BI",
    "Tableau",
    "Dashboards",
    "Data pipelines",
    "AWS",
    "Azure",
    "Docker",
  ];
  const normalized = text.toLowerCase();

  return candidates.filter((skill) => normalized.includes(skill.toLowerCase())).slice(0, 16);
}

function findProjectSignals(text: string) {
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 40);

  return sentences
    .filter((sentence) => /project|built|developed|created|implemented|designed|dashboard|model|pipeline|api/i.test(sentence))
    .slice(0, 8)
    .map((sentence, index) => ({
      title: `Evidence ${index + 1}`,
      text: sentence,
    }));
}

function cleanMatch(value: string) {
  return value.replace(/\s+/g, " ").replace(/[.,;:]$/, "").trim();
}

function scoreChunk(queryTerms: string[], text: string) {
  const textTerms = new Set(tokenize(text));
  let score = 0;

  for (const term of queryTerms) {
    if (textTerms.has(term)) {
      score += term.length > 6 ? 2 : 1;
    }
  }

  return score;
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 2 && !stopWords.has(term));
}
