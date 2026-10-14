// backend/seedAccounts.js
// Creates (or updates) the admin/staff/user accounts in Supabase.
// Run this once to set up your seed accounts.

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Read Supabase config from environment variables.
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Stop if the config is missing.
if (!URL || !KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

// Create the Supabase admin client.
const supabase = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Accounts to create.
const ACCOUNTS = [
  {
    email: 'elesaldytarrayo@sbr.com',
    password: 'elesaldytarrayosbr',
    full_name: 'Elesaldy Tarrayo',
    role: 'admin'
  }
];

// Create or update a single account.
// Steps: create auth user → set password → upsert profile.
async function seedAccount({ email, password, full_name, role }) {
  console.log(`\n🔧 ${role.toUpperCase()} — ${email}`);

  let userId = null;

  // 1. Try to create the auth user.
  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name }
  });

  if (created.error) {
    // User already exists → find their ID.
    console.log(`⚠️ Already exists (${created.error.message})`);

    const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = list.data?.users?.find((u) => u.email === email);

    if (!found) {
      console.error(` ❌ Cannot find ${email}`);
      return { email, role, ok: false };
    }

    userId = found.id;
    console.log(` ✅ Found existing user (${userId.slice(0, 8)}…)`);
  } else {
    // Newly created.
    userId = created.data.user.id;
    console.log(` ✅ Created (${userId.slice(0, 8)}…)`);
  }

  // 2. Force password + confirm email.
  const updated = await supabase.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true
  });

  if (updated.error) {
    console.error(` ❌ Password update failed: ${updated.error.message}`);
    return { email, role, ok: false };
  }
  console.log(` ✅ Password set + email confirmed`);

  // 3. Upsert the profile with the correct role.
  const profileResult = await supabase
    .from('profiles')
    .upsert(
      { id: userId, email, full_name, role },
      { onConflict: 'id' }
    );

  if (profileResult.error) {
    console.error(` ❌ Profile upsert failed: ${profileResult.error.message}`);
    return { email, role, ok: false };
  }
  console.log(` ✅ Profile set to role = ${role}`);

  return { email, password, full_name, role, ok: true };
}

// Main — run the seeding for all accounts.
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  SMART BEACH RESORT — SEED ACCOUNTS                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const results = [];

  for (const acc of ACCOUNTS) {
    const result = await seedAccount(acc);
    results.push(result);
  }

  // Print a summary table.
  console.log('\n\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  🎉 ALL ACCOUNTS READY                                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log('  ROLE               EMAIL                      PASSWORD');
  console.log('  ─────   ─────────────────────────────   ───────────────────');

  for (const r of results) {
    if (!r.ok) continue;
    const role = r.role.padEnd(6);
    const mail = r.email.padEnd(30);
    const pw   = r.password.padEnd(20);
    console.log(`  ${role}  ${mail}  ${pw}`);
  }

  console.log('\n Login: http://localhost:5173/login');
  console.log(' Admin → /admin');
  console.log(' Staff → /staff');
  console.log(' User  → /user\n');

  process.exit(0);
}

// Run main and handle any fatal error.
main().catch((e) => {
  console.error('\n❌ Fatal error:', e);
  process.exit(1);
});