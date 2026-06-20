export type RagChunk = {
  id: string;
  source: "resume" | "job";
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
    ...chunkText("resume", "Resume evidence", resume),
    ...chunkText("job", "Job description", job),
  ];
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
