import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Globe,
  Radar,
  Shield,
  Sparkles,
  Target,
  Upload,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const features: Array<{ title: string; copy: string; icon: LucideIcon }> = [
  {
    title: "Precision match score",
    copy: "See how well your resume evidence aligns with the job before you spend time applying.",
    icon: Target,
  },
  {
    title: "Gap analysis",
    copy: "Pinpoint skills, keywords, hard blockers, and missing proof points for each role.",
    icon: BarChart3,
  },
  {
    title: "Cover letter draft",
    copy: "Generate a tailored cover letter that connects your real experience to the job requirements.",
    icon: FileText,
  },
  {
    title: "Hard requirement checks",
    copy: "Catch work rights, licences, salary, location, and clearance issues early.",
    icon: Shield,
  },
  {
    title: "One-click analysis",
    copy: "Paste a job URL or job text and get the full report without rebuilding your prompt every time.",
    icon: Zap,
  },
  {
    title: "Actionable suggestions",
    copy: "Get resume bullet ideas and next steps based on the job ad and your saved profile.",
    icon: Sparkles,
  },
];

const steps = [
  ["01", "Upload your resume", "Use a PDF once or keep a saved profile in your browser."],
  ["02", "Paste the job ad", "Use URL import, copy text, or the browser extension workflow."],
  ["03", "Get your match report", "Review fit, gaps, blockers, cover letter draft, and next actions."],
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#F0F4FF] text-[#0F1C35]">
      <BackgroundSketches />

      <header className="relative z-20 border-b border-[#DDE8F6] bg-white/86 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-8 lg:px-10">
          <a href="/" className="flex items-center gap-2 font-bold text-[#043873]">
            <span className="grid size-8 place-items-center rounded-md bg-[#043873] text-white">
              <Radar size={20} aria-hidden="true" />
            </span>
            <span className="text-lg">RoleGuage</span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-semibold text-[#536C99] md:flex">
            <a href="#features" className="hover:text-[#043873]">Features</a>
            <a href="#how-it-works" className="hover:text-[#043873]">How it works</a>
            <a href="/pricing" className="hover:text-[#043873]">Pricing</a>
            <a href="#faq" className="hover:text-[#043873]">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <a href="/profile" className="hidden text-sm font-bold text-[#536C99] hover:text-[#043873] sm:inline">
              Profile
            </a>
            <a
              href="/matcher#matcher"
              className="inline-flex h-11 items-center rounded-md bg-[#245FEA] px-5 text-sm font-extrabold text-white shadow-[0_12px_24px_rgba(36,95,234,0.2)] transition hover:bg-[#1D4ED8]"
            >
              Try Now
            </a>
          </div>
        </div>
      </header>

      <section className="relative z-10 px-5 pb-16 pt-20 text-center md:px-8 md:pb-20 md:pt-28 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <h1 className="mx-auto max-w-5xl text-5xl font-extrabold leading-[1.03] tracking-normal md:text-7xl lg:text-8xl">
            Tailor your resume
            <br />
            <span className="bg-gradient-to-r from-[#2563EB] to-[#6366F1] bg-clip-text text-transparent">
              to any job ad
            </span>
          </h1>
          <p className="mx-auto mt-7 max-w-3xl text-base leading-8 text-[#536C99] md:text-xl">
            Upload your resume, paste a job description, and get a clear fit score,
            evidence gaps, cover letter draft, and application notes before you hit apply.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="/matcher#matcher"
              className="inline-flex h-14 items-center justify-center gap-2 rounded-md bg-[#245FEA] px-8 text-base font-extrabold text-white shadow-[0_18px_34px_rgba(36,95,234,0.26)] transition hover:bg-[#1D4ED8]"
            >
              Try Now - it&apos;s free
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a
              href="#demo"
              className="inline-flex h-14 items-center justify-center gap-2 rounded-md border border-[#A7CEFC] bg-white/54 px-8 text-base font-extrabold text-[#245FEA] transition hover:bg-white"
            >
              <Globe size={18} aria-hidden="true" />
              Get the Extension
            </a>
          </div>
          <p className="mt-5 text-sm font-semibold text-[#8BA1C8]">
            No sign-up required to try. Works with pasted job ads, public URLs, and extension-based extraction.
          </p>
        </div>
      </section>

      <section id="demo" className="relative z-10 px-5 pb-20 md:px-8 md:pb-28 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="relative rounded-[1.55rem] border border-[#BFD6FF] bg-white/70 p-3 shadow-[0_30px_90px_rgba(36,95,234,0.16)] backdrop-blur">
            <img
              src="/landing-demo.png"
              alt="RoleGuage matcher interface preview"
              className="h-auto w-full rounded-[1.1rem] object-cover"
            />
            <div className="pointer-events-none absolute inset-x-4 bottom-4 h-24 rounded-b-[1.1rem] bg-gradient-to-t from-[#F0F4FF]/80 to-transparent" />
          </div>
        </div>
      </section>

      <section id="features" className="relative z-10 px-5 py-16 md:px-8 md:py-22 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-[#4F9CF9]">Features</p>
            <h2 className="mt-4 text-4xl font-extrabold leading-tight text-[#0F1C35] md:text-5xl">
              Everything you need to land the role
            </h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="rounded-2xl border border-[#DDE8F6] bg-white/56 p-7 backdrop-blur transition hover:border-[#A7CEFC] hover:bg-white"
              >
                <div className="grid size-11 place-items-center rounded-xl bg-[#EAF4FF] text-[#4F9CF9]">
                  <feature.icon size={22} aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-lg font-extrabold text-[#0F1C35]">{feature.title}</h3>
                <p className="mt-2 text-sm leading-7 text-[#536C99]">{feature.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="relative z-10 px-5 py-16 md:px-8 md:py-22 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-[#4F9CF9]">How it works</p>
            <h2 className="mt-4 text-4xl font-extrabold text-[#0F1C35] md:text-5xl">
              Three steps. One cleaner application.
            </h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {steps.map(([number, title, copy]) => (
              <article key={number} className="rounded-2xl border border-[#DDE8F6] bg-white/62 p-7 backdrop-blur">
                <p className="text-5xl font-black leading-none text-[#2563EB]/18">{number}</p>
                <h3 className="mt-5 text-lg font-extrabold text-[#0F1C35]">{title}</h3>
                <p className="mt-2 text-sm leading-7 text-[#536C99]">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 px-5 py-20 md:px-8 lg:px-10">
        <div className="mx-auto max-w-4xl rounded-[1.6rem] border border-[#BFD6FF] bg-[#EAF1FF]/78 p-8 text-center backdrop-blur md:p-12">
          <h2 className="text-4xl font-extrabold text-[#0F1C35] md:text-5xl">Ready to match smarter?</h2>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[#536C99] md:text-base">
            Start analyzing your resume against any job in seconds. Or use the extension workflow and do it right from the job board.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <a
              href="/matcher#matcher"
              className="inline-flex h-14 items-center justify-center gap-2 rounded-md bg-[#245FEA] px-8 text-base font-extrabold text-white shadow-[0_18px_34px_rgba(36,95,234,0.24)] transition hover:bg-[#1D4ED8]"
            >
              Try Now - Free
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a
              href="#demo"
              className="inline-flex h-14 items-center justify-center gap-2 rounded-md border border-[#A7CEFC] bg-white/48 px-8 text-base font-extrabold text-[#245FEA] transition hover:bg-white"
            >
              <Globe size={18} aria-hidden="true" />
              Get the Extension
            </a>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm font-semibold text-[#8BA1C8]">
            {["No credit card", "Free to start", "Built for real job ads"].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-[#22C55E]" aria-hidden="true" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="relative z-10 px-5 py-16 md:px-8 md:py-20 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-[#4F9CF9]">FAQ</p>
            <h2 className="mt-4 text-4xl font-extrabold text-[#0F1C35] md:text-5xl">Questions jobseekers ask first</h2>
          </div>
          <div className="mt-10 grid gap-4">
            {[
              ["Does it invent experience?", "No. RoleGuage separates supported evidence from gaps and flags places where you need real proof."],
              ["Can I use a job board page?", "Yes. Use URL import where possible, copy text when a site blocks extraction, or use the extension workflow."],
              ["Where is my resume stored?", "Saved profile data currently stays in your browser. Production accounts should add encrypted storage and delete controls."],
            ].map(([question, answer]) => (
              <article key={question} className="rounded-2xl border border-[#DDE8F6] bg-white/62 p-6 backdrop-blur">
                <h3 className="text-lg font-extrabold text-[#0F1C35]">{question}</h3>
                <p className="mt-3 text-sm leading-7 text-[#536C99]">{answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-[#DDE8F6] bg-white/76 px-5 py-10 backdrop-blur md:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 text-sm text-[#8BA1C8] md:flex-row">
          <a href="/" className="flex items-center gap-2 font-extrabold text-[#043873]">
            <span className="grid size-7 place-items-center rounded-md bg-[#043873] text-white">
              <Radar size={16} aria-hidden="true" />
            </span>
            RoleGuage
          </a>
          <div className="flex flex-wrap justify-center gap-6">
            <a href="#" className="hover:text-[#043873]">Privacy</a>
            <a href="#" className="hover:text-[#043873]">Terms</a>
            <a href="#" className="hover:text-[#043873]">Contact</a>
            <a href="#" className="hover:text-[#043873]">Blog</a>
          </div>
          <p>© 2026 RoleGuage. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}

function BackgroundSketches() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-70">
      <svg className="absolute -left-14 top-16 -rotate-12 text-[#9EB3DD]/24" width="220" height="280" viewBox="0 0 220 280" fill="none">
        <rect x="8" y="8" width="204" height="264" rx="14" stroke="currentColor" strokeWidth="5" />
        <path d="M160 8L212 60H160V8Z" stroke="currentColor" strokeWidth="4" />
        <path d="M32 84H130M32 112H172M32 138H158M32 180H120M32 208H172M32 234H142" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
      </svg>
      <svg className="absolute right-16 top-24 rotate-12 text-[#9EB3DD]/26" width="210" height="150" viewBox="0 0 210 150" fill="none">
        <rect x="7" y="7" width="196" height="136" rx="14" stroke="currentColor" strokeWidth="5" />
        <path d="M7 25L105 86L203 25M7 143L72 84M203 143L138 84" stroke="currentColor" strokeWidth="4" />
      </svg>
      <svg className="absolute right-10 top-[38%] rotate-6 text-[#9EB3DD]/20" width="190" height="160" viewBox="0 0 190 160" fill="none">
        <rect x="8" y="50" width="174" height="102" rx="14" stroke="currentColor" strokeWidth="5" />
        <path d="M66 50V32C66 19 76 12 90 12H104C118 12 128 19 128 32V50M8 92H182" stroke="currentColor" strokeWidth="5" />
        <rect x="84" y="84" width="28" height="18" rx="5" stroke="currentColor" strokeWidth="4" />
      </svg>
      <svg className="absolute bottom-14 right-24 -rotate-6 text-[#9EB3DD]/22" width="170" height="170" viewBox="0 0 170 170" fill="none">
        <circle cx="70" cy="70" r="58" stroke="currentColor" strokeWidth="6" />
        <path d="M114 114L160 160" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
        <path d="M38 58H88M38 74H98M38 90H78" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      </svg>
      <svg className="absolute left-8 top-[45%] -rotate-6 text-[#9EB3DD]/20" width="140" height="170" viewBox="0 0 140 170" fill="none">
        <rect x="7" y="7" width="126" height="156" rx="12" stroke="currentColor" strokeWidth="5" />
        <path d="M98 7L133 42H98V7Z" stroke="currentColor" strokeWidth="4" />
        <path d="M28 62H86M28 82H110M28 104H94M28 128H104" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      </svg>
    </div>
  );
}
