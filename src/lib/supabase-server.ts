import { createClient } from "@supabase/supabase-js";

type SupabaseEnv = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
};

export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) return null;

  return { url, anonKey, serviceRoleKey };
}

export function isSupabaseConfigured() {
  return Boolean(getSupabaseEnv());
}

export function createSupabaseAuthClient() {
  const env = getSupabaseEnv();
  if (!env) return null;

  return createClient(env.url, env.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function createSupabaseServiceClient() {
  const env = getSupabaseEnv();
  if (!env) return null;

  return createClient(env.url, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function getUserIdFromBearerToken(authorizationHeader: string | null) {
  const token = parseBearerToken(authorizationHeader);
  if (!token) return null;

  const client = createSupabaseAuthClient();
  if (!client) return null;

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user?.id) return null;

  return data.user.id;
}

function parseBearerToken(value: string | null) {
  if (!value) return "";

  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}
