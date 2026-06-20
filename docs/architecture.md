# RoleGuage Architecture

RoleGuage is designed as a fast job-search workflow with optional AI enrichment.

## Core Flow

1. The user uploads or pastes a resume.
2. The app imports or accepts a job description.
3. A deterministic matcher scores fit using skill, seniority, role-family, and requirement signals.
4. If AI is configured, the app retrieves relevant resume/job snippets and asks Gemini for structured enrichment.
5. The user gets a fit report, application kit, skill-gap roadmap, export, and tracker entry.

## Why Rules First

Rules score many jobs cheaply and consistently. AI is used only where language judgment matters:

- job description summaries
- fit reasoning
- truthful resume bullet guidance
- interview prep
- outreach notes
- gap roadmaps

This keeps job discovery responsive and limits model calls to high-value moments.

## RAG Layer

The local RAG layer chunks resume and job text, scores chunks against the current query, and sends only the highest-signal snippets to the model. This reduces token usage and keeps prompts grounded in user-provided evidence.

## Cost Controls

- Batch job-card summaries in one request for top visible listings.
- Generate full AI reports only for selected roles.
- Cache AI responses in memory by content hash.
- Use timeout protection and deterministic fallback outputs.
- Keep the API key server-side only.

## Production Next Steps

- Persist reports, resumes, and applications in a database.
- Replace local RAG with embeddings plus a vector store for larger user histories.
- Add account auth and deletion controls.
- Add approved job-board APIs or a paid job-data provider.
- Add usage limits, billing, analytics, and AI-cost monitoring.
