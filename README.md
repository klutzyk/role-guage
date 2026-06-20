# Role Guage

Role Guage is a job-search workspace for jobseekers who want to apply with better focus. It compares a resume against a real job ad, scores fit, identifies evidence gaps, and turns the result into practical application notes.

## Product

This version includes:

- Resume and job description matching workflow
- Deterministic fit scoring API at `src/app/api/analyze/route.ts`
- Job URL import API at `src/app/api/import-job/route.ts`
- Job discovery API at `src/app/api/discover-jobs/route.ts`
- Resume PDF extraction API at `src/app/api/extract-resume/route.ts`
- Weighted skill taxonomy with aliases
- Matched skill extraction
- Missing evidence detection
- Must-have requirement detection
- Role signal extraction
- Apply / tailor / build-evidence / skip recommendation
- Next-best-action and time-to-apply estimate
- Score explanation with matched job skills, resume matches, and required gaps
- Keyword plan with keep/add priorities
- Resume bullet guidance
- Interview prep prompts
- Outreach note draft
- ATS sanity checks
- Job metadata capture for title, company, location, and source URL
- Browser-saved resume profile
- Best-fit job recommendations from company career pages and public ATS feeds
- Optional Gemini AI/RAG enrichment for job briefs and fit reports
- Local retrieval context selection before generation to reduce token usage
- Structured JSON AI outputs with deterministic fallbacks
- AI-generated fit reasoning, resume guidance, interview prep, outreach, ATS notes, and skill-gap roadmaps
- Local application tracker with status and notes
- Copy/download fit report export
- Clean utility-first product site with workflow, trust, pricing, and FAQ sections

Saved applications and the saved resume profile are stored in browser `localStorage` for this local-first version. A production version should add account auth, encrypted database storage, payments, analytics, user-controlled deletion, and optional AI writing assistance.

Job URL import works best with company career pages and public ATS pages. Some large job boards block automated extraction, so the app keeps manual paste as the fallback.

Job discovery uses a local ingestion layer for public company career pages and ATS feeds. The first implementation supports Greenhouse and SmartRecruiters sources with a curated seed list and optional `ROLEGUAGE_JOB_SOURCES_JSON` configuration. Results are normalized, deduplicated, cached in memory, and scored against the active resume. RapidAPI providers are disabled by default and must be explicitly enabled with `RAPIDAPI_JOBS_ENABLED=true` to avoid burning small free-tier quotas.

SEEK, Indeed, and LinkedIn direct coverage should still be handled through approved APIs, licensed providers, or explicit crawling permission rather than brittle scraping.

## AI/RAG Architecture

RoleGuage uses a rules-first, AI-second architecture:

- Deterministic matching scores many jobs quickly and cheaply.
- Local RAG chunking retrieves only the most relevant resume and job snippets before generation.
- Gemini structured JSON output enriches selected reports and visible job summaries when `GEMINI_API_KEY` is configured.
- AI calls have timeout protection, in-memory caching, and deterministic fallbacks.
- The app never asks AI to invent experience; prompts require evidence-based, truthful guidance only.

Configure AI locally:

```bash
copy .env.example .env.local
```

Then add:

```bash
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_TIMEOUT_MS=12000
ROLEGUAGE_JOB_SOURCE_LIMIT=6
ROLEGUAGE_MAX_INGESTED_JOBS=80
ROLEGUAGE_JOB_SOURCE_TIMEOUT_MS=14000
ROLEGUAGE_SMARTRECRUITERS_LIST_LIMIT=100
ROLEGUAGE_SMARTRECRUITERS_DETAIL_LIMIT=30
ROLEGUAGE_JOB_SOURCES_JSON=
RAPIDAPI_KEY=your_rapidapi_key
RAPIDAPI_JOBS_ENABLED=false
RAPIDAPI_JOBS_PROVIDER=linkedin
RAPIDAPI_LINKEDIN_JOBS_HOST=linkedin-job-search-api.p.rapidapi.com
RAPIDAPI_LINKEDIN_JOBS_ENDPOINT=active-jb-7d
RAPIDAPI_LINKEDIN_JOBS_FALLBACK_ENDPOINT=active-jb-6m
RAPIDAPI_LINKEDIN_AUTO_BROADEN=false
RAPIDAPI_LINKEDIN_JOBS_TIMEOUT_MS=18000
RAPIDAPI_JSEARCH_HOST=jsearch.p.rapidapi.com
RAPIDAPI_JSEARCH_TIMEOUT_MS=22000
```

Custom ATS sources can be added without code changes:

```bash
ROLEGUAGE_JOB_SOURCES_JSON=[{"kind":"smartrecruiters","name":"Canva","slug":"canva"},{"kind":"greenhouse","name":"Culture Amp","slug":"cultureamp"}]
```

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- lucide-react icons
- @google/genai
- cheerio
- pdfjs-dist

Planned additions:

- PostgreSQL
- Prisma
- Auth
- Optional AI writing assistant
- Job discovery from saved resume profiles

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Scripts

```bash
npm run dev
npm run build
npm run lint
```
