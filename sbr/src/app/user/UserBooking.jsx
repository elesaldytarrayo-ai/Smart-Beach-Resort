/* ============================================================
   src/app/user/UserBooking.jsx
   Booking + PayMongo + NFC — with UserLayout.
   ============================================================ */

import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabase.js';
import { writeNFC } from '../../nfc.js';
import { encrypt, decrypt } from '../../encryption.js';
import UserLayout from './UserLayout.jsx';

const API = 'http://localhost:5000';
const PENDING_KEY = 'sbr:pendingBookingId';
const SESSION_KEY = 'sbr:pendingSessionId';

export default function UserBooking() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const verifyGuardRef = useRef(false);

  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [form, setForm] = useState({ room_id: '', check_in: '', check_out: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [nfcBanner, setNfcBanner] = useState('');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  /* Handle PayMongo redirect */
  useEffect(() => {
    const status = params.get('status');
    if (status === 'success' && !verifyGuardRef.current) {
      verifyGuardRef.current = true;
      const bookingId = localStorage.getItem(PENDING_KEY);
      setParams({}, { replace: true });
      if (bookingId) verifyPaymentAndIssueNFC(bookingId);
      else { setMsg('Payment received.'); refresh(); }
    } else if (status === 'cancelled') {
      localStorage.removeItem(PENDING_KEY);
      localStorage.removeItem(SESSION_KEY);
      setParams({}, { replace: true });
      setErr('Payment was cancelled.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verifyPaymentAndIssueNFC(bookingId) {
    setErr(''); setMsg('');
    setNfcBanner('Verifying your payment with PayMongo…');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired');

      const sessionId = localStorage.getItem(SESSION_KEY);

      let json = null;
      for (let attempt = 1; attempt <= 5; attempt++) {
        const res = await fetch(`${API}/api/payments/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ bookingId, sessionId })
        });
        json = await res.json();
        if (!json.ok) throw new Error(json.error || 'Verification failed');
        if (json.paid) break;

        setNfcBanner(`Waiting for PayMongo confirmation… (${attempt}/5)`);
        await new Promise((r) => setTimeout(r, 2000));
      }

      if (!json?.paid) {
        setNfcBanner('');
        setErr('Payment not yet confirmed. Refresh in a moment.');
        await refresh();
        return;
      }

      if (json.nfc?.rawToken) {
        sessionStorage.setItem('sbr:lastNfcToken', encrypt(json.nfc.rawToken));
        sessionStorage.setItem('sbr:nfcPurpose', json.nfc.purpose || 'check_in');
        await writeNFC(json.nfc.rawToken);
      }

      localStorage.removeItem(PENDING_KEY);
      localStorage.removeItem(SESSION_KEY);

      setNfcBanner('Payment confirmed! Tap your phone to the room NFC reader.');
      setMsg('Booking PAID + CONFIRMED. Payment saved. NFC token issued.');
      await refresh();
    } catch (e) {
      setNfcBanner('');
      setErr(e.message);
    }
  }

  async function refresh() {
    try {
      const { data: r } = await supabase
        .from('rooms').select('*').order('room_number');
      setRooms(r || []);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { nav('/login'); return; }

      const { data: b } = await supabase
        .from('bookings')
        .select('*, rooms(room_number,room_type,price)')
        .eq('user_id', auth.user.id)
        .order('created_at', { ascending: false });
      setBookings(b || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function createBooking(e) {
    e.preventDefault();
    setErr(''); setMsg('');
    if (!form.room_id) return setErr('Pumili muna ng room.');
    if (!form.check_in || !form.check_out) return setErr('Pumili ng dates.');

    const room = rooms.find((r) => r.id === form.room_id);
    if (!room) return setErr('Room not found.');

    const nights = Math.max(1, Math.round(
      (new Date(form.check_out) - new Date(form.check_in)) / 86400000
    ));
    const total = nights * Number(room.price);

    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from('bookings').insert({
      user_id: auth.user.id,
      room_id: room.id,
      check_in: form.check_in,
      check_out: form.check_out,
      total_amount: total,
      status: 'pending',
      payment_status: 'unpaid'
    });

    if (error) return setErr(error.message);
    setMsg(`Booking created — ${nights} night(s), total ₱${total}`);
    setForm({ room_id: '', check_in: '', check_out: '' });
    refresh();
  }

  async function payWithPayMongo(booking) {
    setErr(''); setMsg(''); setNfcBanner('');
    setPaying(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Walang session');

      localStorage.setItem(PENDING_KEY, booking.id);

      const res = await fetch(`${API}/api/payments/checkout`, {
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
      const json = await res.json();
      if (!json.ok) {
        localStorage.removeItem(PENDING_KEY);
        throw new Error(json.error || 'Checkout failed');
      }
      if (json.sessionId) localStorage.setItem(SESSION_KEY, json.sessionId);
      window.location.href = json.checkoutUrl;
    } catch (e) {
      setErr(e.message);
      setPaying(false);
    }
  }

  async function nfcCheckIn() {
    setErr(''); setMsg('');
    try {
      const enc = sessionStorage.getItem('sbr:lastNfcToken');
      if (!enc) throw new Error('Walang NFC token.');
      const rawToken = decrypt(enc);

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API}/api/nfc/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ rawToken, purpose: 'check_in' })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setMsg('Check-in successful via NFC.');
    } catch (e) { setErr(e.message); }
  }

  async function checkOut(booking) {
    setErr(''); setMsg(''); setNfcBanner('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API}/api/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ bookingId: booking.id })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      sessionStorage.setItem('sbr:lastNfcToken', encrypt(json.nfc.rawToken));
      setNfcBanner('Checkout ready — old NFC invalidated.');
      await writeNFC(json.nfc.rawToken);
      setMsg('Old NFC invalidated. New checkout code written.');
      refresh();
    } catch (e) { setErr(e.message); }
  }

  return (
    <UserLayout>
      <div className="admin-welcome">
        <h1>My Bookings</h1>
        <p>Book a room, pay online, at mag-check-in gamit ang NFC.</p>
      </div>

      {nfcBanner && (
        <div className="nfc-banner" style={{ marginBottom: 20 }}>
          <i className="fa-solid fa-wifi" style={{ marginRight: 8 }}></i>
          {nfcBanner}
        </div>
      )}

      {/* Booking Form */}
      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <div className="admin-panel-header">
          <h3 className="admin-panel-title">
            <i className="fa-solid fa-plus"></i> Make a New Booking
          </h3>
        </div>

        {rooms.length === 0 && !loading && (
          <div className="admin-empty">
            <i className="fa-solid fa-bed"></i>
            <div className="admin-empty-title">No rooms available</div>
            <div className="admin-empty-desc">
              Wait for admin to add rooms.
            </div>
          </div>
        )}

        {rooms.length > 0 && (
          <form onSubmit={createBooking}>
            <div className="admin-form-grid">
              <div className="admin-field">
                <label><i className="fa-solid fa-bed"></i> Room</label>
                <select className="admin-select" value={form.room_id}
                  onChange={(e) => setForm({ ...form, room_id: e.target.value })} required>
                  <option value="">Select room…</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      Room {r.room_number} — {r.room_type} — ₱{r.price}/night
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-field">
                <label><i className="fa-solid fa-calendar-plus"></i> Check-in</label>
                <input className="admin-input" type="date"
                  value={form.check_in}
                  onChange={(e) => setForm({ ...form, check_in: e.target.value })} required />
              </div>

              <div className="admin-field">
                <label><i className="fa-solid fa-calendar-minus"></i> Check-out</label>
                <input className="admin-input" type="date"
                  value={form.check_out}
                  onChange={(e) => setForm({ ...form, check_out: e.target.value })} required />
              </div>
            </div>

            {err && <p className="admin-error">{err}</p>}
            {msg && <p className="admin-success">{msg}</p>}

            <div className="admin-form-actions">
              <button className="app-btn app-btn-primary">
                <i className="fa-solid fa-calendar-check"></i> Create Booking
              </button>
            </div>
          </form>
        )}
      </div>

      {/* My Reservations */}
      <div className="admin-panel">
        <div className="admin-panel-header">
          <h3 className="admin-panel-title">
            <i className="fa-solid fa-ticket"></i> My Reservations ({bookings.length})
          </h3>
        </div>

        {loading && (
          <div className="admin-loading">
            <i className="fa-solid fa-spinner"></i> Loading…
          </div>
        )}

        {!loading && bookings.length === 0 && (
          <div className="admin-empty">
            <i className="fa-solid fa-calendar-xmark"></i>
            <div className="admin-empty-title">No bookings yet</div>
            <div className="admin-empty-desc">
              Use the form above to create your first booking.
            </div>
          </div>
        )}

        {!loading && bookings.map((b) => (
          <div key={b.id} className="admin-panel" style={{ marginBottom: 16, padding: 20 }}>
            <div className="space-between">
              <div>
                <div className="cell-main">
                  <i className="fa-solid fa-bed" style={{ marginRight: 6 }}></i>
                  Room {b.rooms?.room_number}
                  <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                    ({b.rooms?.room_type})
                  </span>
                </div>
                <div className="cell-sub" style={{ marginTop: 6 }}>
                  <i className="fa-solid fa-calendar" style={{ marginRight: 6 }}></i>
                  {b.check_in} → {b.check_out}
                </div>
                <div className="cell-sub">
                  <i className="fa-solid fa-peso-sign" style={{ marginRight: 6 }}></i>
                  Total: ₱{Number(b.total_amount).toLocaleString()}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`admin-pill ${b.payment_status}`}>
                  <i className={b.payment_status === 'paid' ? 'fa-solid fa-circle-check' : 'fa-solid fa-hourglass-half'}></i>
                  {b.payment_status}
                </span>
                <br />
                <span className={`admin-pill ${b.status}`} style={{ marginTop: 6 }}>
                  <i className={
                    b.status === 'confirmed' ? 'fa-solid fa-ticket' :
                    b.status === 'checked_out' ? 'fa-solid fa-door-open' :
                    'fa-solid fa-clock'
                  }></i>
                  {b.status}
                </span>
              </div>
            </div>

            <div className="row-actions" style={{ marginTop: 14 }}>
              {b.payment_status === 'unpaid' && (
                <button className="app-btn app-btn-primary app-btn-sm"
                  onClick={() => payWithPayMongo(b)} disabled={paying}>
                  <i className="fa-solid fa-credit-card"></i>
                  {paying ? 'Redirecting…' : 'Pay via PayMongo'}
                </button>
              )}

              {b.payment_status === 'paid' && b.status !== 'checked_out' && (
                <>
                  <button className="app-btn app-btn-secondary app-btn-sm" onClick={nfcCheckIn}>
                    <i className="fa-solid fa-wifi"></i> NFC Check-in
                  </button>
                  <button className="app-btn app-btn-danger app-btn-sm" onClick={() => checkOut(b)}>
                    <i className="fa-solid fa-door-open"></i> Check-out
                  </button>
                </>
              )}

              {b.status === 'checked_out' && (
                <span className="muted" style={{ fontSize: 13 }}>
                  <i className="fa-solid fa-circle-check" style={{ color: '#22c55e' }}></i> Checked out
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </UserLayout>
  );
}