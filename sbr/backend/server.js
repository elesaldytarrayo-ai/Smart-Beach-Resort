import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { supabaseAdmin } from './supabaseAdmin.js';
import { createCheckoutSession, verifyPaymentBySessionId } from './payments.js';
import { makeCheckInToken, makeCheckOutToken, hashToken } from './nfc.js';

const app = express();

app.use(cors({
  origin: [
    'http://localhost:5173',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));

// Date helper
function toISODate(value, fallbackNow = true) {
  if (!value && value !== 0) {
    return fallbackNow ? new Date().toISOString() : null;
  }
  const num = Number(value);
  if (!isNaN(num) && num > 0) {
    if (num < 1e12) return new Date(num * 1000).toISOString();
    return new Date(num).toISOString();
  }
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();
  return fallbackNow ? new Date().toISOString() : null;
}

/* ------------------------------------------------------------
   ⭐ BULLETPROOF PAYMENT SAVE
   - Uses UPSERT (insert or update by booking_id)
   - Ignores "duplicate key" errors if they somehow happen
   - Never throws on duplicate
   ------------------------------------------------------------ */
async function savePayment({ bookingId, amount, method, paymentId, paidAt, payerInfo }) {
  const paidAtISO = toISODate(paidAt);

  console.log('💾 Upserting payment for booking:', bookingId);

  const { error } = await supabaseAdmin
    .from('payments')
    .upsert(
      {
        booking_id: bookingId,
        amount: Number(amount) || 0,
        method: method || 'paymongo',
        status: 'paid',
        reference: paymentId || null,
        paymongo_id: paymentId || null,
        payer_info: payerInfo || null,
        currency: 'PHP',
        paid_at: paidAtISO
      },
      { onConflict: 'booking_id' }
    );

  // ⭐ SWALLOW duplicate error — payment already exists
  if (error) {
    if (error.code === '23505' || String(error.message).includes('duplicate')) {
      console.log('ℹ️ Payment already exists — OK (no-op)');
      return;
    }
    console.error('❌ savePayment error:', error);
    throw new Error('Failed to save payment: ' + error.message);
  }

  console.log('✅ Payment saved (upsert)');
}

// Confirm booking (paid + confirmed)
async function confirmBooking(bookingId) {
  const { error } = await supabaseAdmin
    .from('bookings')
    .update({ payment_status: 'paid', status: 'confirmed' })
    .eq('id', bookingId);

  if (error) throw new Error('Booking confirm failed: ' + error.message);
  console.log('🟢 Booking confirmed:', bookingId);
}

// PayMongo Webhook
app.post(
  '/webhooks/paymongo',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const event = JSON.parse(req.body.toString('utf8'));
      const eventType = event?.data?.attributes?.type;
      console.log('📩 [Webhook]', eventType);

      if (eventType === 'checkout_session.payment.paid' || eventType === 'payment.paid') {
        const attrs = event.data.attributes;
        const bookingId = attrs?.data?.attributes?.reference_number || attrs?.reference_number;

        if (bookingId) {
          await confirmBooking(bookingId);

          const amount = (attrs?.data?.attributes?.amount || 0) / 100;
          const paymentId = attrs?.data?.id || attrs?.id;
          const paidAt = attrs?.data?.attributes?.paid_at;

          await savePayment({ bookingId, amount, method: 'paymongo', paymentId, paidAt });

          const { data: booking } = await supabaseAdmin
            .from('bookings').select('room_id').eq('id', bookingId).single();

          if (booking?.room_id) {
            const token = makeCheckInToken();
            await supabaseAdmin.from('nfc_tokens').insert({
              booking_id: bookingId,
              room_id: booking.room_id,
              token_hash: token.hash,
              purpose: token.purpose,
              status: 'active',
              expires_at: token.expiresAt
            });
          }
        }
      }

      res.status(200).json({ received: true });
    } catch (err) {
      console.error('❌ Webhook error:', err);
      res.status(400).json({ error: err.message });
    }
  }
);

app.use(express.json());

