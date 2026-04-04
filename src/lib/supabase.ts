import { createBrowserClient } from '@supabase/ssr'
import { parsePublicSupabaseEnv } from './supabase/env-public'

const env = parsePublicSupabaseEnv(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

if (!env) {
  throw new Error("Missing Supabase environment variables")
}

console.log("Supabase URL:", env.url)

export const supabase = createBrowserClient(env.url, env.key)
