import { SharedFooter } from "../shared-footer";
import { SharedHeader } from "../shared-header";
import { SoftPageHero } from "../soft-page-hero";

const sections = [
  {
    title: "What RoleGuage Collects",
    copy: [
      "RoleGuage collects resume text, job description text, and optional profile details only when you upload, paste, import, save, or analyze that information.",
      "If you choose to use account sync, RoleGuage stores the resume text, resume filename, candidate details, cover letter style preferences, and example letters that you explicitly save to your account.",
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
    title: "Account Storage",
    copy: [
      "Account sync is optional. If enabled, saved profile data is stored against your signed-in account so you can reuse it across devices and future extension workflows.",
      "You can load, export, or delete the account copy from the profile page. Deleting the account copy does not automatically remove local browser data on each device, so clear local data separately when needed.",
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
    title: "Cookies And Similar Storage",
    copy: [
      "RoleGuage does not use advertising cookies or third-party analytics cookies in this version.",
      "Authentication providers may use necessary session storage to keep you signed in. Browser local storage is also used for saved profiles and match history when you use the local-first workflow.",
    ],
  },
  {
    title: "Retention And Control",
    copy: [
      "Local browser data remains on your device until you delete it, clear site data, or uninstall the extension.",
      "Account profile data remains until you delete the account copy from the profile page or request deletion through support.",
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
    <main className="min-h-screen bg-[#F0F4FF] text-[#0F1C35]">
      <SharedHeader active="privacy" />

      <SoftPageHero
        title="How RoleGuage handles"
        accent="resume and job data"
        description="Last updated: July 10, 2026. This page explains what RoleGuage collects, why it is used, and how you can control saved data."
      />

      <section className="px-5 py-6 md:px-8 md:py-8 lg:px-10">
        <div className="mx-auto grid max-w-5xl gap-5">
          {sections.map((section) => (
            <article
              key={section.title}
              className="rounded-2xl border border-[#BFD6FF] bg-white/72 p-6 shadow-[0_16px_44px_rgba(36,95,234,0.08)] backdrop-blur"
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
