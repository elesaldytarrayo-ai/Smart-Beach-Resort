/* ============================================================
   backend/seedAccounts.js
   Gumagawa ng demo accounts gamit ang Supabase Admin API.
   Hindi gumagamit ng SQL — 100% reliable.

   Accounts na gagawin:
     👑 Admin  → elesaldytarrayo@sbr.com / elesaldytarrayosbr
     👨‍💼 Staff  → staff@sbr.com          / staff123
     👤 User   → user@sbr.com           / user123

   Patakbuhin:  npm run seed
   ============================================================ */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ============================================================
// ACCOUNTS TO CREATE — isang admin lang
// ============================================================
const ACCOUNTS = [
  {
    email:     'elesaldytarrayo@sbr.com',
    password:  'elesaldytarrayosbr',
    full_name: 'Elesa Aldy Tarrayo',
    role:      'admin'
  },
  {
    email:     'staff@sbr.com',
    password:  'staff123',
    full_name: 'Staff Member',
    role:      'staff'
  },
  {
    email:     'user@sbr.com',
    password:  'user123',
    full_name: 'Juan Dela Cruz',
    role:      'user'
  }
];

/* ------------------------------------------------------------
   Helper: create or find auth user, set password, upsert profile
   ------------------------------------------------------------ */
async function seedAccount({ email, password, full_name, role }) {
  console.log(`\n🔧 ${role.toUpperCase()} — ${email}`);

  let userId = null;

  // 1. Try to create the auth user
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name }
  });

  if (createErr) {
    console.log(`   ⚠️  Already exists (${createErr.message})`);

    // Find existing user
    const { data: list } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });
    const found = list?.users?.find((u) => u.email === email);
    if (!found) {
      console.error(`   ❌ Cannot find ${email}`);
      return { email, role, ok: false };
    }
    userId = found.id;
    console.log(`   ✅ Found existing user (${userId.slice(0, 8)}…)`);
  } else {
    userId = created.user.id;
    console.log(`   ✅ Created (${userId.slice(0, 8)}…)`);
  }

  // 2. Force password + confirm email
  const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true
  });
  if (updErr) {
    console.error(`   ❌ Password update failed: ${updErr.message}`);
    return { email, role, ok: false };
  }
  console.log(`   ✅ Password set + email confirmed`);

  // 3. Upsert profile with correct role
  const { error: profErr } = await supabase
    .from('profiles')
    .upsert(
      { id: userId, email, full_name, role },
      { onConflict: 'id' }
    );

  if (profErr) {
    console.error(`   ❌ Profile upsert failed: ${profErr.message}`);
    return { email, role, ok: false };
  }
  console.log(`   ✅ Profile set to role = ${role}`);

  return { email, password, full_name, role, ok: true };
}

/* ------------------------------------------------------------
   Main
   ------------------------------------------------------------ */
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  SMART BEACH RESORT — SEED ACCOUNTS                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const results = [];

  for (const acc of ACCOUNTS) {
    const result = await seedAccount(acc);
    results.push(result);
  }

  // Summary table
  console.log('\n\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  🎉 ALL ACCOUNTS READY                                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log('  ROLE    EMAIL                           PASSWORD');
  console.log('  ─────   ─────────────────────────────   ───────────────────');

  for (const r of results) {
    if (!r.ok) continue;
    const role = r.role.padEnd(6);
    const mail = r.email.padEnd(30);
    const pw   = r.password.padEnd(20);
    console.log(`  ${role}  ${mail}  ${pw}`);
  }

  console.log('\n  Login:     http://localhost:5173/login');
  console.log('  Admin →    /admin');
  console.log('  Staff →    /staff');
  console.log('  User  →    /user\n');

  process.exit(0);
}

main().catch((e) => {
  console.error('\n❌ Fatal error:', e);
  process.exit(1);
});