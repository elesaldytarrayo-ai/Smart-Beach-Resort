// Imports — React hooks, routing, Supabase, NFC, encryption, and layout
import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabase.js';
import { writeNFC, readNFC } from '../../nfc.js';
import { encrypt, decrypt } from '../../encryption.js';
import UserLayout from './UserLayout.jsx';

// --- Constants ---
const API = 'http://localhost:5000';

const PENDING_KEY = 'sbr:pendingBookingId';
const SESSION_KEY = 'sbr:pendingSessionId';

const NFC_TOKEN_KEY = 'sbr:lastNfcToken';
const NFC_PURPOSE_KEY = 'sbr:nfcPurpose';

const MAX_POLL_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 2000;
const MS_PER_DAY = 86400000;

// --- Helper: today's date in YYYY-MM-DD ---
function getToday() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// --- Helper: tomorrow's date in YYYY-MM-DD ---
function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// --- Lookup Maps ---
const PAYMENT_ICONS = {
  paid: 'circle-check',
  unpaid: 'hourglass-half'
};

const BOOKING_ICONS = {
  confirmed: 'ticket',
  checked_out: 'door-open',
  cancelled: 'ban',
  pending: 'clock'
};

// ============================================================
// SUB-COMPONENTS
// ============================================================

function StatusPill({ type, value }) {
  const icon = type === 'payment'
    ? PAYMENT_ICONS[value] || 'circle'
    : BOOKING_ICONS[value] || 'clock';

  return (
    <span className={`booking-pill ${value}`}>
      <i className={icon}></i> {value}
    </span>
  );
}

