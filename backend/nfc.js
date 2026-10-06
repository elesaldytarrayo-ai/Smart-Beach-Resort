// backend/nfc.js
// Handles secure NFC token creation, verification, and invalidation.
// Tokens are NEVER stored in plaintext — only their HMAC hash is stored.

import crypto from 'crypto';

const NFC_SECRET = process.env.NFC_SECRET || 'change-me';

// Create a random plaintext NFC token (returned to the client once, never stored).
export function generateRawToken() {
  return crypto.randomBytes(24).toString('hex');
}

// Hash a raw token with HMAC-SHA256 so the DB never stores the raw value.
export function hashToken(rawToken) {
  return crypto.createHmac('sha256', NFC_SECRET).update(rawToken).digest('hex');
}

// Generate a check-in token: 24h expiry by default.
export function makeCheckInToken() {
  const raw = generateRawToken();
  return {
    raw,
    hash: hashToken(raw),
    purpose: 'check_in',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };
}

// Generate a check-out token: 2h expiry.
export function makeCheckOutToken() {
  const raw = generateRawToken();
  return {
    raw,
    hash: hashToken(raw),
    purpose: 'check_out',
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  };
}