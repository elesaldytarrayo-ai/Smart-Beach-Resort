// Simple AES encryption/decryption helpers using CryptoJS.
// The secret key is read from an environment variable.
import CryptoJS from 'crypto-js';

const KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'default-key-change-me-32-chars!!';

// Encrypt a value (string, number, etc.) → returns encrypted string or null.
export function encrypt(plain) {
  if (!plain && plain !== 0) return null;
  return CryptoJS.AES.encrypt(String(plain), KEY).toString();
}

// Decrypt an encrypted string → returns plain text or empty string.
export function decrypt(cipher) {
  if (!cipher) return '';
  if (typeof cipher !== 'string') return String(cipher);
  if (!cipher.startsWith('U2FsdGVkX1')) return cipher;

  const bytes = CryptoJS.AES.decrypt(cipher, KEY);
  const plain = bytes.toString(CryptoJS.enc.Utf8);
  return plain || '';
}

export function safeDecrypt(cipher, fallback = '') {
  return decrypt(cipher) || fallback;
}

export function encryptObject(obj) {
  if (!obj) return null;
  return encrypt(JSON.stringify(obj));
}

export function decryptObject(cipher) {
  if (!cipher) return null;
  const plain = decrypt(cipher);
  if (!plain) return null;
  try {
    return JSON.parse(plain);
  } catch {
    return null;
  }
}