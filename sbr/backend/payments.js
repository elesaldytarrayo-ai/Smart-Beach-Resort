/* ============================================================
   backend/payments.js
   PayMongo integration.
   FIX: Convert Unix timestamp → ISO string para sa paid_at.
   ============================================================ */

import 'dotenv/config';

const PAYMONGO_SECRET = process.env.PAYMONGO_SECRET_KEY;
const PAYMONGO_API    = 'https://api.paymongo.com/v1';
const FRONTEND_URL    = process.env.FRONTEND_URL || 'http://localhost:5173';

/* ------------------------------------------------------------
   Basic auth header
   ------------------------------------------------------------ */
function authHeader() {
  if (!PAYMONGO_SECRET) throw new Error('PAYMONGO_SECRET_KEY is missing in .env');
  const token = Buffer.from(`${PAYMONGO_SECRET}:`).toString('base64');
  return `Basic ${token}`;
}

/* ------------------------------------------------------------
   Helper: Safe Unix timestamp / string → ISO string
   ------------------------------------------------------------ */
function toISODate(value, fallbackNow = true) {
  if (!value && value !== 0) {
    return fallbackNow ? new Date().toISOString() : null;
  }

  // Kung number (Unix timestamp) ito
  const num = Number(value);
  if (!isNaN(num) && num > 0) {
    // Unix SECONDS (< 1e12) o MILLISECONDS (>= 1e12)
    if (num < 1e12) return new Date(num * 1000).toISOString();
    return new Date(num).toISOString();
  }

  // Kung string date ito
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();

  return fallbackNow ? new Date().toISOString() : null;
}

/* ============================================================
   CREATE PayMongo Checkout Session
   ============================================================ */
export async function createCheckoutSession({ bookingId, amount, description }) {
  console.log('🔵 [PayMongo] Creating session for booking:', bookingId);

  const amountInCents = Math.round(Number(amount) * 100);
  if (!amountInCents || amountInCents < 100) {
    throw new Error('Amount must be at least ₱1.00');
  }

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

/* ============================================================
   VERIFY PayMongo Checkout Session
   Returns normalized payment info with proper ISO date.
   ============================================================ */
export async function verifyPaymentBySessionId(sessionId) {
  if (!sessionId) throw new Error('Missing sessionId');

  console.log('🔵 [PayMongo] Verifying session:', sessionId);

  const res = await fetch(`${PAYMONGO_API}/checkout_sessions/${sessionId}`, {
    method: 'GET',
    headers: {
      'Authorization': authHeader(),
      'Accept': 'application/json'
    }
  });

  const json = await res.json();

  if (!res.ok) {
    console.error('❌ [PayMongo] VERIFY ERROR:', JSON.stringify(json, null, 2));
    throw new Error(json?.errors?.[0]?.detail || 'Cannot verify session');
  }

  const attrs = json.data.attributes;
  const payments = attrs.payments || [];

  console.log('   Session status:', attrs.status);
  console.log('   Payments found:', payments.length);

  const paidPayment = payments.find(
    (p) => p?.attributes?.status === 'paid' || p?.attributes?.paid_at
  );

  const isPaid =
    attrs.status === 'completed' ||
    !!paidPayment ||
    !!attrs.paid_at;

  if (!isPaid) {
    return { paid: false, rawStatus: attrs.status };
  }

  const pAttrs  = paidPayment?.attributes || {};
  const billing = pAttrs.billing || {};
  const source  = pAttrs.source  || {};

  // ⭐ CRITICAL FIX: Convert Unix timestamp → ISO string
  const rawPaidAt = pAttrs.paid_at || attrs.paid_at;
  const paidAtISO = toISODate(rawPaidAt);

  console.log('   Raw paid_at:', rawPaidAt);
  console.log('   ISO paid_at:', paidAtISO);

  const result = {
    paid:      true,
    paymentId: paidPayment?.id || null,
    amount:    (pAttrs.amount || attrs.amount || 0) / 100,
    paidAt:    paidAtISO,
    method:    source.type || pAttrs.payment_method_type || 'paymongo',
    reference: pAttrs.reference_number || attrs.reference_number || null,
    payerInfo: {
      name:  billing.name  || null,
      email: billing.email || null,
      phone: billing.phone || null
    },
    rawStatus: attrs.status
  };

  console.log('✅ [PayMongo] Paid:', {
    paymentId: result.paymentId,
    amount:    result.amount,
    method:    result.method,
    paidAt:    result.paidAt
  });

  return result;
}