import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"] || "";
const supabaseAnonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] || "";
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing required Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Service client for server-side operations
export const supabaseAdmin = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : supabase; // Fallback to anon client if service key not available
