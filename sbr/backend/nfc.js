// backend/nfc.js
// Creates, hashes, and expires NFC tokens.
// Only the HMAC hash is stored — never the raw token.

import crypto from 'crypto';

// Secret key used to hash tokens.
const NFC_SECRET = process.env.NFC_SECRET || 'change-me';

// Make a random token string (24 bytes → 48 hex characters).
export function generateRawToken() {
  return crypto.randomBytes(24).toString('hex');
}

// Hash a token with HMAC-SHA256 so the raw value is never stored.
export function hashToken(rawToken) {
  return crypto.createHmac('sha256', NFC_SECRET).update(rawToken).digest('hex');
}

// Make a check-in token that expires in 24 hours.
export function makeCheckInToken() {
  const raw = generateRawToken();
  const oneDay = 24 * 60 * 60 * 1000;

  return {
    raw,
    hash: hashToken(raw),
    purpose: 'check_in',
    expiresAt: new Date(Date.now() + oneDay).toISOString()
  };
}

// Make a check-out token that expires in 2 hours.
export function makeCheckOutToken() {
  const raw = generateRawToken();
  const twoHours = 2 * 60 * 60 * 1000;

  return {
    raw,
    hash: hashToken(raw),
    purpose: 'check_out',
    expiresAt: new Date(Date.now() + twoHours).toISOString()
  };
}