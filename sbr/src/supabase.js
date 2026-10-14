// src/supabase.js
// Public Supabase client for the browser.

import { createClient } from '@supabase/supabase-js';

// Read config from environment variables.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Stop early if the config is missing.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

// Create and export the Supabase client.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Get the current user's role. Returns null if not logged in.
export async function getMyRole() {
  // Get the logged-in user.
  const userResult = await supabase.auth.getUser();
  const user = userResult.data.user;

  // Not logged in → return null.
  if (!user) return null;

  // Get the role from the profiles table.
  const profileResult = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  // If no role found, default to 'user'.
  return profileResult.data?.role || 'user';
}