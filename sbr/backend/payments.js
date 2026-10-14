/* ============================================================
   backend/payments.js
   PayMongo integration.
   Creates checkout sessions and verifies payments.
   ============================================================ */

import 'dotenv/config';

// Config
const PAYMONGO_SECRET = process.env.PAYMONGO_SECRET_KEY;
const PAYMONGO_API = 'https://api.paymongo.com/v1';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Build the Basic Auth header for PayMongo.
function authHeader() {
  if (!PAYMONGO_SECRET) throw new Error('PAYMONGO_SECRET_KEY is missing in .env');

  const token = Buffer.from(`${PAYMONGO_SECRET}:`).toString('base64');
  return `Basic ${token}`;
}

// Convert a value (Unix seconds, Unix ms, or string) into an ISO date string.
// If the value is missing, use the current time (or null if fallbackNow is false).
function toISODate(value, fallbackNow = true) {
  // Empty value → use fallback.
  if (!value && value !== 0) {
    return fallbackNow ? new Date().toISOString() : null;
  }

  // If it's a number, treat it as Unix time.
  const num = Number(value);
  if (!isNaN(num) && num > 0) {
    // Values below 1e12 are in seconds; above are in milliseconds.
    if (num < 1e12) return new Date(num * 1000).toISOString();
    return new Date(num).toISOString();
  }

  // Otherwise, try parsing it as a date string.
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();

  // If all else fails, use fallback.
  return fallbackNow ? new Date().toISOString() : null;
}

// Create a PayMongo checkout session for a booking.
// Returns { checkoutUrl, sessionId }.
export async function createCheckoutSession({ bookingId, amount, description }) {
  console.log('🔵 [PayMongo] Creating session for booking:', bookingId);

  // PayMongo expects amounts in cents (₱1 = 100).
  const amountInCents = Math.round(Number(amount) * 100);
  if (!amountInCents || amountInCents < 100) {
    throw new Error('Amount must be at least ₱1.00');
  }

  // Request body for PayMongo.
  const body = {
    data: {
      attributes: {
        line_items: [{
          name: description || `Booking ${bookingId.slice(0, 8)}`,
          amount: amountInCents,
          currency: 'PHP',
          quantity: 1
        }],
        payment_method_types: ['card', 'gcash', 'paymaya', 'qrph'],
        success_url: `${FRONTEND_URL}/user/booking?status=success`,
        cancel_url:  `${FRONTEND_URL}/user/booking?status=cancelled`,
        reference_number: bookingId,
        description: `SBR Booking — ${bookingId.slice(0, 8)}`
      }
    }
  };

  // Send request to PayMongo.
  const res = await fetch(`${PAYMONGO_API}/checkout_sessions`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader(),
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const json = await res.json();

  // Handle errors.
  if (!res.ok) {
    console.error('❌ [PayMongo] CREATE ERROR:', JSON.stringify(json, null, 2));
    throw new Error(json?.errors?.[0]?.detail || 'PayMongo request failed');
  }

  console.log('✅ [PayMongo] Session created:', json.data.id);

  return {
    checkoutUrl: json.data.attributes.checkout_url,
    sessionId:   json.data.id
  };
}

// Verify a PayMongo checkout session by its ID.
// Returns payment info if paid, or { paid: false } if not.
export async function verifyPaymentBySessionId(sessionId) {
  if (!sessionId) throw new Error('Missing sessionId');

  console.log('🔵 [PayMongo] Verifying session:', sessionId);

  // Ask PayMongo for the session details.
  const res = await fetch(`${PAYMONGO_API}/checkout_sessions/${sessionId}`, {
    method: 'GET',
    headers: {
      'Authorization': authHeader(),
      'Accept': 'application/json'
    }
  });

  const json = await res.json();

  // Handle errors.
  if (!res.ok) {
    console.error('❌ [PayMongo] VERIFY ERROR:', JSON.stringify(json, null, 2));
    throw new Error(json?.errors?.[0]?.detail || 'Cannot verify session');
  }

  const attrs = json.data.attributes;
  const payments = attrs.payments || [];

  console.log(' Session status:', attrs.status);
  console.log(' Payments found:', payments.length);

  // Look for a payment marked as paid.
  const paidPayment = payments.find(
    (p) => p?.attributes?.status === 'paid' || p?.attributes?.paid_at
  );

  // The session is considered paid if any of these are true.
  const isPaid =
    attrs.status === 'completed' ||
    !!paidPayment ||
    !!attrs.paid_at;

  // Not paid yet → return early.
  if (!isPaid) {
    return { paid: false, rawStatus: attrs.status };
  }

  // Pull out the payment details.
  const pAttrs = paidPayment?.attributes || {};
  const billing = pAttrs.billing || {};
  const source = pAttrs.source  || {};

  // Convert the raw paid_at value into an ISO date string.
  const rawPaidAt = pAttrs.paid_at || attrs.paid_at;
  const paidAtISO = toISODate(rawPaidAt);

  console.log(' Raw paid_at:', rawPaidAt);
  console.log(' ISO paid_at:', paidAtISO);

  const result = {
    paid: true,
    paymentId: paidPayment?.id || null,
    amount: (pAttrs.amount || attrs.amount || 0) / 100,
    paidAt: paidAtISO,
    method: source.type || pAttrs.payment_method_type || 'paymongo',
    reference: pAttrs.reference_number || attrs.reference_number || null,
    payerInfo: {
      name: billing.name  || null,
      email: billing.email || null,
      phone: billing.phone || null
    },
    rawStatus: attrs.status
  };

  console.log('✅ [PayMongo] Paid:', {
    paymentId: result.paymentId,
    amount: result.amount,
    method: result.method,
    paidAt: result.paidAt
  });

  return result;
}