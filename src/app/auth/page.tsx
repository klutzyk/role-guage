"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient, isBrowserSupabaseConfigured } from "@/lib/supabase-browser";
import { SharedFooter } from "../shared-footer";
import { SharedHeader } from "../shared-header";

type AuthMode = "sign-in" | "sign-up" | "reset" | "update-password";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [redirectTo, setRedirectTo] = useState("/profile");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isConfigured = isBrowserSupabaseConfigured();

  const title =
    mode === "sign-in"
      ? "Sign in to RoleGuage"
      : mode === "sign-up"
        ? "Create your RoleGuage account"
        : mode === "reset"
          ? "Reset your password"
          : "Set a new password";
  const submitLabel =
    mode === "sign-in"
      ? "Sign in"
      : mode === "sign-up"
        ? "Create account"
        : mode === "reset"
          ? "Send reset link"
          : "Update password";
  const helperCopy = useMemo(
    () =>
      mode === "sign-in"
        ? "Welcome back. Enter your details to continue."
        : mode === "sign-up"
          ? "Create an account to save your profile and applications."
          : mode === "reset"
            ? "Enter your account email and we will send a secure password reset link."
            : "Choose a new password for your RoleGuage account.",
    [mode],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");

    if (next?.startsWith("/") && !next.startsWith("//")) {
      setRedirectTo(next);
    }

    const requestedMode = params.get("mode");
    if (requestedMode === "sign-up" || requestedMode === "reset" || requestedMode === "update-password") {
      setMode(requestedMode);
    }
  }, []);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) return;

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("update-password");
        setError("");
        setMessage("Enter a new password to finish resetting your account.");
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const supabase = getBrowserSupabaseClient();
    if (!supabase) {
      setError("Account sign in is not configured for this environment yet.");
      return;
    }

    const cleanedEmail = email.trim();

    if (mode !== "update-password" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    if (mode !== "reset" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (mode === "sign-up" && name.trim().length < 2) {
      setError("Enter your name.");
      return;
    }

    if ((mode === "sign-up" || mode === "update-password") && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      if (mode === "reset") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanedEmail, {
          redirectTo: `${window.location.origin}/auth?mode=update-password&next=${encodeURIComponent(redirectTo)}`,
        });

        if (resetError) throw resetError;

        setMessage("Check your email for the password reset link.");
        return;
      }

      if (mode === "update-password") {
        const { error: updateError } = await supabase.auth.updateUser({ password });

        if (updateError) throw updateError;

        setMessage("Password updated.");
        router.replace(redirectTo);
        return;
      }

      if (mode === "sign-in") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanedEmail,
          password,
        });

        if (signInError) throw signInError;

        router.replace(redirectTo);
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${redirectTo}`,
          data: {
            full_name: name.trim(),
          },
        },
      });

      if (signUpError) throw signUpError;

      if (data.session) {
        router.replace(redirectTo);
        return;
      }

      setMessage("Account created. Check your email to confirm your account, then sign in.");
      setMode("sign-in");
      setPassword("");
      setConfirmPassword("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not complete sign in.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FBFF] text-[#212529]">
      <SharedHeader active="auth" />

      <section className="bg-[#043873] px-5 py-10 text-white md:px-8 md:py-14 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-4xl font-extrabold leading-tight text-[#A7CEFC] md:text-6xl">Account</h1>
          <p className="mt-4 max-w-4xl text-2xl font-extrabold leading-tight text-white md:text-4xl">
            Sign in to continue.
          </p>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-white/82 md:text-base">
            Access your saved resume, preferences, and previous role checks.
          </p>
        </div>
      </section>

      <section className="px-5 py-10 md:px-8 lg:px-10">
        <div className="mx-auto max-w-md">
          <section className="rounded-md border border-[#DDE8F6] bg-white p-5 shadow-[0_16px_44px_rgba(4,56,115,0.08)] md:p-6">
            <div className="flex rounded-md border border-[#DDE8F6] bg-[#F8FBFF] p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("sign-in");
                  setError("");
                  setMessage("");
                }}
                className={`h-10 flex-1 cursor-pointer rounded-md text-sm font-extrabold transition ${
                  mode === "sign-in" ? "bg-[#043873] text-white" : "text-[#536C99] hover:text-[#043873]"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("sign-up");
                  setError("");
                  setMessage("");
                }}
                className={`h-10 flex-1 cursor-pointer rounded-md text-sm font-extrabold transition ${
                  mode === "sign-up" ? "bg-[#043873] text-white" : "text-[#536C99] hover:text-[#043873]"
                }`}
              >
                Create account
              </button>
            </div>

            <div className="mt-6">
              <h2 className="text-2xl font-extrabold text-[#212529]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#4F5F6F]">{helperCopy}</p>
            </div>

            {!isConfigured ? (
              <div className="mt-5 rounded-md border border-dashed border-[#A7CEFC] bg-[#F8FBFF] p-4 text-sm font-semibold leading-6 text-[#4F5F6F]">
                Account sign in is not configured in this environment. Add the Supabase environment variables and
                restart the app.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
                {mode === "sign-up" ? (
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#4F5F6F]">Name</span>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="h-11 rounded-md border border-[#DDE8F6] bg-[#F8FBFF] px-3 text-sm outline-none transition focus:border-[#4F9CF9] focus:bg-white focus:ring-4 focus:ring-[#4F9CF9]/15"
                      type="text"
                      autoComplete="name"
                      placeholder="Your name"
                    />
                  </label>
                ) : null}
                {mode !== "update-password" ? (
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#4F5F6F]">Email</span>
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="h-11 rounded-md border border-[#DDE8F6] bg-[#F8FBFF] px-3 text-sm outline-none transition focus:border-[#4F9CF9] focus:bg-white focus:ring-4 focus:ring-[#4F9CF9]/15"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                    />
                  </label>
                ) : null}
                {mode !== "reset" ? (
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#4F5F6F]">Password</span>
                    <input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-11 rounded-md border border-[#DDE8F6] bg-[#F8FBFF] px-3 text-sm outline-none transition focus:border-[#4F9CF9] focus:bg-white focus:ring-4 focus:ring-[#4F9CF9]/15"
                      type="password"
                      autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                      placeholder="At least 8 characters"
                    />
                  </label>
                ) : null}
                {mode === "sign-up" || mode === "update-password" ? (
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#4F5F6F]">
                      Confirm password
                    </span>
                    <input
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="h-11 rounded-md border border-[#DDE8F6] bg-[#F8FBFF] px-3 text-sm outline-none transition focus:border-[#4F9CF9] focus:bg-white focus:ring-4 focus:ring-[#4F9CF9]/15"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Repeat password"
                    />
                  </label>
                ) : null}

                {error ? <p className="text-sm font-semibold text-[#B5121B]">{error}</p> : null}
                {message ? <p className="text-sm font-semibold text-[#007A52]">{message}</p> : null}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="h-12 cursor-pointer rounded-md bg-[#043873] px-5 text-sm font-extrabold text-white shadow-[0_12px_24px_rgba(4,56,115,0.18)] transition hover:bg-[#0b4c97] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? "Please wait..." : submitLabel}
                </button>

                <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold">
                  {mode === "sign-in" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("reset");
                        setError("");
                        setMessage("");
                      }}
                      className="cursor-pointer text-[#536C99] transition hover:text-[#043873]"
                    >
                      Forgot password?
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("sign-in");
                        setError("");
                        setMessage("");
                      }}
                      className="cursor-pointer text-[#536C99] transition hover:text-[#043873]"
                    >
                      Back to sign in
                    </button>
                  )}
                  {mode === "sign-in" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("sign-up");
                        setError("");
                        setMessage("");
                      }}
                      className="cursor-pointer text-[#043873] transition hover:text-[#0b4c97]"
                    >
                      Create account
                    </button>
                  ) : null}
                </div>
              </form>
            )}

            <p className="mt-5 text-xs leading-5 text-[#4F5F6F]">
              By continuing, you agree to the{" "}
              <Link href="/privacy" className="font-bold text-[#043873] underline underline-offset-4">
                privacy policy
              </Link>
              .
            </p>
          </section>
        </div>
      </section>

      <SharedFooter />
    </main>
  );
}