function BookingCard({ booking, paying, updatingId, nfcChecking, onPay, onCheckIn, onCheckOut, onCancel, onCancelPaid }) {
  const room = booking.rooms;
  const isPaid = booking.payment_status === 'paid';
  const isUnpaid = booking.payment_status === 'unpaid';
  const isCheckedOut = booking.status === 'checked_out';
  const isCancelled = booking.status === 'cancelled';
  const isBusy = updatingId === booking.id;

  return (
    <div className="booking-panel booking-gap-bottom booking-card">
      <div className="booking-between">
        <div>
          <div className="booking-cell-main">
            <i className="bed booking-gap-right"></i>
            Room {room?.room_number}
            <span className="booking-muted booking-gap-left booking-sm">({room?.room_type})</span>
          </div>
          <div className="booking-cell-sub booking-gap-top">
            <i className="calendar booking-gap-right"></i>
            {booking.check_in} → {booking.check_out}
          </div>
          <div className="booking-cell-sub">
            <i className="peso-sign booking-gap-right"></i>
            Total: ₱{Number(booking.total_amount).toLocaleString()}
          </div>
        </div>

        <div className="booking-right">
          <StatusPill type="payment" value={booking.payment_status} />
          <div className="booking-gap-top">
            <StatusPill type="booking" value={booking.status} />
          </div>
        </div>
      </div>

      <div className="booking-actions booking-gap-top-md">
        {/* Unpaid: Pay + Cancel */}
        {isUnpaid && !isCancelled && (
          <>
            <button
              className="booking-btn booking-btn-primary booking-btn-sm"
              onClick={() => onPay(booking)}
              disabled={paying}
            >
              <i className="credit-card booking-gap-right"></i>
              {paying ? 'Redirecting…' : 'Pay via PayMongo'}
            </button>
            <button
              className="booking-btn booking-btn-danger booking-btn-sm"
              onClick={() => onCancel(booking)}
              disabled={isBusy}
            >
              <i className={`${isBusy ? 'spinner' : 'xmark'} booking-gap-right`}></i>
              Cancel Booking
            </button>
          </>
        )}

        {/* Paid, NOT checked out: NFC Check-in + Check-out + Cancel */}
        {isPaid && !isCheckedOut && !isCancelled && (
          <>
            <button
              className="booking-btn booking-btn-secondary booking-btn-sm booking-gap-right"
              onClick={() => onCheckIn(booking)}
              disabled={nfcChecking}
            >
              <i className={`${nfcChecking ? 'spinner' : 'wifi'} booking-gap-right`}></i>
              {nfcChecking ? 'Reading NFC…' : 'NFC Check-in'}
            </button>
            <button
              className="booking-btn booking-btn-primary booking-btn-sm booking-gap-right"
              onClick={() => onCheckOut(booking)}
              disabled={isBusy}
            >
              <i className={`${isBusy ? 'spinner' : 'door-open'} booking-gap-right`}></i>
              Check-out
            </button>
            <button
              className="booking-btn booking-btn-danger booking-btn-sm"
              onClick={() => onCancelPaid(booking)}
              disabled={isBusy}
            >
              <i className={`${isBusy ? 'spinner' : 'xmark'} booking-gap-right`}></i>
              Cancel Booking
            </button>
          </>
        )}

        {/* Checked out */}
        {isCheckedOut && (
          <span className="booking-muted booking-sm">
            <i className="circle-check booking-ok booking-gap-right"></i> Checked out
          </span>
        )}

        {/* Cancelled */}
        {isCancelled && (
          <span className="booking-muted booking-sm">
            <i className="ban booking-bad booking-gap-right"></i> Cancelled
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function UserBooking() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const verifyGuardRef = useRef(false);

  // --- State ---
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [form, setForm] = useState({ room_id: '', check_in: '', check_out: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [nfcBanner, setNfcBanner] = useState('');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [nfcChecking, setNfcChecking] = useState(false);

  // --- Date bounds ---
  const today = getToday();
  const tomorrow = getTomorrow();

  /* ============================================================
     FETCH DATA
     ============================================================ */

  async function fetchData() {
    setLoading(true);
    try {
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms').select('*').order('room_number');
      if (roomsError) throw roomsError;
      setRooms(roomsData || []);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { navigate('/login'); return; }

      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*, rooms(room_number, room_type, price)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (bookingsError) throw bookingsError;
      setBookings(bookingsData || []);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []); // eslint-disable-line

  // Only show rooms that are available
  const availableRooms = rooms.filter((room) => room.status === 'available');

  // ============================================================
  // PAYMONGO VERIFICATION
  // ============================================================

  async function pollPaymentVerification(bookingId, sessionId, accessToken) {
    for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
      const response = await fetch(`${API}/api/payments/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ bookingId, sessionId })
      });

      const json = await response.json();
      if (!json.ok) throw new Error(json.error || 'Verification failed');
      if (json.paid) return json;

      setNfcBanner(`Waiting for PayMongo confirmation… (${attempt}/${MAX_POLL_ATTEMPTS})`);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    throw new Error('Payment not yet confirmed. Please refresh in a moment.');
  }

  async function verifyPaymentAndIssueNFC(bookingId) {
    setError(''); setMessage('');
    setNfcBanner('Verifying your payment with PayMongo…');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired. Please log in again.');

      const sessionId = localStorage.getItem(SESSION_KEY);
      const result = await pollPaymentVerification(bookingId, sessionId, session.access_token);

      if (result.nfc?.rawToken) {
        sessionStorage.setItem(NFC_TOKEN_KEY, encrypt(result.nfc.rawToken));
        sessionStorage.setItem(NFC_PURPOSE_KEY, result.nfc.purpose || 'check_in');
        await writeNFC(result.nfc.rawToken);
      }

      localStorage.removeItem(PENDING_KEY);
      localStorage.removeItem(SESSION_KEY);

      setNfcBanner('Payment confirmed! Tap your NFC authentication to the room.');
      setMessage('Booking PAID + CONFIRMED. NFC token issued.');
      await fetchData();
    } catch (err) {
      setNfcBanner('');
      setError(err.message);
      await fetchData();
    }
  }

  useEffect(() => {
    const status = searchParams.get('status');

    if (status === 'success' && !verifyGuardRef.current) {
      verifyGuardRef.current = true;
      const bookingId = localStorage.getItem(PENDING_KEY);
      setSearchParams({}, { replace: true });

      if (bookingId) verifyPaymentAndIssueNFC(bookingId);
      else { setMessage('Payment received.'); fetchData(); }

    } else if (status === 'cancelled') {
      localStorage.removeItem(PENDING_KEY);
      localStorage.removeItem(SESSION_KEY);
      setSearchParams({}, { replace: true });
      setError('Payment was cancelled.');
    }
  }, []); // eslint-disable-line

  // ============================================================
  // ACTIONS
  // ============================================================

  async function handleCreateBooking(e) {
    e.preventDefault();
    setError(''); setMessage('');

    if (!form.room_id) return setError('Please select a room.');
    if (!form.check_in || !form.check_out) return setError('Please select both dates.');

    // Prevent past dates
    if (form.check_in < today) {
      return setError('Check-in date cannot be in the past.');
    }
    if (form.check_out <= form.check_in) {
      return setError('Check-out date must be after the check-in date.');
    }
    if (form.check_out < tomorrow) {
      return setError('Check-out date must be at least tomorrow.');
    }

    const room = rooms.find((r) => r.id === form.room_id);
    if (!room) return setError('Room not found.');

    if (room.status !== 'available') {
      return setError('This room is no longer available. Please pick another.');
    }

    const nights = Math.max(1, Math.round(
      (new Date(form.check_out) - new Date(form.check_in)) / MS_PER_DAY
    ));
    const total = nights * Number(room.price);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: insertError } = await supabase.from('bookings').insert({
        user_id: user.id,
        room_id: room.id,
        check_in: form.check_in,
        check_out: form.check_out,
        total_amount: total,
        status: 'pending',
        payment_status: 'unpaid'
      });
      if (insertError) throw insertError;

      setMessage(`Booking created — ${nights} night(s), total ₱${total.toLocaleString()}`);
      setForm({ room_id: '', check_in: '', check_out: '' });
      await fetchData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handlePayWithPayMongo(booking) {
    setError(''); setMessage(''); setNfcBanner('');
    setPaying(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired. Please log in again.');

      localStorage.setItem(PENDING_KEY, booking.id);

      const response = await fetch(`${API}/api/payments/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          bookingId: booking.id,
          description: `Room ${booking.rooms?.room_number}`
        })
      });

      const json = await response.json();
      if (!json.ok) {
        localStorage.removeItem(PENDING_KEY);
        throw new Error(json.error || 'Checkout failed');
      }

      if (json.sessionId) localStorage.setItem(SESSION_KEY, json.sessionId);
      window.location.href = json.checkoutUrl;
    } catch (err) {
      setError(err.message);
      setPaying(false);
    }
  }

  async function handleCancelBooking(booking) {
    const confirmed = window.confirm(
      `Cancel this booking?\n\n` +
      `Room ${booking.rooms?.room_number} — ${booking.check_in} → ${booking.check_out}\n` +
      `Total: ₱${Number(booking.total_amount).toLocaleString()}\n\n` +
      `⚠️ This will PERMANENTLY DELETE the booking. This action cannot be undone.`
    );
    if (!confirmed) return;

    setError(''); setMessage('');
    setUpdatingId(booking.id);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Session expired. Please log in again.');

      const { error: deleteError, count } = await supabase
        .from('bookings')
        .delete({ count: 'exact' })
        .eq('id', booking.id)
        .eq('user_id', user.id)
        .eq('payment_status', 'unpaid');

      if (deleteError) throw deleteError;
      if (count === 0) throw new Error('Booking could not be deleted — it may have been paid.');

      setMessage('✅ Booking cancelled and permanently deleted.');
      await fetchData();
    } catch (err) {
      console.error('Cancel error:', err);
      setError(err.message || 'Failed to cancel booking.');
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleCancelPaidBooking(booking) {
    const confirmed = window.confirm(
      `Cancel this PAID booking?\n\n` +
      `Room ${booking.rooms?.room_number} — ${booking.check_in} → ${booking.check_out}\n` +
      `Total: ₱${Number(booking.total_amount).toLocaleString()}\n\n` +
      `The payment record will be kept for accounting. Active NFC tokens will be invalidated.`
    );
    if (!confirmed) return;

    setError(''); setMessage('');
    setUpdatingId(booking.id);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired. Please log in again.');

      const response = await fetch(`${API}/api/bookings/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ bookingId: booking.id })
      });

      const json = await response.json();
      if (!json.ok) throw new Error(json.error || 'Cancel failed');

      setMessage('✅ Booking cancelled. NFC invalidated. Payment record kept.');
      await fetchData();
    } catch (err) {
      console.error('Cancel paid error:', err);
      setError(err.message || 'Failed to cancel paid booking.');
    } finally {
      setUpdatingId(null);
    }
  }

  // handleNfcCheckIn — reads NFC, verifies with backend
  async function handleNfcCheckIn(booking) {
    setError(''); setMessage(''); setNfcBanner('');
    setNfcChecking(true);
    setNfcBanner('Waiting for NFC tap… Tap your NFC authentication to the room.');

    try {
      console.log('[NFC] Reading tag...');
      const nfcResult = await readNFC();
      console.log('[NFC] Read result:', nfcResult);

      if (!nfcResult.ok) {
        throw new Error(nfcResult.error || 'Failed to read NFC tag.');
      }

      let rawToken = nfcResult.text;

      if (nfcResult.simulated && rawToken) {
        console.log('[NFC] Simulated mode — decrypting token...');
        rawToken = decrypt(rawToken);
      }

      if (!rawToken) {
        throw new Error('No NFC token found. Please complete payment first.');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired. Please log in again.');

      console.log('[NFC] Sending to backend for verification...');
      const response = await fetch(`${API}/api/nfc/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ rawToken, purpose: 'check_in' })
      });

      const json = await response.json();
      console.log('[NFC] Backend response:', json);

      if (!json.ok) throw new Error(json.error || 'Check-in failed.');

      setNfcBanner('');
      setMessage('✅ Check-in successful via NFC. Welcome!');
      await fetchData();
    } catch (err) {
      console.error('[NFC] Check-in error:', err);
      setNfcBanner('');
      setError(err.message || 'Check-in failed.');
    } finally {
      setNfcChecking(false);
    }
  }

  async function handleCheckOut(booking) {
    setError(''); setMessage(''); setNfcBanner('');
    setUpdatingId(booking.id);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${API}/api/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ bookingId: booking.id })
      });

      const json = await response.json();
      if (!json.ok) throw new Error(json.error);

      sessionStorage.setItem(NFC_TOKEN_KEY, encrypt(json.nfc.rawToken));
      setNfcBanner('Checkout ready — old NFC invalidated.');
      await writeNFC(json.nfc.rawToken);
      setMessage('Old NFC invalidated. New checkout code written.');
      await fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <UserLayout>
      <div className="booking-welcome">
        <h1>My Bookings</h1>
        <p>Book a room, pay online, and check in using NFC.</p>
      </div>

      {nfcBanner && (
        <div className="booking-banner booking-gap-bottom" aria-live="polite">
          <i className="wifi booking-gap-right"></i>
          {nfcBanner}
        </div>
      )}

      {error && (
        <p className="booking-error booking-gap-bottom" aria-live="polite">{error}</p>
      )}
      {message && (
        <p className="booking-success booking-gap-bottom" aria-live="polite">{message}</p>
      )}

      {/* Booking Form — only shows AVAILABLE rooms */}
      <div className="booking-panel booking-gap-bottom">
        <div className="booking-panel-header">
          <h3 className="booking-panel-title">
            <i className="plus"></i> Make a New Booking
          </h3>
        </div>

        {availableRooms.length === 0 && !loading && (
          <div className="booking-empty">
            <i className="bed"></i>
            <div className="booking-empty-title">No rooms available</div>
            <div className="booking-empty-desc">All rooms are occupied. Try again later.</div>
          </div>
        )}

        {availableRooms.length > 0 && (
          <form onSubmit={handleCreateBooking}>
            <div className="booking-form-grid">
              <div className="booking-field">
                <label htmlFor="bk-room"><i className="bed"></i> Room</label>
                <select
                  id="bk-room"
                  className="booking-select"
                  value={form.room_id}
                  onChange={(e) => setForm({ ...form, room_id: e.target.value })}
                  required
                >
                  <option value="">Select room…</option>
                  {availableRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      Room {room.room_number} — {room.room_type} — ₱{room.price}/night
                    </option>
                  ))}
                </select>
              </div>

              <div className="booking-field">
                <label htmlFor="bk-in"><i className="calendar-plus"></i> Check-in</label>
                <input
                  id="bk-in"
                  className="booking-input"
                  type="date"
                  min={today}
                  value={form.check_in}
                  onChange={(e) => setForm({ ...form, check_in: e.target.value })}
                  required
                />
              </div>

              <div className="booking-field">
                <label htmlFor="bk-out"><i className="calendar-minus"></i> Check-out</label>
                <input
                  id="bk-out"
                  className="booking-input"
                  type="date"
                  min={form.check_in || tomorrow}
                  value={form.check_out}
                  onChange={(e) => setForm({ ...form, check_out: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="booking-form-actions">
              <button type="submit" className="booking-btn booking-btn-primary">
                <i className="calendar-check booking-gap-right"></i> Create Booking
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Reservations */}
      <div className="booking-panel">
        <div className="booking-panel-header">
          <h3 className="booking-panel-title">
            <i className="ticket"></i> My Reservations ({bookings.length})
          </h3>
        </div>

        {loading && (
          <div className="booking-loading">
            <i className="spinner booking-gap-right"></i> Loading…
          </div>
        )}

        {!loading && bookings.length === 0 && (
          <div className="booking-empty">
            <i className="calendar-xmark"></i>
            <div className="booking-empty-title">No bookings yet</div>
            <div className="booking-empty-desc">Use the form above to create your first booking.</div>
          </div>
        )}

        {!loading && bookings.map((booking) => (
          <BookingCard
            key={booking.id}
            booking={booking}
            paying={paying}
            updatingId={updatingId}
            nfcChecking={nfcChecking}
            onPay={handlePayWithPayMongo}
            onCheckIn={handleNfcCheckIn}
            onCheckOut={handleCheckOut}
            onCancel={handleCancelBooking}
            onCancelPaid={handleCancelPaidBooking}
          />
        ))}
      </div>
    </UserLayout>
  );
}