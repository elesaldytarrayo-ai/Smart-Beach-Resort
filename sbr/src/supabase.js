/* Supabase client with automatic encrypt / decrypt.
   Sensitive fields are encrypted on insert/update
   and decrypted on select using the encryption helpers.
*/

import { createClient } from '@supabase/supabase-js';
import { encrypt, decrypt } from './encryption.js';

/* Read connection values from environment variables */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/* Main Supabase client used across the app */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

/* Map of plain field names to their encrypted column counterparts.
   When reading, we decrypt the encrypted column into the plain name.
   When writing, we encrypt the plain value into the encrypted column.
*/
const ENCRYPTED_FIELDS = {
  profiles: {
    password: 'password_encrypted',
    phone : 'phone_encrypted'
  },
  payments: {
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

/* Encrypt sensitive fields before sending to Supabase.
   Renames each plain field to its encrypted column name.
*/
function encryptRecord(table, payload) {
  /* Skip if payload is empty or the table has no encrypted fields */
  if (!payload || typeof payload !== 'object') return payload;
  const fields = ENCRYPTED_FIELDS[table];
  if (!fields) return payload;

  const out = { ...payload };

  for (const [plainField, encryptedField] of Object.entries(fields)) {
    const value = out[plainField];

    /* Only encrypt non-empty values */
    if (value !== null && value !== undefined && value !== '') {
      out[encryptedField] = encrypt(value);
    }

    /* Remove the plain field so it is not saved unencrypted */
    delete out[plainField];
  }

  return out;
}

/* Decrypt sensitive fields after receiving data from Supabase.
   Adds the plain field back alongside the encrypted column.
*/
function decryptRecord(table, record) {
  /* Handle empty or non-object input */
  if (!record || typeof record !== 'object') return record;

  /* Recursively decrypt each item when the input is an array */
  if (Array.isArray(record)) {
    return record.map((r) => decryptRecord(table, r));
  }

  const fields = ENCRYPTED_FIELDS[table];

  /* Skip if the table has no encrypted fields */
  if (!fields) return record;

  const out = { ...record };

  for (const [plainField, encryptedField] of Object.entries(fields)) {
    const encryptedValue = out[encryptedField];

    /* Only decrypt non-empty string values */
    if (encryptedValue && typeof encryptedValue === 'string') {
      out[plainField] = decrypt(encryptedValue);
    }
  }

  return out;
}

/* Select rows from a table and decrypt the results.
   Supports optional columns, filters, ordering, and limits.
*/
export async function secureSelect(table, options = {}) {
  const {
    columns = '*',
    match = {},
    single = false,
    order = null,
    limit = null
  } = options;

  /* Build the query */
  let query = supabase.from(table).select(columns);

  /* Apply filters */
  for (const [key, value] of Object.entries(match)) {
    query = query.eq(key, value);
  }

  /* Apply optional order */
  if (order) {
    query = query.order(order.column, { ascending: order.ascending ?? false });
  }

  /* Apply optional limit */
  if (limit) {
    query = query.limit(limit);
  }

  /* Return a single row when requested */
  if (single) {
    query = query.single();
  }

  const { data, error } = await query;
  if (error) throw error;

  /* Decrypt before returning */
  return single ? decryptRecord(table, data) : decryptRecord(table, data || []);
}

/* Insert a row and encrypt sensitive fields first. */
export async function secureInsert(table, payload) {
  const toInsert = encryptRecord(table, payload);

  const { data, error } = await supabase
    .from(table)
    .insert(toInsert)
    .select()
    .single();

  if (error) throw error;

  /* Decrypt the returned row before handing it back */
  return decryptRecord(table, data);
}

/* Update a row and encrypt sensitive fields first. */
export async function secureUpdate(table, match, payload) {
  const toUpdate = encryptRecord(table, payload);

  /* Build the update query */
  let query = supabase.from(table).update(toUpdate);

  /* Apply filters */
  for (const [key, value] of Object.entries(match)) {
    query = query.eq(key, value);
  }

  const { data, error } = await query.select().single();
  if (error) throw error;

  /* Decrypt the returned row */
  return decryptRecord(table, data);
}

/* Delete a row matching the given filters. */
export async function secureDelete(table, match) {
  let query = supabase.from(table).delete();

  /* Apply filters */
  for (const [key, value] of Object.entries(match)) {
    query = query.eq(key, value);
  }

  const { error } = await query;
  if (error) throw error;

  return true;
}