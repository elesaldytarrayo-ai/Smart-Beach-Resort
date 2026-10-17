// backend/server.js
// Express server for Smart Beach Resort.
// Handles PayMongo payments, NFC tokens, staff/admin actions, and bookings.

import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import CryptoJS from 'crypto-js';
import { supabaseAdmin } from './supabaseAdmin.js';
import { createCheckoutSession, verifyPaymentBySessionId } from './payments.js';
import { makeCheckInToken, makeCheckOutToken, hashToken } from './nfc.js';

const app = express();

// Allow requests from the frontend.
app.use(cors({
  origin: [
    'http://localhost:5173',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));

// ============================================================
// ENCRYPTION HELPERS (same key as frontend)
// ============================================================
const ENCRYPTION_KEY =
  process.env.VITE_ENCRYPTION_KEY ||
  'default-key-change-me-32-chars!!';

function encrypt(text) {
  if (text === null || text === undefined || text === '') return null;
  return CryptoJS.AES.encrypt(String(text), ENCRYPTION_KEY).toString();
}

function decrypt(cipher) {
  if (!cipher) return '';
  if (typeof cipher !== 'string') return String(cipher);
  if (!cipher.startsWith('U2FsdGVkX1')) return cipher;
  const bytes = CryptoJS.AES.decrypt(cipher, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

// Convert a value (Unix seconds, Unix ms, or string) into an ISO date string.
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

// Update a room's status in the database.
async function setRoomStatus(roomId, status) {
  if (!roomId) return;

  await supabaseAdmin
    .from('rooms')
    .update({ status })
    .eq('id', roomId);

  console.log(`🛏️ Room ${roomId.slice(0, 8)}… → ${status}`);
}

// ============================================================
// Save a payment record (ENCRYPTED).
// Upserts by booking_id.
// ============================================================
async function savePayment({ bookingId, amount, method, paymentId, paidAt, payerInfo }) {
  const paidAtISO = toISODate(paidAt);

  console.log('💾 Upserting payment for booking:', bookingId);

  const encryptedRef = encrypt(paymentId);
  const encryptedPaymongoId = encrypt(paymentId);

  const result = await supabaseAdmin
    .from('payments')
    .upsert(
      {
        booking_id: bookingId,
        amount: Number(amount) || 0,
        method: method || 'paymongo',
        status: 'paid',
        reference_number_encrypted: encryptedRef,
        paymongo_id_encrypted: encryptedPaymongoId,
        payer_info: payerInfo || null,
        currency: 'PHP',
        paid_at: paidAtISO
      },
      { onConflict: 'booking_id' }
    );

  if (result.error) {
    const isDuplicate =
      result.error.code === '23505' ||
      String(result.error.message).includes('duplicate');

    if (isDuplicate) {
      console.log('ℹ️ Payment already exists — OK');
      return;
    }

    console.error('❌ savePayment error:', result.error);
    throw new Error('Failed to save payment: ' + result.error.message);
  }

  console.log('✅ Payment saved (encrypted)');
}

// Mark a booking as paid + confirmed, and mark the room as occupied.
async function confirmBooking(bookingId) {
  const bookingResult = await supabaseAdmin
    .from('bookings')
    .select('room_id')
    .eq('id', bookingId)
    .single();

  const roomId = bookingResult.data?.room_id;

  const result = await supabaseAdmin
    .from('bookings')
    .update({ payment_status: 'paid', status: 'confirmed' })
    .eq('id', bookingId);

  if (result.error) throw new Error('Booking confirm failed: ' + result.error.message);

  await setRoomStatus(roomId, 'occupied');

  console.log('🟢 Booking confirmed:', bookingId);
}

// ============================================================
// ✅ HELPER: Save NFC token with encrypted values
// ============================================================
async function saveNfcToken({
  bookingId,
  roomId,
  token,
  purpose,
  status = 'active'
}) {
  const uid = token.uid || `NFC-${String(bookingId).slice(0, 8)}`;

  const result = await supabaseAdmin.from('nfc_tokens').insert({
    booking_id: bookingId,
    room_id: roomId || null,
    token_hash: token.hash,
    nfc_uid_encrypted: encrypt(uid),
    nfc_token_encrypted: encrypt(token.raw),
    purpose: purpose || token.purpose,
    status,
    expires_at: token.expiresAt
  });

  if (result.error) {
    console.error('❌ saveNfcToken error:', result.error);
    throw new Error('Failed to save NFC token: ' + result.error.message);
  }

  console.log('✅ NFC token saved (encrypted)');
}

// ============================================================
// PayMongo Webhook
// ============================================================
app.post(
  '/webhooks/paymongo',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const event = JSON.parse(req.body.toString('utf8'));
      const eventType = event?.data?.attributes?.type;
      console.log('📩 [Webhook]', eventType);

      const isPaidEvent =
        eventType === 'checkout_session.payment.paid' ||
        eventType === 'payment.paid';

      if (isPaidEvent) {
        const attrs = event.data.attributes;
        const bookingId =
          attrs?.data?.attributes?.reference_number ||
          attrs?.reference_number;

        if (bookingId) {
          await confirmBooking(bookingId);

          const amount = (attrs?.data?.attributes?.amount || 0) / 100;
          const paymentId = attrs?.data?.id || attrs?.id;
          const paidAt = attrs?.data?.attributes?.paid_at;

          await savePayment({ bookingId, amount, method: 'paymongo', paymentId, paidAt });

          // Issue a check-in NFC token if the booking has a room.
          const bookingResult = await supabaseAdmin
            .from('bookings')
            .select('room_id')
            .eq('id', bookingId)
            .single();

          const roomId = bookingResult.data?.room_id;
          if (roomId) {
            const token = makeCheckInToken();
            await saveNfcToken({
              bookingId,
              roomId,
              token,
              purpose: 'check_in',
              status: 'active'
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

// Parse JSON for all other routes.
app.use(express.json());

// ============================================================
// Auth middleware
// ============================================================
async function authUser(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Missing token' });

    const userResult = await supabaseAdmin.auth.getUser(token);
    if (userResult.error || !userResult.data.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const profileResult = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userResult.data.user.id)
      .single();

    req.user = {
      ...userResult.data.user,
      role: profileResult.data?.role || 'user'
    };

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

// ============================================================
// Routes
// ============================================================
app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'SBR backend',
    config: {
      supabase: !!process.env.SUPABASE_URL,
      paymongo: !!process.env.PAYMONGO_SECRET_KEY,
      nfc: !!process.env.NFC_SECRET,
      encryption: !!process.env.VITE_ENCRYPTION_KEY
    }
  });
});

// ADMIN — create a staff account.
app.post('/api/admin/create-staff', authUser, requireRole('admin'), async (req, res) => {
  try {
    const { email, password, full_name, phone } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

    const created = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    });

    if (created.error) return res.status(400).json({ error: created.error.message });

    // ✅ I-encrypt ang phone bago i-save sa profiles
    const encryptedPhone = phone ? encrypt(phone) : null;

    const profileResult = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: created.data.user.id,
          email,
          full_name,
          phone_encrypted: encryptedPhone,   // ✅ ENCRYPTED
          role: 'staff'
        },
        { onConflict: 'id' }
      );

    if (profileResult.error) return res.status(400).json({ error: profileResult.error.message });

    console.log('✅ Staff created:', email);
    res.json({ ok: true, user: created.data.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a PayMongo checkout session for a booking.
app.post('/api/payments/checkout', authUser, async (req, res) => {
  try {
    const { bookingId, description } = req.body;
    if (!bookingId) return res.status(400).json({ error: 'Missing bookingId' });

    const bookingResult = await supabaseAdmin
      .from('bookings')
      .select('*, rooms(room_number, status)')
      .eq('id', bookingId)
      .eq('user_id', req.user.id)
      .single();

    const booking = bookingResult.data;
    if (bookingResult.error || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.payment_status === 'paid') {
      return res.json({ ok: true, alreadyPaid: true });
    }

    if (booking.rooms?.status === 'occupied') {
      return res.status(400).json({ error: 'Room is already occupied' });
    }

    const { checkoutUrl, sessionId } = await createCheckoutSession({
      bookingId,
      amount: booking.total_amount,
      description: description || `Room ${booking.rooms?.room_number}`
    });

    // ✅ ENCRYPT ang paymongo_session_id bago i-save
    await supabaseAdmin
      .from('bookings')
      .update({ paymongo_session_id_encrypted: encrypt(sessionId) })
      .eq('id', bookingId);

    res.json({ ok: true, checkoutUrl, sessionId });
  } catch (err) {
    console.error('❌ CHECKOUT ERROR:', err);
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Verify a payment.
app.post('/api/payments/verify', authUser, async (req, res) => {
  try {
    const { bookingId, sessionId } = req.body;
    console.log('\n🟡 [Verify] bookingId:', bookingId, '| sessionId:', sessionId);

    if (!bookingId) return res.status(400).json({ error: 'Missing bookingId' });

    const bookingResult = await supabaseAdmin
      .from('bookings')
      .select('*, rooms(room_number)')
      .eq('id', bookingId)
      .eq('user_id', req.user.id)
      .single();

    const booking = bookingResult.data;
    if (bookingResult.error || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.payment_status === 'paid' && booking.status === 'confirmed') {
      console.log(' ✅ Already paid & confirmed — skipping');
      return res.json({
        ok: true, paid: true, alreadyPaid: true,
        bookingId: booking.id, roomId: booking.room_id, nfc: null
      });
    }

    const storedSessionId = booking.paymongo_session_id_encrypted
      ? decrypt(booking.paymongo_session_id_encrypted)
      : null;

    const sessionToCheck = sessionId || storedSessionId;
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

    await confirmBooking(bookingId);

    await savePayment({
      bookingId,
      amount: verify.amount || booking.total_amount,
      method: verify.method || 'paymongo',
      paymentId: verify.paymentId,
      paidAt: verify.paidAt,
      payerInfo: verify.payerInfo
    });

    const existingResult = await supabaseAdmin
      .from('nfc_tokens')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('purpose', 'check_in')
      .eq('status', 'active')
      .maybeSingle();

    let rawToken = null;

    if (!existingResult.data) {
      await supabaseAdmin
        .from('nfc_tokens')
        .update({ status: 'invalidated', invalidated_at: new Date().toISOString() })
        .eq('booking_id', bookingId)
        .eq('status', 'active');

      const token = makeCheckInToken();
      rawToken = token.raw;

      await saveNfcToken({
        bookingId,
        roomId: booking.room_id,
        token,
        purpose: 'check_in',
        status: 'active'
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

// Verify an NFC token.
app.post('/api/nfc/verify', authUser, async (req, res) => {
  try {
    const { rawToken, purpose } = req.body;
    if (!rawToken) return res.status(400).json({ error: 'Missing rawToken' });

    const hash = hashToken(rawToken);

    const tokenResult = await supabaseAdmin
      .from('nfc_tokens')
      .select('*')
      .eq('token_hash', hash)
      .eq('purpose', purpose || 'check_in')
      .eq('status', 'active')
      .single();

    const token = tokenResult.data;
    if (!token) return res.status(400).json({ error: 'Invalid or expired NFC token' });

    if (new Date(token.expires_at) < new Date()) {
      await supabaseAdmin
        .from('nfc_tokens')
        .update({ status: 'expired' })
        .eq('id', token.id);
      return res.status(400).json({ error: 'NFC token expired' });
    }

    await supabaseAdmin
      .from('nfc_tokens')
      .update({ status: 'used', used_at: new Date().toISOString() })
      .eq('id', token.id);

    res.json({ ok: true, bookingId: token.booking_id, roomId: token.room_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check out a booking.
app.post('/api/checkout', authUser, async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ error: 'Missing bookingId' });

    const bookingResult = await supabaseAdmin
      .from('bookings')
      .select('room_id')
      .eq('id', bookingId)
      .eq('user_id', req.user.id)
      .single();

    const roomId = bookingResult.data?.room_id;

    await supabaseAdmin
      .from('nfc_tokens')
      .update({ status: 'invalidated', invalidated_at: new Date().toISOString() })
      .eq('booking_id', bookingId)
      .eq('status', 'active');

    await supabaseAdmin
      .from('bookings')
      .update({ status: 'checked_out' })
      .eq('id', bookingId)
      .eq('user_id', req.user.id);

    await setRoomStatus(roomId, 'available');

    const token = makeCheckOutToken();

    await saveNfcToken({
      bookingId,
      roomId,
      token,
      purpose: 'check_out',
      status: 'active'
    });

    res.json({ ok: true, nfc: { rawToken: token.raw, purpose: 'check_out' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel a paid booking.
app.post('/api/bookings/cancel', authUser, async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ error: 'Missing bookingId' });

    const bookingResult = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .eq('user_id', req.user.id)
      .single();

    const booking = bookingResult.data;
    if (bookingResult.error || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status === 'checked_out') {
      return res.status(400).json({ error: 'Cannot cancel a checked-out booking' });
    }

    if (booking.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Unpaid bookings must be deleted, not cancelled.' });
    }

    await supabaseAdmin
      .from('nfc_tokens')
      .update({ status: 'invalidated', invalidated_at: new Date().toISOString() })
      .eq('booking_id', bookingId)
      .eq('status', 'active');

    await supabaseAdmin
      .from('bookings')
      .update({ status: 'cancelled', payment_status: 'cancelled' })
      .eq('id', bookingId);

    await setRoomStatus(booking.room_id, 'available');

    res.json({ ok: true, message: 'Booking cancelled' });
  } catch (err) {
    console.error('cancel booking error:', err);
    res.status(500).json({ error: err.message });
  }
});

// STAFF — list all reservations.
app.get('/api/staff/reservations', authUser, requireRole('staff', 'admin'), async (_req, res) => {
  try {
    const result = await supabaseAdmin
      .from('bookings')
      .select('*, profiles(full_name,email), rooms(room_number,room_type)')
      .order('created_at', { ascending: false });
    res.json(result.data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// NOTIFICATIONS
// ============================================================
app.get('/api/notifications', authUser, async (req, res) => {
  try {
    const role = req.user.role;
    const userId = req.user.id;

    let query = supabaseAdmin
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (role === 'admin') {
      query = query.or(`user_id.eq.${userId},role_target.eq.admin,role_target.eq.staff,role_target.eq.user`);
    } else if (role === 'staff') {
      query = query.or(`user_id.eq.${userId},role_target.eq.staff,role_target.eq.user`);
    } else {
      query = query.or(`user_id.eq.${userId},role_target.eq.user`);
    }

    const result = await query;
    if (result.error) throw result.error;

    res.json(result.data || []);
  } catch (err) {
    console.error('❌ notifications fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications/read-all', authUser, async (req, res) => {
  try {
    const role = req.user.role;
    const userId = req.user.id;

    let query = supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false);

    if (role === 'admin') {
      query = query.or(`user_id.eq.${userId},role_target.eq.admin,role_target.eq.staff,role_target.eq.user`);
    } else if (role === 'staff') {
      query = query.or(`user_id.eq.${userId},role_target.eq.staff,role_target.eq.user`);
    } else {
      query = query.or(`user_id.eq.${userId},role_target.eq.user`);
    }

    const result = await query;
    if (result.error) throw result.error;

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications/:id/read', authUser, async (req, res) => {
  try {
    const result = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', req.params.id);

    if (result.error) throw result.error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 404 fallback.
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.url });
});

// ============================================================
// Start server
// ============================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('\n════════════════════════════════════════════════════════');
  console.log(`✅ SBR Backend: http://localhost:${PORT}`);
  console.log('────────────────────────────────────────────────────────');
  console.log(` Supabase   : ${process.env.SUPABASE_URL ? '✅' : '❌'}`);
  console.log(` PayMongo   : ${process.env.PAYMONGO_SECRET_KEY ? '✅' : '❌'}`);
  console.log(` NFC        : ${process.env.NFC_SECRET ? '✅' : '⚠️'}`);
  console.log(` Encryption : ${process.env.VITE_ENCRYPTION_KEY ? '✅' : '⚠️'}`);
  console.log('════════════════════════════════════════════════════════\n');
});