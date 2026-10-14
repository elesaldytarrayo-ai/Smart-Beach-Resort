// backend/server.js
// Express server for Smart Beach Resort.
// Handles PayMongo payments, NFC tokens, staff/admin actions, and bookings.

import express from 'express';
import cors from 'cors';
import 'dotenv/config';
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

// Save a payment record. Upserts by booking_id.
async function savePayment({ bookingId, amount, method, paymentId, paidAt, payerInfo }) {
  const paidAtISO = toISODate(paidAt);

  console.log('💾 Upserting payment for booking:', bookingId);

  const result = await supabaseAdmin
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

  // Duplicate is fine — payment already exists.
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

  console.log('✅ Payment saved');
}

// Mark a booking as paid + confirmed, and mark the room as occupied.
async function confirmBooking(bookingId) {
  // Get the room ID first.
  const bookingResult = await supabaseAdmin
    .from('bookings')
    .select('room_id')
    .eq('id', bookingId)
    .single();

  const roomId = bookingResult.data?.room_id;

  // Update the booking.
  const result = await supabaseAdmin
    .from('bookings')
    .update({ payment_status: 'paid', status: 'confirmed' })
    .eq('id', bookingId);

  if (result.error) throw new Error('Booking confirm failed: ' + result.error.message);

  // Mark the room as occupied.
  await setRoomStatus(roomId, 'occupied');

  console.log('🟢 Booking confirmed:', bookingId);
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
            await supabaseAdmin.from('nfc_tokens').insert({
              booking_id: bookingId,
              room_id: roomId,
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

// Parse JSON for all other routes.
app.use(express.json());

// ============================================================
// Auth middleware
// ============================================================

// Check the user's token and attach role to req.user.
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

// Only allow certain roles.
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

// Health check.
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

    const profileResult = await supabaseAdmin
      .from('profiles')
      .upsert(
        { id: created.data.user.id, email, full_name, phone, role: 'staff' },
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
// Rejects if the room is already occupied.
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

    // Reject if the room is already occupied by someone else.
    if (booking.rooms?.status === 'occupied') {
      return res.status(400).json({ error: 'Room is already occupied' });
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

// Verify a payment. Confirms the booking and issues an NFC token.
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

    // Already paid + confirmed → return early.
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

    // 1. Confirm booking (this also marks the room as occupied).
    await confirmBooking(bookingId);

    // 2. Save payment.
    await savePayment({
      bookingId,
      amount: verify.amount || booking.total_amount,
      method: verify.method || 'paymongo',
      paymentId: verify.paymentId,
      paidAt: verify.paidAt,
      payerInfo: verify.payerInfo
    });

    // 3. Issue an NFC check-in token if none exists yet.
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

// Verify an NFC token (check-in or check-out).
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

    // Expired?
    if (new Date(token.expires_at) < new Date()) {
      await supabaseAdmin
        .from('nfc_tokens')
        .update({ status: 'expired' })
        .eq('id', token.id);
      return res.status(400).json({ error: 'NFC token expired' });
    }

    // Mark as used.
    await supabaseAdmin
      .from('nfc_tokens')
      .update({ status: 'used', used_at: new Date().toISOString() })
      .eq('id', token.id);

    res.json({ ok: true, bookingId: token.booking_id, roomId: token.room_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check out a booking and issue a check-out token.
// Also frees up the room so others can book it again.
app.post('/api/checkout', authUser, async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ error: 'Missing bookingId' });

    // Get the booking first (to know the room).
    const bookingResult = await supabaseAdmin
      .from('bookings')
      .select('room_id')
      .eq('id', bookingId)
      .eq('user_id', req.user.id)
      .single();

    const roomId = bookingResult.data?.room_id;

    // Invalidate any active tokens for this booking.
    await supabaseAdmin
      .from('nfc_tokens')
      .update({ status: 'invalidated', invalidated_at: new Date().toISOString() })
      .eq('booking_id', bookingId)
      .eq('status', 'active');

    // Mark booking as checked out.
    await supabaseAdmin
      .from('bookings')
      .update({ status: 'checked_out' })
      .eq('id', bookingId)
      .eq('user_id', req.user.id);

    // Free up the room — back to available.
    await setRoomStatus(roomId, 'available');

    // Issue a check-out token.
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

// Cancel a paid booking (soft cancel).
// Also frees up the room.
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

    // Invalidate active NFC tokens.
    await supabaseAdmin
      .from('nfc_tokens')
      .update({ status: 'invalidated', invalidated_at: new Date().toISOString() })
      .eq('booking_id', bookingId)
      .eq('status', 'active');

    // Soft cancel.
    await supabaseAdmin
      .from('bookings')
      .update({ status: 'cancelled', payment_status: 'cancelled' })
      .eq('id', bookingId);

    // Free up the room — back to available.
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
  console.log(` Supabase : ${process.env.SUPABASE_URL ? '✅' : '❌'}`);
  console.log(` PayMongo : ${process.env.PAYMONGO_SECRET_KEY ? '✅' : '❌'}`);
  console.log(` NFC      : ${process.env.NFC_SECRET ? '✅' : '⚠️'}`);
  console.log('════════════════════════════════════════════════════════\n');
});