import { createClient } from '@supabase/supabase-js'

// Load variables from import.meta.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Let's create a wrapper or an indicator to see if Supabase is properly configured
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// Create the Supabase client safely
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase is not configured yet. HandiBaby will run purely offline (IndexedDB-first) ' +
    'and queue changes until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are provided.'
  )
}
