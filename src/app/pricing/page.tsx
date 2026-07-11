import { Check } from "lucide-react";
import { SharedFooter } from "../shared-footer";
import { SharedHeader } from "../shared-header";
import { SoftPageHero } from "../soft-page-hero";

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
    <main className="min-h-screen bg-[#F0F4FF] text-[#0F1C35]">
      <SharedHeader active="pricing" />

      <SoftPageHero
        title="Choose the workflow"
        accent="that fits your search"
        description="Start with fit checks, then upgrade when you want saved reports, profile reuse, and a cleaner application workflow."
      />

      <section className="px-5 py-6 md:px-8 md:py-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 md:grid-cols-3">
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
      className={`rounded-2xl border p-7 shadow-[0_16px_44px_rgba(36,95,234,0.08)] transition hover:-translate-y-1 hover:shadow-[0_22px_58px_rgba(36,95,234,0.14)] ${
        featured
          ? "border-[#043873] bg-[#043873] text-white"
          : "border-[#BFD6FF] bg-white/72 text-[#0F1C35]"
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
          href="/matcher"
          className="mt-9 inline-flex h-12 cursor-pointer items-center justify-center rounded-md border border-[#FFE492] bg-white px-5 text-sm font-bold text-[#043873] transition hover:bg-[#FFE492]"
        >
          Get started
        </a>
      )}
    </article>
  );
}