// Auth middleware
async function authUser(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Missing token' });

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: 'Invalid token' });

    const { data: profile } = await supabaseAdmin
      .from('profiles').select('role').eq('id', data.user.id).single();

    req.user = { ...data.user, role: profile?.role || 'user' };
    next();
  } catch (err) {
    res.status(500).json({ error: 'Auth failed' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// Health
app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'SBR backend',
    config: {
      supabase: !!process.env.SUPABASE_URL,
      paymongo: !!process.env.PAYMONGO_SECRET_KEY,
      nfc: !!process.env.NFC_SECRET
    }
  });
});

// ADMIN — create staff
app.post('/api/admin/create-staff', authUser, requireRole('admin'), async (req, res) => {
  try {
    const { email, password, full_name, phone } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

    const { data: authUser2, error: authErr } =
      await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name }
      });
    if (authErr) return res.status(400).json({ error: authErr.message });

    const { error: profErr } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: authUser2.user.id, email, full_name, phone, role: 'staff' }, { onConflict: 'id' });
    if (profErr) return res.status(400).json({ error: profErr.message });

    console.log('✅ Staff created:', email);
    res.json({ ok: true, user: authUser2.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE PayMongo checkout
app.post('/api/payments/checkout', authUser, async (req, res) => {
  try {
    const { bookingId, description } = req.body;
    if (!bookingId) return res.status(400).json({ error: 'Missing bookingId' });

    const { data: booking, error: bErr } = await supabaseAdmin
      .from('bookings')
      .select('*, rooms(room_number)')
      .eq('id', bookingId)
      .eq('user_id', req.user.id)
      .single();

    if (bErr || !booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.payment_status === 'paid') {
      return res.json({ ok: true, alreadyPaid: true });
    }

    const { checkoutUrl, sessionId } = await createCheckoutSession({
      bookingId,
      amount: booking.total_amount,
      description: description || `Room ${booking.rooms?.room_number}`
    });

    await supabaseAdmin
      .from('bookings')
      .update({ paymongo_session_id: sessionId })
      .eq('id', bookingId);

    res.json({ ok: true, checkoutUrl, sessionId });
  } catch (err) {
    console.error('❌ CHECKOUT ERROR:', err);
    res.status(400).json({ ok: false, error: err.message });
  }
});

// VERIFY payment — AUTO-CONFIRM + SAVE (bulletproof)
app.post('/api/payments/verify', authUser, async (req, res) => {
  try {
    const { bookingId, sessionId } = req.body;
    console.log('\n🟡 [Verify] bookingId:', bookingId, '| sessionId:', sessionId);

    if (!bookingId) return res.status(400).json({ error: 'Missing bookingId' });

    const { data: booking, error: bErr } = await supabaseAdmin
      .from('bookings')
      .select('*, rooms(room_number)')
      .eq('id', bookingId)
      .eq('user_id', req.user.id)
      .single();

    if (bErr || !booking) return res.status(404).json({ error: 'Booking not found' });

    // ⭐ Idempotent: if paid + confirmed, back again
    if (booking.payment_status === 'paid' && booking.status === 'confirmed') {
      console.log(' ✅ Already paid & confirmed — skipping');
      return res.json({
        ok: true, paid: true, alreadyPaid: true,
        bookingId: booking.id, roomId: booking.room_id, nfc: null
      });
    }

    const sessionToCheck = sessionId || booking.paymongo_session_id;
    if (!sessionToCheck) {
      return res.json({ ok: true, paid: false, message: 'No session ID' });
    }

    const verify = await verifyPaymentBySessionId(sessionToCheck);

    if (!verify.paid) {
      return res.json({
        ok: true, paid: false,
        message: 'Not yet confirmed',
        status: verify.rawStatus
      });
    }

    // 1. Confirm booking
    await confirmBooking(bookingId);

    // 2. Save payment (bulletproof — never throws on duplicate)
    await savePayment({
      bookingId,
      amount: verify.amount || booking.total_amount,
      method: verify.method || 'paymongo',
      paymentId: verify.paymentId,
      paidAt: verify.paidAt,
      payerInfo: verify.payerInfo
    });

    // 3. Check if they had active NFC token
    const { data: existingToken } = await supabaseAdmin
      .from('nfc_tokens')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('purpose', 'check_in')
      .eq('status', 'active')
      .maybeSingle();

    let rawToken = null;

    if (!existingToken) {
      await supabaseAdmin
        .from('nfc_tokens')
        .update({ status: 'invalidated', invalidated_at: new Date().toISOString() })
        .eq('booking_id', bookingId).eq('status', 'active');

      const token = makeCheckInToken();
      rawToken = token.raw;

      await supabaseAdmin.from('nfc_tokens').insert({
        booking_id: bookingId,
        room_id: booking.room_id,
        token_hash: token.hash,
        purpose: token.purpose,
        status: 'active',
        expires_at: token.expiresAt
      });
      console.log('✅ NFC token issued');
    } else {
      console.log(' ℹ️ NFC token already exists');
    }

    console.log('✅ DONE\n');

    res.json({
      ok: true, paid: true,
      bookingId: booking.id, roomId: booking.room_id,
      nfc: rawToken ? { rawToken, purpose: 'check_in' } : null
    });
  } catch (err) {
    console.error('❌ ❌ VERIFY ERROR:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// NFC verify
app.post('/api/nfc/verify', authUser, async (req, res) => {
  try {
    const { rawToken, purpose } = req.body;
    if (!rawToken) return res.status(400).json({ error: 'Missing rawToken' });

    const hash = hashToken(rawToken);
    const { data: token } = await supabaseAdmin
      .from('nfc_tokens').select('*')
      .eq('token_hash', hash)
      .eq('purpose', purpose || 'check_in')
      .eq('status', 'active')
      .single();

    if (!token) return res.status(400).json({ error: 'Invalid or expired NFC token' });

    if (new Date(token.expires_at) < new Date()) {
      await supabaseAdmin.from('nfc_tokens').update({ status: 'expired' }).eq('id', token.id);
      return res.status(400).json({ error: 'NFC token expired' });
    }

    await supabaseAdmin.from('nfc_tokens')
      .update({ status: 'used', used_at: new Date().toISOString() })
      .eq('id', token.id);

    res.json({ ok: true, bookingId: token.booking_id, roomId: token.room_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Checkout
app.post('/api/checkout', authUser, async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ error: 'Missing bookingId' });

    await supabaseAdmin.from('nfc_tokens')
      .update({ status: 'invalidated', invalidated_at: new Date().toISOString() })
      .eq('booking_id', bookingId).eq('status', 'active');

    await supabaseAdmin.from('bookings')
      .update({ status: 'checked_out' })
      .eq('id', bookingId).eq('user_id', req.user.id);

    const token = makeCheckOutToken();
    await supabaseAdmin.from('nfc_tokens').insert({
      booking_id: bookingId,
      token_hash: token.hash,
      purpose: token.purpose,
      status: 'active',
      expires_at: token.expiresAt
    });

    res.json({ ok: true, nfc: { rawToken: token.raw, purpose: 'check_out' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// STAFF — reservations
app.get('/api/staff/reservations', authUser, requireRole('staff', 'admin'), async (_req, res) => {
  try {
    const { data } = await supabaseAdmin
      .from('bookings')
      .select('*, profiles(full_name,email), rooms(room_number,room_type)')
      .order('created_at', { ascending: false });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.url });
});

// Start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('\n════════════════════════════════════════════════════════');
  console.log(`✅ SBR Backend: http://localhost:${PORT}`);
  console.log('────────────────────────────────────────────────────────');
  console.log(` Supabase : ${process.env.SUPABASE_URL ? '✅' : '❌'}`);
  console.log(` PayMongo : ${process.env.PAYMONGO_SECRET_KEY ? '✅' : '❌'}`);
  console.log(` NFC : ${process.env.NFC_SECRET ? '✅' : '⚠️'}`);
  console.log('════════════════════════════════════════════════════════\n');
});