/* Simple AES encryption / decryption helpers using CryptoJS.
   The secret key is read from an environment variable.
   When the key is missing, a safe fallback is used so the app
   does not crash during development.
*/

/* Import CryptoJS for AES encryption */
import CryptoJS from 'crypto-js';

/* Encryption key — should be a 32-character random string in production */
const KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'default-key-change-me-32-chars!!';

/* Smallest valid ciphertext prefix produced by CryptoJS AES */
const AES_PREFIX = 'U2FsdGVkX1';

/* Encrypt a value (string, number, etc.).
   Returns the encrypted string, or null when the input is empty.
*/
export function encrypt(plain) {
  /* Treat null and undefined as empty, but keep 0 as valid */
  if (!plain && plain !== 0) return null;

  return CryptoJS.AES.encrypt(String(plain), KEY).toString();
}

/* Decrypt an encrypted string.
   Returns the original plain text, or an empty string on failure.
*/
export function decrypt(cipher) {
  /* Nothing to decrypt */
  if (!cipher) return '';

  /* If the value is not a string, return it as-is */
  if (typeof cipher !== 'string') return String(cipher);

  /* If the value is not a CryptoJS AES ciphertext, assume it is already plain */
  if (!cipher.startsWith(AES_PREFIX)) return cipher;

  const bytes = CryptoJS.AES.decrypt(cipher, KEY);
  const plain = bytes.toString(CryptoJS.enc.Utf8);

  return plain || '';
}

/* Decrypt with a fallback value when decryption fails or returns empty */
export function safeDecrypt(cipher, fallback = '') {
  return decrypt(cipher) || fallback;
}

/* Encrypt a JavaScript object by converting it to JSON first */
export function encryptObject(obj) {
  if (!obj) return null;
  return encrypt(JSON.stringify(obj));
}

/* Decrypt a ciphertext that was originally a JSON object */
export function decryptObject(cipher) {
  if (!cipher) return null;

  const plain = decrypt(cipher);
  if (!plain) return null;

  try {
    return JSON.parse(plain);
  } catch {
    /* Invalid JSON — return null instead of throwing */
    return null;
  }
}