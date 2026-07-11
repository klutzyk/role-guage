# RoleGuage

RoleGuage helps jobseekers compare a resume against a real job description before spending time applying. It highlights fit, evidence gaps, hard requirements, salary signals, resume suggestions, and a tailored cover letter draft.

The product is focused on application preparation. It does not auto-apply to jobs, submit applications, bypass job-board restrictions, or scrape private job-board data.

## Product

Current features:

- Resume-to-job fit scoring
- Job URL import for public pages and manual job-description paste fallback
- PDF resume extraction
- Saved browser profile for reusable resume text and candidate details
- Optional account sync for reusable resume/profile/style data
- Hard requirement checks for work rights, location, licences, clearance, salary, and other must-have constraints
- Salary extraction when the job ad includes a salary range
- Matched skill and evidence-gap detection
- Apply / Tailor / Build / Skip recommendation
- Next-best-action guidance
- Evidence-based fit reasoning
- Resume bullet suggestions
- Cover letter generation with saved writing style preferences and example letters
- Match history saved locally in the browser
- Chrome extension for analyzing the job page the user is viewing
- Privacy policy page for the web app and extension listing

Saved resumes, candidate details, writing preferences, example letters, and match history can stay in the user's browser for the local-first workflow. Optional account sync stores the reusable profile server-side for signed-in users. The app sends resume/job context to the configured LLM provider only when the user generates AI-assisted guidance or a cover letter.

## AI Architecture

RoleGuage uses a rules-first, AI-assisted workflow:

- Deterministic matching handles fast fit scoring, skill overlap, hard blockers, and salary signals.
- Local profile extraction and retrieval select compact resume/job context before generation.
- The AI step enriches the report with user-facing recommendations and cover letter drafts.
- Cover letter generation is split into a narrative step and a writer step so the writer sees compact verified context instead of the full raw resume.
- User writing preferences and example letters guide the cover letter style.
- Model calls use structured JSON outputs, timeout protection, in-memory caching, fallback models, and deterministic fallback content.
- Prompts require truthful, evidence-based output and reject invented experience.

Supported LLM providers:

- Groq, preferred for fast and low-cost local testing.
- Gemini, optional fallback or alternative provider.

## Chrome Extension

The `extension/` folder contains the Chrome extension source.

The extension workflow:

1. The user opens a job page.
2. The user opens the RoleGuage extension.
3. The extension extracts visible job-page text after the user's action.
4. The extension sends the saved resume and extracted job text to the RoleGuage API.
5. The popup returns the recommendation, fit score, matched evidence, gaps, resume bullets, and cover letter draft.

This is user-triggered page analysis, not background crawling or automated application submission.

Install locally:

1. Run the web app with `npm run dev`.
2. Open `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the `extension/` folder.

For production, update the extension API base URL to `https://roleguage.com`, rebuild the extension package, and submit the zipped extension folder through the Chrome Web Store dashboard.

## Environment Variables

Create a local environment file:

```bash
copy .env.example .env.local
```

Required for AI generation with Groq:

```bash
LLM_PROVIDER=groq
GROQ_API_KEY=your_groq_key_here
GROQ_MODEL=openai/gpt-oss-120b
GROQ_ANALYSIS_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
GROQ_ANALYSIS_FALLBACK_MODELS=llama-3.3-70b-versatile,openai/gpt-oss-20b
GROQ_COVER_LETTER_MODEL=openai/gpt-oss-120b
GROQ_COVER_LETTER_FALLBACK_MODELS=llama-3.3-70b-versatile,meta-llama/llama-4-scout-17b-16e-instruct
GROQ_REPAIR_MODEL=llama-3.3-70b-versatile
```

Optional Gemini configuration:

```bash
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_key_here
GEMINI_MODEL=gemini-2.5-flash
```

Optional timeout override:

```bash
GEMINI_TIMEOUT_MS=18000
```

Optional account sync with Supabase:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_server_only_service_role_key
```

After creating the Supabase project:

1. Run `docs/supabase-schema.sql` in the Supabase SQL editor.
2. In Supabase Authentication, keep Email provider enabled.
3. Add local and production URLs to Auth URL Configuration:
   - Site URL for local testing: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth`, `http://localhost:3000/profile`, `https://roleguage.com/auth`, `https://roleguage.com/profile`
4. Add the three Supabase variables above to Vercel and redeploy.

The schema enables row-level security and owner-only profile access. Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

Optional extension CORS override for unpacked development extensions:

```bash
EXTENSION_ALLOWED_ORIGINS=chrome-extension://your_unpacked_extension_id
```

The published RoleGuage extension origin is allowed by default.

No RapidAPI, LinkedIn, Indeed, SEEK, JSearch, Adzuna, or job-discovery API keys are required for the current product direction.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- lucide-react icons
- Groq OpenAI-compatible chat completions
- Gemini API support
- Supabase Auth and Postgres for optional account profile sync
- cheerio
- pdfjs-dist

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

## Production Notes

Before handling real users at scale, add:

- Production Supabase project with the schema in `docs/supabase-schema.sql`
- Abuse protection and account/user quotas for AI endpoints
- Stronger privacy logging controls
- Security monitoring and alerting
- Legal review of the privacy policy and extension disclosures
