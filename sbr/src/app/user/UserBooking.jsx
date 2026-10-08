import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabase.js';
import { writeNFC } from '../../nfc.js';
import { encrypt, decrypt } from '../../encryption.js';
import UserLayout from './UserLayout.jsx';

// Constants
const API = 'http://localhost:5000';
const PENDING_KEY = 'sbr:pendingBookingId';
const SESSION_KEY = 'sbr:pendingSessionId';

// REUSABLE SUB-COMPONENTS
// StatusPill Component
// Renders a colored badge for payment or booking statuses.
function StatusPill({ type, value }) {
  let icon = 'fa-circle';
  if (type === 'payment') {
    icon = value === 'paid' ? 'fa-circle-check' : 'fa-hourglass-half';
  } else if (type === 'booking') {
    if (value === 'confirmed') icon = 'fa-ticket';
    else if (value === 'checked_out') icon = 'fa-door-open';
    else icon = 'fa-clock';
  }

  return (
    <span className={`admin-pill ${value}`}>
      <i className={`fa-solid ${icon}`}></i> {value}
    </span>
  );
}

// BookingCard Component
// Displays the details of a single booking along with relevant action buttons.
function BookingCard({ booking, paying, onPay, onCheckIn, onCheckOut }) {
  const room = booking.rooms;
  const isPaid = booking.payment_status === 'paid';
  const isCheckedOut = booking.status === 'checked_out';

  return (
    <div className="admin-panel mb-4" style={{ padding: 20 }}>
      <div className="space-between">
        {/* Left Side: Booking Details */}
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

        {/* Right Side: Status Badges */}
        <div className="text-right">
          <StatusPill type="payment" value={booking.payment_status} />
          <br />
          <div className="mt-2">
            <StatusPill type="booking" value={booking.status} />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="row-actions mt-3">
        {!isPaid && (
          <button 
            className="app-btn app-btn-primary app-btn-sm"
            onClick={() => onPay(booking)} 
            disabled={paying}
          >
            <i className="fa-solid fa-credit-card mr-2"></i>
            {paying ? 'Redirecting…' : 'Pay via PayMongo'}
          </button>
        )}

        {isPaid && !isCheckedOut && (
          <>
            <button className="app-btn app-btn-secondary app-btn-sm mr-2" onClick={onCheckIn}>
              <i className="fa-solid fa-wifi mr-2"></i> NFC Check-in
            </button>
            <button className="app-btn app-btn-danger app-btn-sm" onClick={() => onCheckOut(booking)}>
              <i className="fa-solid fa-door-open mr-2"></i> Check-out
            </button>
          </>
        )}

        {isCheckedOut && (
          <span className="muted text-sm">
            <i className="fa-solid fa-circle-check text-success mr-2"></i> Checked out
          </span>
        )}
      </div>
    </div>
  );
}

// MAIN USER BOOKING COMPONENT
// UserBooking Component
// Handles creating bookings, processing PayMongo payments, 
// and managing NFC check-in/check-out tokens.
export default function UserBooking() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const verifyGuardRef = useRef(false);

  // State Management 
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [form, setForm] = useState({ room_id: '', check_in: '', check_out: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [nfcBanner, setNfcBanner] = useState('');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  // DATA FETCHING
  // Fetches all rooms and the current user's bookings.
  async function fetchData() {
    setLoading(true);
    setError('');
    try {
      // Fetch rooms
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms').select('*').order('room_number');
      if (roomsError) throw roomsError;
      setRooms(roomsData || []);

      // Fetch current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        navigate('/login');
        return;
      }

      // Fetch user's bookings
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

  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // PAYMONGO REDIRECT & VERIFICATION
  // Polls the backend to verify payment status up to 5 times.
  async function pollPaymentVerification(bookingId, sessionId, accessToken) {
    for (let attempt = 1; attempt <= 5; attempt++) {
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

      setNfcBanner(`Waiting for PayMongo confirmation… (${attempt}/5)`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error('Payment not yet confirmed. Please refresh in a moment.');
  }

  // Verifies the payment and issues an NFC token if successful.
  async function verifyPaymentAndIssueNFC(bookingId) {
    setError(''); setMessage('');
    setNfcBanner('Verifying your payment with PayMongo…');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired. Please log in again.');

      const sessionId = localStorage.getItem(SESSION_KEY);
      const verificationResult = await pollPaymentVerification(
        bookingId, sessionId, session.access_token
      );

      // Save and write NFC token
      if (verificationResult.nfc?.rawToken) {
        sessionStorage.setItem('sbr:lastNfcToken', encrypt(verificationResult.nfc.rawToken));
        sessionStorage.setItem('sbr:nfcPurpose', verificationResult.nfc.purpose || 'check_in');
        await writeNFC(verificationResult.nfc.rawToken);
      }

      // Cleanup local storage
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

  /* Handle PayMongo Redirect */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ACTIONS
  // Handles the creation of a new booking.
  async function handleCreateBooking(e) {
    e.preventDefault();
    setError(''); setMessage('');
    
    if (!form.room_id) return setError('Please select a room.');
    if (!form.check_in || !form.check_out) return setError('Please select check-in and check-out dates.');

    const room = rooms.find((r) => r.id === form.room_id);
    if (!room) return setError('Room not found.');

    const nights = Math.max(1, Math.round(
      (new Date(form.check_out) - new Date(form.check_in)) / 86400000
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

  // Initiates a PayMongo checkout session and redirects the user.
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

  // Verifies the NFC token for check-in.
  async function handleNfcCheckIn() {
    setError(''); setMessage('');
    try {
      const encryptedToken = sessionStorage.getItem('sbr:lastNfcToken');
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

  // Processes check-out and issues a new NFC token.
  async function handleCheckOut(booking) {
    setError(''); setMessage(''); setNfcBanner('');
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

      sessionStorage.setItem('sbr:lastNfcToken', encrypt(json.nfc.rawToken));
      setNfcBanner('Checkout ready — old NFC invalidated.');
      await writeNFC(json.nfc.rawToken);
      setMessage('Old NFC invalidated. New checkout code written.');
      await fetchData();
    } catch (err) {
      setError(err.message);
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
        <div className="nfc-banner mb-4">
          <i className="fa-solid fa-wifi mr-2"></i>
          {nfcBanner}
        </div>
      )}

      {/*BOOKING FORM*/}
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
                <label><i className="fa-solid fa-bed"></i> Room</label>
                <select 
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
                <label><i className="fa-solid fa-calendar-plus"></i> Check-in</label>
                <input 
                  className="admin-input" type="date"
                  value={form.check_in}
                  onChange={(e) => setForm({ ...form, check_in: e.target.value })} 
                  required 
                />
              </div>

              <div className="admin-field">
                <label><i className="fa-solid fa-calendar-minus"></i> Check-out</label>
                <input 
                  className="admin-input" type="date"
                  value={form.check_out}
                  onChange={(e) => setForm({ ...form, check_out: e.target.value })} 
                  required 
                />
              </div>
            </div>

            {error && <p className="admin-error">{error}</p>}
            {message && <p className="admin-success">{message}</p>}

            <div className="admin-form-actions">
              <button type="submit" className="app-btn app-btn-primary">
                <i className="fa-solid fa-calendar-check mr-2"></i> Create Booking
              </button>
            </div>
          </form>
        )}
      </div>

      {/*MY RESERVATIONS*/}
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
            onPay={handlePayWithPayMongo}
            onCheckIn={handleNfcCheckIn}
            onCheckOut={handleCheckOut}
          />
        ))}
      </div>
    </UserLayout>
  );
}