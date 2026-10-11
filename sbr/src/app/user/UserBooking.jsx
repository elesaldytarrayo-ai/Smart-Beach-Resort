import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabase.js';
import { writeNFC } from '../../nfc.js';
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

// --- Lookup Maps ---
const PAYMENT_ICONS = {
  paid: 'fa-circle-check',
  unpaid: 'fa-hourglass-half'
};

const BOOKING_ICONS = {
  confirmed: 'fa-ticket',
  checked_out: 'fa-door-open',
  cancelled: 'fa-ban',
  pending: 'fa-clock'
};

// SUB-COMPONENTS

/** Colored pill for payment/booking status. */
function StatusPill({ type, value }) {
  const icon = type === 'payment'
    ? PAYMENT_ICONS[value] || 'fa-circle'
    : BOOKING_ICONS[value] || 'fa-clock';

  return (
    <span className={`admin-pill ${value}`}>
      <i className={`fa-solid ${icon}`}></i> {value}
    </span>
  );
}

/** Single booking card with action buttons. */
function BookingCard({ booking, paying, updatingId, onPay, onCheckIn, onCheckOut, onCancel, onCancelPaid }) {
  const room = booking.rooms;
  const isPaid = booking.payment_status === 'paid';
  const isUnpaid = booking.payment_status === 'unpaid';
  const isCheckedOut = booking.status === 'checked_out';
  const isCancelled = booking.status === 'cancelled';
  const isBusy = updatingId === booking.id;

  return (
    <div className="admin-panel mb-4 booking-card">
      <div className="space-between">
        {/* Details */}
        <div>
          <div className="cell-main">
            <i className="fa-solid fa-bed mr-2"></i>
            Room {room?.room_number}
            <span className="muted ml-2 text-sm">({room?.room_type})</span>
          </div>
          <div className="cell-sub mt-2">
            <i className="fa-solid fa-calendar mr-2"></i>
            {booking.check_in} → {booking.check_out}
          </div>
          <div className="cell-sub">
            <i className="fa-solid fa-peso-sign mr-2"></i>
            Total: ₱{Number(booking.total_amount).toLocaleString()}
          </div>
        </div>

        {/* Status */}
        <div className="text-right">
          <StatusPill type="payment" value={booking.payment_status} />
          <div className="mt-2">
            <StatusPill type="booking" value={booking.status} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="row-actions mt-3">
        {isUnpaid && !isCancelled && (
          <>
            <button
              className="app-btn app-btn-primary app-btn-sm"
              onClick={() => onPay(booking)}
              disabled={paying}
            >
              <i className="fa-solid fa-credit-card mr-2"></i>
              {paying ? 'Redirecting…' : 'Pay via PayMongo'}
            </button>
            <button
              className="app-btn app-btn-danger app-btn-sm"
              onClick={() => onCancel(booking)}
              disabled={isBusy}
            >
              <i className={`fa-solid ${isBusy ? 'fa-spinner fa-spin' : 'fa-xmark'} mr-2`}></i>
              Cancel Booking
            </button>
          </>
        )}

        {isPaid && !isCheckedOut && !isCancelled && (
          <>
            <button className="app-btn app-btn-secondary app-btn-sm mr-2" onClick={onCheckIn}>
              <i className="fa-solid fa-wifi mr-2"></i> NFC Check-in
            </button>
            <button
              className="app-btn app-btn-primary app-btn-sm mr-2"
              onClick={() => onCheckOut(booking)}
              disabled={isBusy}
            >
              <i className={`fa-solid ${isBusy ? 'fa-spinner fa-spin' : 'fa-door-open'} mr-2`}></i>
              Check-out
            </button>
            <button
              className="app-btn app-btn-danger app-btn-sm"
              onClick={() => onCancelPaid(booking)}
              disabled={isBusy}
            >
              <i className={`fa-solid ${isBusy ? 'fa-spinner fa-spin' : 'fa-xmark'} mr-2`}></i>
              Cancel Booking
            </button>
          </>
        )}

        {isCheckedOut && (
          <span className="muted text-sm">
            <i className="fa-solid fa-circle-check text-success mr-2"></i> Checked out
          </span>
        )}

        {isCancelled && (
          <span className="muted text-sm">
            <i className="fa-solid fa-ban text-danger mr-2"></i> Cancelled
          </span>
        )}
      </div>
    </div>
  );
}

