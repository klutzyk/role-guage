"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient, isBrowserSupabaseConfigured } from "@/lib/supabase-browser";

export function useAuthSession() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const isConfigured = isBrowserSupabaseConfigured();

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();

    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setEmail(data.session?.user.email ?? "");
      setName(getDisplayName(data.session?.user));
      setIsLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setEmail(session?.user.email ?? "");
      setName(getDisplayName(session?.user));
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) return;

    setIsLoading(true);
    await supabase.auth.signOut();
    setEmail("");
    setName("");
    setIsLoading(false);
  }

  return {
    email,
    name,
    isAuthenticated: Boolean(email),
    isConfigured,
    isLoading,
    signOut,
  };
}

function getDisplayName(user: { email?: string; user_metadata?: Record<string, unknown> } | null | undefined) {
  const metadataName = user?.user_metadata?.full_name ?? user?.user_metadata?.name;

  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim().split(/\s+/)[0] ?? metadataName.trim();
  }

  const emailPrefix = user?.email?.split("@")[0]?.trim();
  if (!emailPrefix) return "";

  return emailPrefix
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
