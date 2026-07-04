import { Radar } from "lucide-react";
import Link from "next/link";

type HeaderSection = "home" | "matcher" | "pricing" | "profile" | "privacy";

export function SharedHeader({ active = "home" }: { active?: HeaderSection }) {
  const navClass = (section: HeaderSection) =>
    active !== "home" && active === section ? "text-[#043873]" : "text-[#536C99] hover:text-[#043873]";

  return (
    <header className="relative z-20 border-b border-[#DDE8F6] bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-8 lg:px-10">
        <Link href="/" className="flex items-center gap-2 font-bold text-[#043873]">
          <span className="grid size-8 place-items-center rounded-md bg-[#043873] text-white">
            <Radar size={20} aria-hidden="true" />
          </span>
          <span className="text-lg md:text-xl">RoleGuage</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-semibold md:flex">
          <Link href="/#features" className={navClass("home")}>Features</Link>
          <Link href="/#how-it-works" className={navClass("home")}>How it works</Link>
          <Link href="/pricing" className={navClass("pricing")}>Pricing</Link>
          <Link href="/#faq" className={navClass("home")}>FAQ</Link>
          <Link href="/profile" className={navClass("profile")}>Profile</Link>
        </nav>

        {active === "matcher" ? (
          <span className="hidden h-11 w-[92px] md:block" aria-hidden="true" />
        ) : (
          <Link
            href="/matcher"
            className="inline-flex h-11 items-center rounded-md bg-[#043873] px-5 text-sm font-extrabold text-white shadow-[0_12px_24px_rgba(4,56,115,0.2)] transition hover:bg-[#0b4c97]"
          >
            Try Now
          </Link>
        )}
      </div>
    </header>
  );
}
