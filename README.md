# RoleReady

RoleReady is a job-fit intelligence platform that matches a candidate's resume evidence against real job descriptions, scores fit, identifies skill gaps, and helps candidates decide where to apply.

## MVP

This first version includes:

- Resume and job description matching workflow
- Deterministic fit scoring API at `src/app/api/analyze/route.ts`
- Job URL import API at `src/app/api/import-job/route.ts`
- Resume PDF extraction API at `src/app/api/extract-resume/route.ts`
- Weighted skill taxonomy with aliases
- Matched skill extraction
- Missing skill detection
- Must-have requirement detection
- Role signal extraction
- Actionable resume/application recommendations
- Score explanation with weighted coverage, evidence bonus, and must-have penalty
- Job metadata capture for title, company, location, and source URL
- Local application tracker with status and notes
- Copy/download fit report export
- Responsive SaaS landing page interface

The matching route works without paid model usage, so the product can be demoed immediately. Saved applications are stored in browser `localStorage` until database/auth are added. Optional writing assistance can be added later for resume rewriting, cover letters, and richer explanations.

Job URL import works best with company career pages and public ATS pages. Some large job boards block automated extraction, so the app keeps manual paste as the fallback.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- lucide-react icons
- cheerio
- pdf-parse

Planned additions:

- PostgreSQL
- Prisma
- Auth
- Optional AI writing assistant

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
