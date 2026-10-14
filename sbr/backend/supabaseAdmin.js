// backend/supabaseAdmin.js
// Creates a Supabase admin client using the service role key.
// Loads .env from the project root (one level up from backend/).

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get the current file's directory (needed in ES modules).
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from the project root (sbr/.env).
dotenv.config({ path: resolve(__dirname, '..', '.env') });

// Read Supabase config from environment variables.
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Show which variables are loaded (masked for safety).
console.log(' Debug supabaseAdmin.js:');
console.log(' SUPABASE_URL:', URL ? `✅ ${URL.slice(0, 30)}…` : '❌ MISSING');
console.log(' SERVICE_ROLE_KEY:', KEY ? `✅ ${KEY.slice(0, 20)}…` : '❌ MISSING');

// Stop if the URL is missing.
if (!URL) {
  console.error('\n❌ SUPABASE_URL is missing in sbr/.env');
  console.error(' Check if the .env file exists at:');
  console.error(' C:\\Users\\ADMIN\\Documents\\GitHub\\Smart-Beach-Resort\\sbr\\.env');
  process.exit(1);
}

// Stop if the service role key is missing.
if (!KEY) {
  console.error('\n❌ SUPABASE_SERVICE_ROLE_KEY is missing in sbr/.env');
  process.exit(1);
}

// Create and export the admin client.
export const supabaseAdmin = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

console.log('✅ Supabase admin client ready\n');