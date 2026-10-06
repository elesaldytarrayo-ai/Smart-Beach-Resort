/* ============================================================
   src/app/staff/StaffReservations.jsx
   Full reservation list for staff — filter, view, update status.
   Auto-refresh every 10 seconds.
   ============================================================ */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../supabase.js';

export default function StaffReservations() {
  const [bookings,    setBookings]    = useState([]);
  const [filter,      setFilter]      = useState('all');
  const [search,      setSearch]      = useState('');
  const [loading,     setLoading]     = useState(true);
  const [err,         setErr]         = useState('');
  const [msg,         setMsg]         = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);

  /* ------------------------------------------------------------
     Load all bookings
     ------------------------------------------------------------ */
  async function refresh() {
    try {
      setErr('');
      const { data, error } = await supabase
        .from('bookings')
        .select('*, profiles(full_name,email,phone), rooms(room_number,room_type)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
      setLastRefresh(new Date());
    } catch (e) {
      console.error('STAFF RESERVATIONS ERROR:', e);
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
     Update booking status
     ------------------------------------------------------------ */
  async function setStatus(b, status) {
    if (!confirm(`Change status to "${status}"?`)) return;
    setErr(''); setMsg('');
    const { error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', b.id);

    if (error) return setErr(error.message);
    setMsg(`✅ Booking marked as "${status}"`);
    refresh();
  }

  /* ------------------------------------------------------------
     Filter + search
     ------------------------------------------------------------ */
  const filtered = bookings.filter((b) => {
    if (filter !== 'all' && b.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${b.profiles?.full_name || ''} ${b.profiles?.email || ''} ${b.rooms?.room_number || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const counts = {
    all:         bookings.length,
    pending:     bookings.filter((b) => b.status === 'pending').length,
    confirmed:   bookings.filter((b) => b.status === 'confirmed').length,
    checked_out: bookings.filter((b) => b.status === 'checked_out').length
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
        </div>
      </nav>

      <div className="page-pad">
        <div className="space-between" style={{ marginBottom: 20 }}>
          <h1>All Reservations ({bookings.length})</h1>
          {lastRefresh && (
            <span className="muted">Last refresh: {lastRefresh.toLocaleTimeString()}</span>
          )}
        </div>

        {/* Summary */}
        <div className="feature-grid" style={{ marginBottom: 24 }}>
          <MiniStat icon="📅" label="Total"       value={counts.all} />
          <MiniStat icon="🕒" label="Pending"     value={counts.pending} />
          <MiniStat icon="🎫" label="Confirmed"   value={counts.confirmed} />
          <MiniStat icon="🚪" label="Checked out" value={counts.checked_out} />
        </div>

        {/* Filters */}
        <div className="neu-card">
          <div className="row" style={{ alignItems: 'center' }}>
            <div className="col">
              <input
                className="neu-input"
                placeholder="Search by guest name, email, or room…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ marginBottom: 0 }}
              />
            </div>
            <div className="col" style={{ flex: '0 0 220px' }}>
              <select
                className="neu-select"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{ marginBottom: 0 }}
              >
                <option value="all">All ({counts.all})</option>
                <option value="pending">Pending ({counts.pending})</option>
                <option value="confirmed">Confirmed ({counts.confirmed})</option>
                <option value="checked_out">Checked out ({counts.checked_out})</option>
              </select>
            </div>
            <button className="neu-button" onClick={refresh}>🔄 Refresh</button>
          </div>
        </div>

        {err && <p className="error-text" style={{ marginTop: 12 }}>⚠️ {err}</p>}
        {msg && <p className="success-text" style={{ marginTop: 12 }}>{msg}</p>}

        {/* Table */}
        <div className="neu-card" style={{ marginTop: 20 }}>
          {loading && <p className="muted center">Loading…</p>}

          {!loading && filtered.length === 0 && (
            <p className="muted center">No reservations match your filter.</p>
          )}

          {!loading && filtered.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Room</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong>{b.profiles?.full_name || '—'}</strong>
                      <br />
                      <span className="muted">{b.profiles?.email}</span>
                      {b.profiles?.phone && (
                        <>
                          <br />
                          <span className="muted">📞 {b.profiles.phone}</span>
                        </>
                      )}
                    </td>
                    <td>
                      #{b.rooms?.room_number}
                      <br />
                      <span className="muted">{b.rooms?.room_type}</span>
                    </td>
                    <td><span className="muted">{b.check_in}</span></td>
                    <td><span className="muted">{b.check_out}</span></td>
                    <td>
                      <span className={`pill ${b.payment_status}`}>
                        {b.payment_status}
                      </span>
                    </td>
                    <td>
                      <span className={`pill ${b.status}`}>{b.status}</span>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        {b.status === 'pending' && (
                          <button
                            className="neu-button primary"
                            onClick={() => setStatus(b, 'confirmed')}
                            style={{ padding: '6px 10px', fontSize: 12 }}
                          >
                            Confirm
                          </button>
                        )}
                        {b.status === 'confirmed' && (
                          <button
                            className="neu-button danger"
                            onClick={() => setStatus(b, 'checked_out')}
                            style={{ padding: '6px 10px', fontSize: 12 }}
                          >
                            Check-out
                          </button>
                        )}
                        {b.status === 'checked_out' && (
                          <span className="muted" style={{ fontSize: 12 }}>Done</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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