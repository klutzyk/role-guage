import { SharedFooter } from "../shared-footer";
import { SharedHeader } from "../shared-header";

const sections = [
  {
    title: "What RoleGuage Collects",
    copy: [
      "RoleGuage collects resume text, job description text, and optional profile details only when you upload, paste, import, save, or analyze that information.",
      "The Chrome extension can read the visible job page you are viewing when you open or use the extension. It does not collect your full browsing history.",
    ],
  },
  {
    title: "How The Data Is Used",
    copy: [
      "We use the information you provide to generate resume-job match reports, evidence gaps, hard requirement checks, cover letter drafts, and application notes.",
      "We do not sell your data, use it for advertising, or use it to build unrelated user profiles.",
    ],
  },
  {
    title: "Local Browser Storage",
    copy: [
      "Saved resume, profile details, and match history may be kept in your browser so you can reuse them across role checks.",
      "You can delete saved resume, profile, and history data from the RoleGuage app or extension.",
    ],
  },
  {
    title: "AI Processing",
    copy: [
      "When you request an analysis or cover letter, RoleGuage may send the relevant resume text, job description text, and minimal profile context to AI service providers only to generate the requested output.",
      "We aim to send only the information needed for the specific request.",
    ],
  },
  {
    title: "Chrome Extension Permissions",
    copy: [
      "The extension uses activeTab and scripting permissions to extract visible job description text from the current tab after you open or use the extension.",
      "The extension uses storage permission to save resume/profile data in your browser.",
    ],
  },
  {
    title: "Contact",
    copy: [
      "For privacy questions or deletion requests, contact the RoleGuage publisher using the support details listed on the Chrome Web Store listing or website.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#F8FBFF] text-[#212529]">
      <SharedHeader active="privacy" />

      <section className="bg-[#043873] px-5 py-10 text-white md:px-8 md:py-14 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-4xl font-extrabold leading-tight text-[#A7CEFC] md:text-6xl">
            Privacy
          </p>
          <h1 className="mt-4 max-w-4xl text-2xl font-extrabold leading-tight text-white md:text-4xl">
            How RoleGuage handles resume and job data.
          </h1>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-white/82 md:text-base">
            Last updated: July 4, 2026. This page explains what the website and
            Chrome extension collect, why it is used, and how you can control
            saved data.
          </p>
        </div>
      </section>

      <section className="px-5 py-10 md:px-8 md:py-14 lg:px-10">
        <div className="mx-auto grid max-w-5xl gap-5">
          {sections.map((section) => (
            <article
              key={section.title}
              className="rounded-md border border-[#DDE8F6] bg-white p-6 shadow-[0_14px_40px_rgba(4,56,115,0.06)]"
            >
              <h2 className="text-2xl font-extrabold text-[#043873]">{section.title}</h2>
              <div className="mt-4 grid gap-3 text-base leading-8 text-[#536C99]">
                {section.copy.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <SharedFooter />
    </main>
  );
}
