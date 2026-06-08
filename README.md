# RoleGuage

RoleGuage is a job-search workspace for jobseekers who want to apply with better focus. It compares a resume against a real job ad, scores fit, identifies evidence gaps, and turns the result into practical application notes.

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
- Best-fit job recommendations from public job feeds
- Local application tracker with status and notes
- Copy/download fit report export
- Clean utility-first product site with workflow, trust, pricing, and FAQ sections

Saved applications and the saved resume profile are stored in browser `localStorage` for this local-first version. A production version should add account auth, encrypted database storage, payments, analytics, user-controlled deletion, and optional AI writing assistance.

Job URL import works best with company career pages and public ATS pages. Some large job boards block automated extraction, so the app keeps manual paste as the fallback.

Job discovery currently uses public feeds from Himalayas and Arbeitnow, then ranks listings with the same RoleGuage fit scorer used by the role matcher. Direct coverage for SEEK, Indeed, LinkedIn, and other major boards should be added through approved APIs, paid data providers, or official partnerships rather than brittle scraping.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- lucide-react icons
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
