/* ============================================================
   src/encryption.js
   AES-256 symmetric encryption + decryption.
   ============================================================ */

import CryptoJS from 'crypto-js';

const KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'default-key-change-me-32-chars!!';

/* ------------------------------------------------------------
   ENCRYPT — plain → cipher (bago i-save sa DB)
   ------------------------------------------------------------ */
export function encrypt(plain) {
  if (!plain && plain !== 0) return null;
  try {
    return CryptoJS.AES.encrypt(String(plain), KEY).toString();
  } catch (e) {
    console.error('ENCRYPT ERROR:', e);
    return null;
  }
}

/* ------------------------------------------------------------
   DECRYPT — cipher → plain (pagkatapos basahin mula sa DB)
   ------------------------------------------------------------ */
export function decrypt(cipher) {
  if (!cipher) return '';

  // Kung plain text na (hindi encrypted), ibalik na lang
  if (typeof cipher !== 'string') return String(cipher);

  // Ang AES ciphertext ay nagsisimula sa "U2FsdGVkX1" (base64 ng "Salted__")
  if (!cipher.startsWith('U2FsdGVkX1')) {
    return cipher;   // hindi encrypted, plain text na
  }

  try {
    const bytes = CryptoJS.AES.decrypt(cipher, KEY);
    const plain = bytes.toString(CryptoJS.enc.Utf8);
    return plain || '';   // empty kung mali ang key
  } catch (e) {
    console.error('DECRYPT ERROR:', e);
    return '';
  }
}

/* ------------------------------------------------------------
   SAFE DECRYPT — hindi nag-e-error kahit ano ang input
   ------------------------------------------------------------ */
export function safeDecrypt(cipher, fallback = '') {
  try {
    return decrypt(cipher) || fallback;
  } catch {
    return fallback;
  }
}

/* ------------------------------------------------------------
   ENCRYPT OBJECT — para sa payer_info, etc.
   ------------------------------------------------------------ */
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