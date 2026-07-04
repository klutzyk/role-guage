import { Check, Radar } from "lucide-react";
import { SharedFooter } from "../shared-footer";

const plans = [
  {
    name: "Starter",
    price: "$0",
    copy: "For checking a few roles before you spend time applying.",
    items: ["3 role checks", "Fit score", "Evidence gaps", "Manual paste workflow"],
    featured: false,
  },
  {
    name: "Active Search",
    price: "$19",
    copy: "For jobseekers who want every application to be targeted.",
    items: ["Unlimited role checks", "Resume PDF import", "Job URL import", "Application tracker", "Exportable fit reports"],
    featured: true,
  },
  {
    name: "Career Sprint",
    price: "$99",
    copy: "For a deeper job-search reset with structured review.",
    items: ["Profile audit", "Target role strategy", "Portfolio project plan", "Resume review notes"],
    featured: false,
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#F8FBFF] text-[#212529]">
      <header className="border-b border-[#DDE8F6] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-8 lg:px-10">
          <a href="/" className="flex items-center gap-2 font-bold text-[#043873]">
            <span className="grid size-8 place-items-center rounded-md bg-[#043873] text-white">
              <Radar size={20} aria-hidden="true" />
            </span>
            <span className="text-xl">RoleGuage</span>
          </a>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-[#4F5F6F] md:flex">
            <a href="/#features" className="hover:text-[#043873]">Features</a>
            <a href="/#how-it-works" className="hover:text-[#043873]">How it works</a>
            <a href="/pricing" className="text-[#043873]">Pricing</a>
            <a href="/#faq" className="hover:text-[#043873]">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <a href="/profile" className="hidden text-sm font-bold text-[#536C99] hover:text-[#043873] sm:inline">
              Profile
            </a>
            <a
              href="/matcher#matcher"
              className="inline-flex h-10 items-center rounded-md bg-[#4F9CF9] px-4 text-sm font-bold text-white transition hover:bg-[#3b8dea]"
            >
              Try Now
            </a>
          </div>
        </div>
      </header>

      <section className="bg-[#043873] px-5 py-10 text-white md:px-8 md:py-14 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-4xl font-extrabold leading-tight md:text-6xl">Pricing</h1>
          <p className="mt-4 max-w-4xl text-2xl font-extrabold leading-tight text-white md:text-4xl">
            Choose the workflow that fits your job search.
          </p>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-white/82 md:text-base">
            Start with fit checks, then upgrade when you want saved reports, profile reuse,
            and a cleaner application workflow.
          </p>
        </div>
      </section>

      <section className="px-5 py-10 md:px-8 md:py-14 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <PricingCard key={plan.name} {...plan} />
            ))}
          </div>
        </div>
      </section>

      <SharedFooter />
    </main>
  );
}

function PricingCard({
  name,
  price,
  copy,
  items,
  featured,
}: {
  name: string;
  price: string;
  copy: string;
  items: string[];
  featured: boolean;
}) {
  const isPaid = price !== "$0";

  return (
    <article
      className={`rounded-md border p-7 shadow-[0_14px_40px_rgba(4,56,115,0.08)] ${
        featured
          ? "border-[#043873] bg-[#043873] text-white"
          : "border-[#FFE492] bg-white text-[#212529]"
      }`}
    >
      <h2 className="text-2xl font-extrabold">{name}</h2>
      <p className={`mt-5 text-sm leading-7 ${featured ? "text-white/82" : "text-[#4F5F6F]"}`}>{copy}</p>
      <p className={`mt-9 text-4xl font-extrabold ${featured ? "text-white" : "text-[#212529]"}`}>{price}</p>
      <ul className="mt-8 grid gap-4">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-sm font-semibold leading-6">
            <Check size={17} className={`mt-1 shrink-0 ${featured ? "text-[#FFE492]" : "text-[#043873]"}`} aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      {isPaid ? (
        <button
          type="button"
          disabled
          className={`mt-9 inline-flex h-12 cursor-not-allowed items-center justify-center rounded-md px-5 text-sm font-bold ${
            featured ? "bg-white/18 text-white/70" : "border border-[#DDE8F6] bg-[#F1F5FA] text-[#6B7886]"
          }`}
        >
          Coming soon
        </button>
      ) : (
        <a
          href="/matcher#matcher"
          className="mt-9 inline-flex h-12 cursor-pointer items-center justify-center rounded-md border border-[#FFE492] bg-white px-5 text-sm font-bold text-[#043873] transition hover:bg-[#FFE492]"
        >
          Get started
        </a>
      )}
    </article>
  );
}
