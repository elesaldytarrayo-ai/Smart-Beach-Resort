/* ============================================================
   src/app/admin/AdminBookings.jsx
   Admin — lahat ng bookings mula sa users (live from Supabase).
   May filters, search, at manual admin actions.
   ============================================================ */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../supabase.js';

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);

  async function refresh() {
    try {
      setErr('');
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          profiles (full_name, email, phone),
          rooms (room_number, room_type, price)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
      setLastRefresh(new Date());
    } catch (e) {
      console.error('LOAD BOOKINGS ERROR:', e);
      setErr(e.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, []);

  async function markPaid(booking) {
    if (!confirm(`Mark booking as PAID?\n\nGuest: ${booking.profiles?.full_name}\nAmount: ₱${booking.total_amount}`)) return;

    setErr(''); setMsg('');

    try {
      const { error: bErr } = await supabase
        .from('bookings')
        .update({ payment_status: 'paid', status: 'confirmed' })
        .eq('id', booking.id);
      if (bErr) throw bErr;

      const { data: existing } = await supabase
        .from('payments')
        .select('id')
        .eq('booking_id', booking.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from('payments').insert({
          booking_id: booking.id,
          amount: booking.total_amount,
          method: 'manual-admin',
          status: 'paid',
          currency: 'PHP',
          paid_at: new Date().toISOString()
        });
      }

      setMsg(`✅ Booking marked as paid: ${booking.profiles?.full_name}`);
      refresh();
    } catch (e) {
      console.error(e);
      setErr(e.message);
    }
  }

  async function updateStatus(booking, newStatus) {
    if (!confirm(`Change status to "${newStatus}"?`)) return;

    setErr(''); setMsg('');
    const { error } = await supabase
      .from('bookings')
      .update({ status: newStatus })
      .eq('id', booking.id);

    if (error) return setErr(error.message);
    setMsg(`✅ Status updated to "${newStatus}"`);
    refresh();
  }

  const filtered = bookings.filter((b) => {
    if (filter !== 'all') {
      if (filter === 'paid'        && b.payment_status !== 'paid')        return false;
      if (filter === 'unpaid'      && b.payment_status !== 'unpaid')      return false;
      if (filter === 'pending'     && b.status !== 'pending')             return false;
      if (filter === 'confirmed'   && b.status !== 'confirmed')           return false;
      if (filter === 'checked_out' && b.status !== 'checked_out')         return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const hay = `${b.profiles?.full_name || ''} ${b.profiles?.email || ''} ${b.rooms?.room_number || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const counts = {
    all:         bookings.length,
    paid:        bookings.filter((b) => b.payment_status === 'paid').length,
    unpaid:      bookings.filter((b) => b.payment_status === 'unpaid').length,
    pending:     bookings.filter((b) => b.status === 'pending').length,
    confirmed:   bookings.filter((b) => b.status === 'confirmed').length,
    checked_out: bookings.filter((b) => b.status === 'checked_out').length
  };

  const totalRevenue = bookings
    .filter((b) => b.payment_status === 'paid')
    .reduce((sum, b) => sum + Number(b.total_amount || 0), 0);

  return (
    <>
      <nav className="nav">
        <div className="brand">
          <span className="brand-icon">🛡️</span>
          <span>SBR · Admin</span>
        </div>
        <div className="row" style={{ marginLeft: 'auto' }}>
          <Link to="/admin">Dashboard</Link>
          <Link to="/admin/rooms">Rooms</Link>
          <Link to="/admin/users">Users</Link>
          <Link to="/admin/staff">Staff</Link>
          <Link to="/admin/bookings">Bookings</Link>
          <Link to="/admin/payments">Payments</Link>
        </div>
      </nav>

      <div className="page-pad">
        <div className="space-between" style={{ marginBottom: 20 }}>
          <h1>All Bookings ({bookings.length})</h1>
          {lastRefresh && (
            <span className="muted">Last refresh: {lastRefresh.toLocaleTimeString()}</span>
          )}
        </div>

        <div className="feature-grid" style={{ marginBottom: 24 }}>
          <StatMini icon="📅" label="Total"    value={counts.all} />
          <StatMini icon="✅" label="Paid"     value={counts.paid} />
          <StatMini icon="⏳" label="Unpaid"   value={counts.unpaid} />
          <StatMini icon="🕒" label="Pending"  value={counts.pending} />
          <StatMini icon="🎫" label="Confirmed" value={counts.confirmed} />
          <StatMini icon="💰" label="Revenue"  value={`₱${totalRevenue.toLocaleString()}`} />
        </div>

        <div className="neu-card">
          <div className="row" style={{ alignItems: 'center' }}>
            <div className="col">
              <input
                className="neu-input"
                placeholder="Search by guest name, email, or room number…"
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
                <option value="paid">Paid ({counts.paid})</option>
                <option value="unpaid">Unpaid ({counts.unpaid})</option>
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

        <div className="neu-card" style={{ marginTop: 20 }}>
          {loading && <p className="muted center">Loading…</p>}

          {!loading && filtered.length === 0 && (
            <p className="muted center">No bookings match your filter.</p>
          )}

          {!loading && filtered.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Guest</th>
                  <th>Room</th>
                  <th>Dates</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id}>
                    <td className="muted">{String(b.id).slice(0, 6)}…</td>
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
                    <td>
                      <span className="muted">
                        {b.check_in}
                        <br />
                        → {b.check_out}
                      </span>
                    </td>
                    <td>₱{Number(b.total_amount || 0).toLocaleString()}</td>
                    <td><span className={`pill ${b.payment_status}`}>{b.payment_status}</span></td>
                    <td><span className={`pill ${b.status}`}>{b.status}</span></td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        {b.payment_status !== 'paid' && (
                          <button
                            className="neu-button primary"
                            onClick={() => markPaid(b)}
                            style={{ padding: '6px 10px', fontSize: 12 }}
                          >
                            Mark Paid
                          </button>
                        )}
                        {b.status === 'confirmed' && (
                          <button
                            className="neu-button danger"
                            onClick={() => updateStatus(b, 'checked_out')}
                            style={{ padding: '6px 10px', fontSize: 12 }}
                          >
                            Check-out
                          </button>
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

function StatMini({ icon, label, value }) {
  return (
    <div className="feature-card" style={{ padding: '18px 16px' }}>
      <span className="feature-icon" style={{ fontSize: 26 }}>{icon}</span>
      <p className="muted" style={{ fontSize: 12 }}>{label}</p>
      <h3 style={{ color: 'var(--accent)' }}>{value}</h3>
    </div>
  );
}