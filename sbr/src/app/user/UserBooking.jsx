/* ============================================================
   src/app/UserBooking.jsx
   Booking + PayMongo payment + auto NFC + auto-approve booking.
   Uses localStorage fallback so it works even without query params.
   ============================================================ */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabase.js';
import { writeNFC } from '../../nfc.js';
import { encrypt, decrypt } from '../../encryption.js';

const API = 'http://localhost:5000';
const PENDING_KEY = 'sbr:pendingBookingId';
const SESSION_KEY = 'sbr:pendingSessionId';

export default function UserBooking() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();

  const [rooms,     setRooms]     = useState([]);
  const [bookings,  setBookings]  = useState([]);
  const [form,      setForm]      = useState({ room_id: '', check_in: '', check_out: '' });
  const [msg,       setMsg]       = useState('');
  const [err,       setErr]       = useState('');
  const [nfcBanner, setNfcBanner] = useState('');
  const [loading,   setLoading]   = useState(true);
  const [paying,    setPaying]    = useState(false);

  /* ------------------------------------------------------------
     Handle PayMongo redirect: ?status=success | ?status=cancelled
     ------------------------------------------------------------ */
  useEffect(() => {
    const status = params.get('status');

    if (status === 'success') {
      const bookingId = localStorage.getItem(PENDING_KEY);
      setParams({}, { replace: true });

      if (bookingId) {
        verifyPaymentAndIssueNFC(bookingId);
      } else {
        setMsg('✅ Payment received. Refreshing bookings…');
        refresh();
      }
    } else if (status === 'cancelled') {
      localStorage.removeItem(PENDING_KEY);
      localStorage.removeItem(SESSION_KEY);
      setParams({}, { replace: true });
      setErr('Payment was cancelled.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------------------
     Verify payment → auto-confirm booking → issue NFC
     ------------------------------------------------------------ */
  async function verifyPaymentAndIssueNFC(bookingId) {
    setErr(''); setMsg('');
    setNfcBanner('⏳ Verifying your payment with PayMongo…');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired. Please log in again.');

      const sessionId = localStorage.getItem(SESSION_KEY);

      // Retry up to 5 times (PayMongo sometimes needs a moment)
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

        setNfcBanner(`⏳ Waiting for PayMongo confirmation… (${attempt}/5)`);
        await new Promise((r) => setTimeout(r, 2000));
      }

      if (!json?.paid) {
        setNfcBanner('');
        setErr('Payment not yet confirmed. Please refresh in a moment.');
        await refresh();
        return;
      }

      // Cache NFC token (encrypted) for later check-in
      if (json.nfc?.rawToken) {
        sessionStorage.setItem('sbr:lastNfcToken', encrypt(json.nfc.rawToken));
        sessionStorage.setItem('sbr:nfcPurpose', json.nfc.purpose || 'check_in');
        await writeNFC(json.nfc.rawToken);
      }

      // Cleanup
      localStorage.removeItem(PENDING_KEY);
      localStorage.removeItem(SESSION_KEY);

      setNfcBanner('📶 Payment confirmed! Tap your phone sa room NFC reader para mag check-in.');
      setMsg('✅ Booking marked as PAID and CONFIRMED. NFC check-in token issued.');
      await refresh();
    } catch (e) {
      console.error('VERIFY ERROR:', e);
      setNfcBanner('');
      setErr(e.message);
    }
  }

  /* ------------------------------------------------------------
     Load rooms + bookings
     ------------------------------------------------------------ */
  async function refresh() {
    try {
      const { data: r, error: rErr } = await supabase
        .from('rooms')
        .select('*')
        .order('room_number');
      if (rErr) throw rErr;
      setRooms(r || []);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { nav('/login'); return; }

      const { data: b, error: bErr } = await supabase
        .from('bookings')
        .select('*, rooms(room_number,room_type,price)')
        .eq('user_id', auth.user.id)
        .order('created_at', { ascending: false });
      if (bErr) throw bErr;
      setBookings(b || []);
    } catch (e) {
      console.error('REFRESH ERROR:', e);
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  /* ------------------------------------------------------------
     Create booking
     ------------------------------------------------------------ */
  async function createBooking(e) {
    e.preventDefault();
    setErr(''); setMsg('');

    if (!form.room_id) return setErr('Pumili muna ng room.');
    if (!form.check_in || !form.check_out) {
      return setErr('Pumili ng check-in at check-out dates.');
    }

    const room = rooms.find((r) => r.id === form.room_id);
    if (!room) return setErr('Hindi mahanap ang room.');

    const nights = Math.max(
      1,
      Math.round((new Date(form.check_out) - new Date(form.check_in)) / 86400000)
    );
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

    setMsg(`✅ Booking created — ${nights} night(s), total ₱${total}`);
    setForm({ room_id: '', check_in: '', check_out: '' });
    refresh();
  }

  /* ------------------------------------------------------------
     Pay via PayMongo — save booking id + sessionId to localStorage
     ------------------------------------------------------------ */
  async function payWithPayMongo(booking) {
    setErr(''); setMsg(''); setNfcBanner('');
    setPaying(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Walang session. Mag-login muli.');

      // Save booking id so we can find it after redirect
      localStorage.setItem(PENDING_KEY, booking.id);

      const res = await fetch(`${API}/api/payments/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          bookingId: booking.id,
          description: `Room ${booking.rooms?.room_number} — ${booking.check_in} to ${booking.check_out}`
        })
      });

      const json = await res.json();
      if (!json.ok) {
        localStorage.removeItem(PENDING_KEY);
        throw new Error(json.error || 'Checkout failed');
      }

      // Save session ID for verification after redirect
      if (json.sessionId) {
        localStorage.setItem(SESSION_KEY, json.sessionId);
      }

      // Redirect to PayMongo hosted checkout
      window.location.href = json.checkoutUrl;
    } catch (e) {
      console.error('PAY ERROR:', e);
      setErr(e.message);
      setPaying(false);
    }
  }

  /* ------------------------------------------------------------
     NFC check-in
     ------------------------------------------------------------ */
  async function nfcCheckIn() {
    setErr(''); setMsg('');

    try {
      const enc = sessionStorage.getItem('sbr:lastNfcToken');
      if (!enc) throw new Error('Walang NFC token. Mag-bayad muna.');
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
      setMsg('✅ Check-in successful via NFC.');
    } catch (e) {
      console.error('NFC CHECK-IN ERROR:', e);
      setErr(e.message);
    }
  }

  /* ------------------------------------------------------------
     Check-out
     ------------------------------------------------------------ */
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
      if (!json.ok) throw new Error(json.error || 'Checkout failed');

      sessionStorage.setItem('sbr:lastNfcToken', encrypt(json.nfc.rawToken));
      sessionStorage.setItem('sbr:nfcPurpose', 'check_out');
      setNfcBanner('🔒 Checkout ready — old NFC invalidated. Tap to confirm.');
      await writeNFC(json.nfc.rawToken);
      setMsg('Old NFC invalidated. New checkout code written.');
      refresh();
    } catch (e) {
      console.error('CHECKOUT ERROR:', e);
      setErr(e.message);
    }
  }

  return (
    <>
      <nav className="nav">
        <strong>SBR · Bookings</strong>
        <div className="row" style={{ marginLeft: 'auto' }}>
          <Link to="/user">Dashboard</Link>
          <Link to="/user/booking">Bookings</Link>
          <Link to="/user/profile">Profile</Link>
        </div>
      </nav>

      <div className="page-pad">
        {nfcBanner && (
          <div className="nfc-banner" style={{ marginBottom: 20 }}>
            {nfcBanner}
          </div>
        )}

        <div className="neu-card">
          <h2>Make a Booking</h2>

          {rooms.length === 0 && !loading && (
            <p className="muted">
              Walang rooms na available. Siguraduhing may rooms sa Supabase.
            </p>
          )}

          <form onSubmit={createBooking} className="row">
            <div className="col">
              <select
                className="neu-select"
                value={form.room_id}
                onChange={(e) => setForm({ ...form, room_id: e.target.value })}
                required
              >
                <option value="">Select room…</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.room_number} — {r.room_type} — ₱{r.price}/night
                    {r.status !== 'available' ? ` (${r.status})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="col">
              <input
                className="neu-input"
                type="date"
                value={form.check_in}
                onChange={(e) => setForm({ ...form, check_in: e.target.value })}
                required
              />
            </div>
            <div className="col">
              <input
                className="neu-input"
                type="date"
                value={form.check_out}
                onChange={(e) => setForm({ ...form, check_out: e.target.value })}
                required
              />
            </div>
            <div className="col" style={{ flex: '0 0 140px' }}>
              <button className="neu-button primary" style={{ width: '100%' }}>
                Book
              </button>
            </div>
          </form>

          {err && <p className="error-text">⚠️ {err}</p>}
          {msg && <p className="success-text">{msg}</p>}
        </div>

        <div className="neu-card" style={{ marginTop: 20 }}>
          <h2>My Reservations ({bookings.length})</h2>

          {bookings.length === 0 && !loading && (
            <p className="muted">Wala ka pang booking.</p>
          )}

          {bookings.map((b) => (
            <div key={b.id} className="neu-card" style={{ marginBottom: 14, padding: 18 }}>
              <div className="space-between">
                <div>
                  <strong>Room {b.rooms?.room_number}</strong>{' '}
                  <span className="muted">({b.rooms?.room_type})</span>
                  <br />
                  <span className="muted">{b.check_in} → {b.check_out}</span>
                  <br />
                  <span className="muted">Total: ₱{Number(b.total_amount).toLocaleString()}</span>
                </div>
                <div>
                  <span className={`pill ${b.payment_status}`}>{b.payment_status}</span>{' '}
                  <span className={`pill ${b.status}`}>{b.status}</span>
                </div>
              </div>

              <div className="row" style={{ marginTop: 14 }}>
                {b.payment_status === 'unpaid' && (
                  <button
                    className="neu-button primary"
                    onClick={() => payWithPayMongo(b)}
                    disabled={paying}
                  >
                    {paying ? 'Redirecting…' : '💳 Pay via PayMongo'}
                  </button>
                )}

                {b.payment_status === 'paid' && b.status !== 'checked_out' && (
                  <>
                    <button className="neu-button" onClick={nfcCheckIn}>
                      📶 Tap NFC check-in
                    </button>
                    <button className="neu-button danger" onClick={() => checkOut(b)}>
                      🚪 Check-out
                    </button>
                  </>
                )}

                {b.status === 'checked_out' && (
                  <span className="muted">✅ Checked out — old NFC codes invalidated.</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}