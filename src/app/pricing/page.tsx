import { ArrowLeft, Check, Radar } from "lucide-react";

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
    <main className="min-h-screen bg-[#F0F4FF] text-[#212529]">
      <header className="border-b border-[#DDE8F6] bg-white/86 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-8 lg:px-10">
          <a href="/" className="flex items-center gap-2 font-bold text-[#043873]">
            <span className="grid size-8 place-items-center rounded-md bg-[#043873] text-white">
              <Radar size={20} aria-hidden="true" />
            </span>
            <span className="text-lg">RoleGuage</span>
          </a>
          <a
            href="/"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[#A7CEFC] bg-white px-4 text-sm font-bold text-[#043873] transition hover:bg-[#EAF4FF]"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Home
          </a>
        </div>
      </header>

      <section className="px-5 py-16 md:px-8 md:py-22 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-[#4F9CF9]">Pricing</p>
            <h1 className="mt-4 text-4xl font-extrabold text-[#0F1C35] md:text-6xl">Choose your plan</h1>
            <p className="mx-auto mt-5 max-w-3xl text-sm leading-7 text-[#536C99] md:text-base">
              Start with fit checks, then upgrade when you want saved reports, profile reuse, and a cleaner application workflow.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <PricingCard key={plan.name} {...plan} />
            ))}
          </div>
        </div>
      </section>
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
