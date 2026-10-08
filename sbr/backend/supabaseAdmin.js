import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (one level up from backend/)
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log(' Debug supabaseAdmin.js:');
console.log(' SUPABASE_URL:', URL ? `✅ ${URL.slice(0, 30)}…` : '❌ MISSING');
console.log(' SERVICE_ROLE_KEY:', KEY ? `✅ ${KEY.slice(0, 20)}…` : '❌ MISSING');

if (!URL) {
  console.error('\n❌ SUPABASE_URL is missing in sbr/.env');
  console.error(' Check kung may .env file sa:');
  console.error(' C:\\Users\\ADMIN\\Documents\\GitHub\\Smart-Beach-Resort\\sbr\\.env');
  process.exit(1);
}

if (!KEY) {
  console.error('\n❌ SUPABASE_SERVICE_ROLE_KEY is missing in sbr/.env');
  process.exit(1);
}

export const supabaseAdmin = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

console.log('✅ Supabase admin client ready\n');