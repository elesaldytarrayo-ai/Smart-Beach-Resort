/* ============================================================
   src/app/staff/Staff.jsx
   Staff dashboard — pinapakita LAHAT ng rooms at bookings.
   May NFC check-in, room status update, at auto-refresh.
   ============================================================ */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase.js';
import { readNFC } from '../../nfc.js';

const API = 'http://localhost:5000';

export default function Staff() {
  const nav = useNavigate();

  const [rooms,       setRooms]       = useState([]);
  const [bookings,    setBookings]    = useState([]);
  const [msg,         setMsg]         = useState('');
  const [err,         setErr]         = useState('');
  const [loading,     setLoading]     = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  /* ------------------------------------------------------------
     Load rooms + all bookings
     ------------------------------------------------------------ */
  async function refresh() {
    try {
      setErr('');

      // Rooms
      const { data: r, error: rErr } = await supabase
        .from('rooms')
        .select('*')
        .order('room_number');
      if (rErr) throw rErr;
      setRooms(r || []);

      // Recent bookings
      const { data: b, error: bErr } = await supabase
        .from('bookings')
        .select('*, profiles(full_name,email), rooms(room_number,room_type)')
        .order('created_at', { ascending: false })
        .limit(20);
      if (bErr) throw bErr;
      setBookings(b || []);

      setLastRefresh(new Date());
    } catch (e) {
      console.error('STAFF LOAD ERROR:', e);
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, []);

  /* ------------------------------------------------------------
     Update room status
     ------------------------------------------------------------ */
  async function updateRoomStatus(id, status) {
    setErr('');
    const { error } = await supabase
      .from('rooms')
      .update({ status })
      .eq('id', id);

    if (error) {
      setErr(error.message);
      return;
    }
    refresh();
  }

  /* ------------------------------------------------------------
     NFC check-in
     ------------------------------------------------------------ */
  async function tapCheckIn() {
    setErr(''); setMsg('');
    const read = await readNFC();
    if (!read.ok) return setErr('NFC read failed: ' + read.error);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${API}/api/nfc/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ rawToken: read.text, purpose: 'check_in' })
    });
    const json = await res.json();
    if (!json.ok) return setErr(json.error);
    setMsg(`✅ Check-in verified for booking ${json.bookingId.slice(0, 8)}…`);
  }

  async function logout() {
    await supabase.auth.signOut();
    nav('/login');
  }

  /* Counts */
  const roomCounts = {
    all:         rooms.length,
    available:   rooms.filter((r) => r.status === 'available').length,
    occupied:    rooms.filter((r) => r.status === 'occupied').length,
    maintenance: rooms.filter((r) => r.status === 'maintenance').length
  };

  return (
    <>
      {/* ---------- Nav ---------- */}
      <nav className="nav">
        <div className="brand">
          <span className="brand-icon">🏖️</span>
          <span>SBR · Staff</span>
        </div>
        <div className="row" style={{ marginLeft: 'auto' }}>
          <Link to="/staff">Dashboard</Link>
          <Link to="/staff/reservations">Reservations</Link>
          <button className="neu-button" onClick={logout}>Logout</button>
        </div>
      </nav>

      <div className="page-pad">
        {/* ---------- Hero ---------- */}
        <section className="hero" style={{ padding: '32px', textAlign: 'left' }}>
          <div className="hero-content">
            <span style={{ fontSize: 36 }}>🏖️</span>
            <h1 style={{ fontSize: 26, marginTop: 8 }}>Staff Dashboard</h1>
            <p style={{ margin: 0, textAlign: 'left' }}>
              Front desk · Room management · NFC check-in
              {lastRefresh && (
                <span className="muted"> · Last: {lastRefresh.toLocaleTimeString()}</span>
              )}
            </p>
            <div className="row" style={{ marginTop: 16 }}>
              <button className="neu-button primary" onClick={refresh}>🔄 Refresh</button>
            </div>
          </div>
        </section>

        {err && (
          <div className="neu-card" style={{ borderLeft: '4px solid #e11d48', marginTop: 20 }}>
            <strong style={{ color: '#e11d48' }}>⚠️ Error:</strong>
            <p className="muted" style={{ marginTop: 6 }}>{err}</p>
          </div>
        )}

        {/* ---------- Front Desk (NFC check-in) ---------- */}
        <div className="neu-card" style={{ marginTop: 20 }}>
          <div className="space-between">
            <div>
              <h2 style={{ marginBottom: 4 }}>Front Desk</h2>
              <p className="muted">Tap the guest's NFC tag to verify check-in.</p>
            </div>
            <button className="neu-button primary" onClick={tapCheckIn}>
              📶 Tap NFC to Check In
            </button>
          </div>
          {msg && <p className="success-text" style={{ marginTop: 12 }}>{msg}</p>}
        </div>

        {/* ---------- Room Stats ---------- */}
        <div className="feature-grid" style={{ marginTop: 24 }}>
          <MiniStat icon="🛏️" label="Total Rooms"  value={roomCounts.all} />
          <MiniStat icon="✅" label="Available"    value={roomCounts.available} />
          <MiniStat icon="🚫" label="Occupied"     value={roomCounts.occupied} />
          <MiniStat icon="🔧" label="Maintenance"  value={roomCounts.maintenance} />
        </div>

        {/* ---------- Two-column layout ---------- */}
        <div className="row" style={{ marginTop: 24 }}>
          {/* Recent bookings */}
          <div className="neu-card col">
            <h3>Recent Bookings ({bookings.length})</h3>

            {loading && <p className="muted">Loading…</p>}

            {!loading && bookings.length === 0 && (
              <p className="muted">Walang bookings sa database.</p>
            )}

            {bookings.slice(0, 8).map((b) => (
              <div
                key={b.id}
                className="space-between"
                style={{ padding: '10px 0', borderBottom: '1px solid #cfd6e4' }}
              >
                <div>
                  <strong>Room {b.rooms?.room_number}</strong>
                  <br />
                  <span className="muted">{b.profiles?.full_name || 'Guest'}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={`pill ${b.status}`}>{b.status}</span>
                  <br />
                  <span className={`pill ${b.payment_status}`} style={{ marginTop: 4 }}>
                    {b.payment_status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* All rooms */}
          <div className="neu-card col">
            <h3>All Rooms ({rooms.length})</h3>

            {loading && <p className="muted">Loading…</p>}

            {!loading && rooms.length === 0 && (
              <p className="muted">Walang rooms sa database. Hintayin ang admin.</p>
            )}

            {rooms.map((r) => (
              <div
                key={r.id}
                className="space-between"
                style={{ padding: '10px 0', borderBottom: '1px solid #cfd6e4' }}
              >
                <div>
                  <strong>Room {r.room_number}</strong> — {r.room_type}
                  <br />
                  <span className="muted">₱{Number(r.price).toLocaleString()}/night</span>
                </div>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <span className={`pill ${r.status}`}>{r.status}</span>
                  <button
                    className="neu-button"
                    onClick={() =>
                      updateRoomStatus(
                        r.id,
                        r.status === 'available' ? 'maintenance' : 'available'
                      )
                    }
                  >
                    {r.status === 'available' ? '→ Maint' : '→ Available'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function MiniStat({ icon, label, value }) {
  return (
    <div className="feature-card" style={{ padding: '16px 14px' }}>
      <span className="feature-icon" style={{ fontSize: 24 }}>{icon}</span>
      <p className="muted" style={{ fontSize: 12 }}>{label}</p>
      <h2 style={{ color: 'var(--accent)' }}>{value}</h2>
    </div>
  );
}