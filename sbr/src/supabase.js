/* ============================================================
   src/supabase.js
   Supabase client + AUTOMATIC encrypt/decrypt.
   ------------------------------------------------------------
   ✅ Encrypted only sa Supabase
   ✅ Decrypted sa frontend (/decrypt-viewer)
   ============================================================ */

import { createClient } from '@supabase/supabase-js';
import { encrypt, decrypt } from './encryption.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

/* ============================================================
   ENCRYPTED FIELDS MAP
   ============================================================ */
const ENCRYPTED_FIELDS = {
  profiles: {
    password: 'password_encrypted',
    phone: 'phone_encrypted'
  },
  payments: {
    reference: 'reference_number_encrypted',
    payment_reference: 'reference_number_encrypted',
    reference_number: 'reference_number_encrypted',
    paymongo_id: 'paymongo_id_encrypted'
  },
  bookings: {
    paymongo_session_id: 'paymongo_session_id_encrypted'
  },
  nfc_tokens: {
    nfc_uid: 'nfc_uid_encrypted',
    nfc_token: 'nfc_token_encrypted'
  }
};

/* ============================================================
   HELPER: Encrypt record bago i-save
   ============================================================ */
function encryptRecord(table, payload) {
  if (!payload || typeof payload !== 'object') return payload;

  const fields = ENCRYPTED_FIELDS[table];
  if (!fields) return payload;

  const out = { ...payload };

  for (const [plainField, encryptedField] of Object.entries(fields)) {
    const value = out[plainField];

    if (value !== null && value !== undefined && value !== '') {
      out[encryptedField] = encrypt(value);
    }

    delete out[plainField];
  }

  return out;
}

/* ============================================================
   HELPER: Decrypt record pagkatapos mag-select
   ============================================================ */
function decryptRecord(table, record) {
  if (!record || typeof record !== 'object') return record;

  if (Array.isArray(record)) {
    return record.map((r) => decryptRecord(table, r));
  }

  const fields = ENCRYPTED_FIELDS[table];
  if (!fields) return record;

  const out = { ...record };

  for (const [plainField, encryptedField] of Object.entries(fields)) {
    const encryptedValue = out[encryptedField];
    if (encryptedValue && typeof encryptedValue === 'string') {
      out[plainField] = decrypt(encryptedValue);
    }
  }

  return out;
}

/* ============================================================
   secureSelect
   ============================================================ */
export async function secureSelect(table, options = {}) {
  const {
    columns = '*',
    match = {},
    single = false,
    order = null,
    limit = null
  } = options;

  let query = supabase.from(table).select(columns);

  for (const [key, value] of Object.entries(match)) {
    query = query.eq(key, value);
  }

  if (order) {
    query = query.order(order.column, { ascending: order.ascending ?? false });
  }

  if (limit) {
    query = query.limit(limit);
  }

  if (single) query = query.single();

  const { data, error } = await query;
  if (error) throw error;

  return single
    ? decryptRecord(table, data)
    : decryptRecord(table, data || []);
}

/* ============================================================
   secureInsert
   ============================================================ */
export async function secureInsert(table, payload) {
  const toInsert = encryptRecord(table, payload);

  const { data, error } = await supabase
    .from(table)
    .insert(toInsert)
    .select()
    .single();

  if (error) throw error;

  return decryptRecord(table, data);
}

/* ============================================================
   secureUpdate
   ============================================================ */
export async function secureUpdate(table, match, payload) {
  const toUpdate = encryptRecord(table, payload);

  let query = supabase.from(table).update(toUpdate);

  for (const [key, value] of Object.entries(match)) {
    query = query.eq(key, value);
  }

  const { data, error } = await query.select().single();
  if (error) throw error;

  return decryptRecord(table, data);
}

/* ============================================================
   secureDelete
   ============================================================ */
export async function secureDelete(table, match) {
  let query = supabase.from(table).delete();

  for (const [key, value] of Object.entries(match)) {
    query = query.eq(key, value);
  }

  const { error } = await query;
  if (error) throw error;
  return true;
}