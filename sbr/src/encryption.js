// Simple AES encryption/decryption helpers using CryptoJS.
// The secret key is read from an environment variable.
import CryptoJS from 'crypto-js';

// Secret key (fallback if env variable is missing)
const KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'default-key-change-me-32-chars!!';

// Encrypt a value (string, number, etc.) → returns encrypted string or null.
export function encrypt(plain) {
  // Skip empty values (but allow 0).
  if (!plain && plain !== 0) return null;

  // Convert to string and encrypt.
  return CryptoJS.AES.encrypt(String(plain), KEY).toString();
}

// Decrypt an encrypted string → returns plain text or empty string.
export function decrypt(cipher) {
  // No input → empty string.
  if (!cipher) return '';

  // If it's not a string, just make it a string.
  if (typeof cipher !== 'string') return String(cipher);

  // If it doesn't look encrypted, return as-is.
  if (!cipher.startsWith('U2FsdGVkX1')) return cipher;

  // Decrypt and convert back to text.
  const bytes = CryptoJS.AES.decrypt(cipher, KEY);
  const plain = bytes.toString(CryptoJS.enc.Utf8);

  // If decryption fails, return empty string.
  return plain || '';
}

// Same as decrypt, but returns a fallback if decryption fails.
export function safeDecrypt(cipher, fallback = '') {
  return decrypt(cipher) || fallback;
}

// Encrypt an object by converting it to JSON first.
export function encryptObject(obj) {
  if (!obj) return null;
  return encrypt(JSON.stringify(obj));
}

// Decrypt an encrypted JSON string back into an object.
export function decryptObject(cipher) {
  if (!cipher) return null;

  const plain = decrypt(cipher);
  if (!plain) return null;

  try {
    return JSON.parse(plain);
  } catch {
    return null; // Not valid JSON.
  }
}