// MAIN COMPONENT

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

  /* ============================================================
     FETCH DATA
     ============================================================ */
  async function fetchData() {
    setLoading(true);
    setError('');
    try {
      // 1. Rooms
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms').select('*').order('room_number');
      if (roomsError) throw roomsError;
      setRooms(roomsData || []);

      // 2. Auth
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { navigate('/login'); return; }

      // 3. User's bookings
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

  // PAYMONGO VERIFICATION
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

      setNfcBanner('Payment confirmed! Tap your phone to the room NFC reader.');
      setMessage('Booking PAID + CONFIRMED. NFC token issued.');
      await fetchData();
    } catch (err) {
      setNfcBanner('');
      setError(err.message);
      await fetchData();
    }
  }

  /* Handle PayMongo redirect */
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

  // ACTIONS
  async function handleCreateBooking(e) {
    e.preventDefault();
    setError(''); setMessage('');

    if (!form.room_id) return setError('Please select a room.');
    if (!form.check_in || !form.check_out) return setError('Please select both dates.');

    const room = rooms.find((r) => r.id === form.room_id);
    if (!room) return setError('Room not found.');

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

  /** Unpaid → hard delete. */
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

  /** Paid → soft cancel via backend. */
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

  async function handleNfcCheckIn() {
    setError(''); setMessage('');
    try {
      const encryptedToken = sessionStorage.getItem(NFC_TOKEN_KEY);
      if (!encryptedToken) throw new Error('No NFC token found. Please complete payment first.');

      const rawToken = decrypt(encryptedToken);
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`${API}/api/nfc/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ rawToken, purpose: 'check_in' })
      });

      const json = await response.json();
      if (!json.ok) throw new Error(json.error);
      setMessage('Check-in successful via NFC.');
    } catch (err) {
      setError(err.message);
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

  // RENDER
  return (
    <UserLayout>
      <div className="admin-welcome">
        <h1>My Bookings</h1>
        <p>Book a room, pay online, and check in using NFC.</p>
      </div>

      {nfcBanner && (
        <div className="nfc-banner mb-4" aria-live="polite">
          <i className="fa-solid fa-wifi mr-2"></i>
          {nfcBanner}
        </div>
      )}

      {/* Booking Form */}
      <div className="admin-panel mb-4">
        <div className="admin-panel-header">
          <h3 className="admin-panel-title">
            <i className="fa-solid fa-plus"></i> Make a New Booking
          </h3>
        </div>

        {rooms.length === 0 && !loading && (
          <div className="admin-empty">
            <i className="fa-solid fa-bed"></i>
            <div className="admin-empty-title">No rooms available</div>
            <div className="admin-empty-desc">Wait for admin to add rooms.</div>
          </div>
        )}

        {rooms.length > 0 && (
          <form onSubmit={handleCreateBooking}>
            <div className="admin-form-grid">
              <div className="admin-field">
                <label htmlFor="bk-room"><i className="fa-solid fa-bed"></i> Room</label>
                <select
                  id="bk-room"
                  className="admin-select"
                  value={form.room_id}
                  onChange={(e) => setForm({ ...form, room_id: e.target.value })}
                  required
                >
                  <option value="">Select room…</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      Room {room.room_number} — {room.room_type} — ₱{room.price}/night
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-field">
                <label htmlFor="bk-in"><i className="fa-solid fa-calendar-plus"></i> Check-in</label>
                <input
                  id="bk-in"
                  className="admin-input" type="date"
                  value={form.check_in}
                  onChange={(e) => setForm({ ...form, check_in: e.target.value })}
                  required
                />
              </div>

              <div className="admin-field">
                <label htmlFor="bk-out"><i className="fa-solid fa-calendar-minus"></i> Check-out</label>
                <input
                  id="bk-out"
                  className="admin-input" type="date"
                  value={form.check_out}
                  onChange={(e) => setForm({ ...form, check_out: e.target.value })}
                  required
                />
              </div>
            </div>

            {error && <p className="admin-error" aria-live="polite">{error}</p>}
            {message && <p className="admin-success" aria-live="polite">{message}</p>}

            <div className="admin-form-actions">
              <button type="submit" className="app-btn app-btn-primary">
                <i className="fa-solid fa-calendar-check mr-2"></i> Create Booking
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Reservations */}
      <div className="admin-panel">
        <div className="admin-panel-header">
          <h3 className="admin-panel-title">
            <i className="fa-solid fa-ticket"></i> My Reservations ({bookings.length})
          </h3>
        </div>

        {loading && (
          <div className="admin-loading">
            <i className="fa-solid fa-spinner fa-spin mr-2"></i> Loading…
          </div>
        )}

        {!loading && bookings.length === 0 && (
          <div className="admin-empty">
            <i className="fa-solid fa-calendar-xmark"></i>
            <div className="admin-empty-title">No bookings yet</div>
            <div className="admin-empty-desc">Use the form above to create your first booking.</div>
          </div>
        )}

        {!loading && bookings.map((booking) => (
          <BookingCard
            key={booking.id}
            booking={booking}
            paying={paying}
            updatingId={updatingId}
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