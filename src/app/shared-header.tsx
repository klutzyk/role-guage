"use client";

import { ChevronDown, Radar } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { clearLocalRoleGuageData } from "@/lib/local-profile-storage";
import { useAuthSession } from "@/lib/use-auth-session";

type HeaderSection = "home" | "matcher" | "pricing" | "profile" | "privacy" | "auth";

export function SharedHeader({ active = "home" }: { active?: HeaderSection }) {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const { email, name, isAuthenticated, isConfigured, isLoading, signOut } = useAuthSession();
  const navClass = (section: HeaderSection) =>
    active !== "home" && active === section ? "text-[#043873]" : "text-[#536C99] hover:text-[#043873]";

  return (
    <header className="relative z-[100] border-b border-[#DDE8F6] bg-white/90 backdrop-blur">
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
        </nav>

        <div className="flex items-center gap-3">
          {isConfigured && !isLoading ? (
            isAuthenticated ? (
              <div
                className="relative"
                onMouseEnter={() => setIsAccountMenuOpen(true)}
                onMouseLeave={() => setIsAccountMenuOpen(false)}
                onFocus={() => setIsAccountMenuOpen(true)}
              >
                <Link
                  href="/profile"
                  className="inline-flex h-11 items-center gap-2 rounded-md border border-[#DDE8F6] bg-white px-3 text-sm font-extrabold text-[#043873] transition hover:bg-[#F8FBFF]"
                  aria-expanded={isAccountMenuOpen}
                  aria-haspopup="menu"
                >
                  <span className="hidden sm:inline">Hi, {name || "there"}</span>
                  <span className="sm:hidden">Account</span>
                  <ChevronDown size={16} aria-hidden="true" />
                </Link>

                {isAccountMenuOpen ? (
                  <div
                    className="absolute right-0 top-12 z-[110] w-64 rounded-md border border-[#DDE8F6] bg-white p-2 shadow-[0_18px_44px_rgba(4,56,115,0.14)]"
                    role="menu"
                  >
                    <div className="border-b border-[#DDE8F6] px-3 py-2">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#536C99]">Signed in</p>
                      <p className="mt-1 truncate text-sm font-bold text-[#043873]">{email}</p>
                    </div>
                    <Link
                      href="/profile"
                      onClick={() => setIsAccountMenuOpen(false)}
                      className="mt-2 flex rounded-md px-3 py-2 text-sm font-bold text-[#4F5F6F] transition hover:bg-[#F8FBFF] hover:text-[#043873]"
                      role="menuitem"
                    >
                      Profile
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        setIsAccountMenuOpen(false);
                        clearLocalRoleGuageData();
                        await signOut();
                        if (window.location.pathname === "/profile") {
                          window.location.assign("/auth");
                        }
                      }}
                      className="flex w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm font-bold text-[#B5121B] transition hover:bg-[#FFF1F2]"
                      role="menuitem"
                    >
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <Link
                href="/auth"
                className={`inline-flex h-11 items-center rounded-md border border-[#DDE8F6] bg-white px-4 text-sm font-extrabold transition hover:bg-[#F8FBFF] ${
                  active === "auth" ? "text-[#043873]" : "text-[#536C99] hover:text-[#043873]"
                }`}
              >
                Sign in
              </Link>
            )
          ) : null}
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
      </div>
    </header>
  );
}
