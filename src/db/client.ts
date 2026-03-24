import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "../utils/config.js";

/** Service-role client for orchestrator (bypasses RLS) */
let serviceClient: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (!serviceClient) {
    serviceClient = createClient(
      config.supabase.url,
      config.supabase.serviceKey
    );
  }
  return serviceClient;
}

/** Anon-key client for user-facing operations (respects RLS) */
let anonClient: SupabaseClient | null = null;

export function getAnonClient(): SupabaseClient {
  if (!anonClient) {
    anonClient = createClient(
      config.supabase.url,
      config.supabase.anonKey
    );
  }
  return anonClient;
}
