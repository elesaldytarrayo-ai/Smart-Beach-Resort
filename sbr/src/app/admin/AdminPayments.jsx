/* ============================================================
   src/app/AdminPayments.jsx
   Admin — lahat ng payments mula sa Supabase.
   Pinapakita ang LAHAT ng columns:
     Payment ID, Booking ID, Guest, Room, Amount, Currency,
     Method, Status, Reference, PayMongo ID, Paid at, Created.
   ============================================================ */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../supabase.js';

export default function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);

  /* ------------------------------------------------------------
     Load ALL payments with joined booking + guest + room info
     ------------------------------------------------------------ */
  async function refresh() {
    try {
      setErr('');
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          bookings (
            id,
            check_in,
            check_out,
            total_amount,
            payment_status,
            status,
            profiles (full_name, email, phone),
            rooms (room_number, room_type)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      console.log('ADMIN PAYMENTS:', data);
      setPayments(data || []);
      setLastRefresh(new Date());
    } catch (e) {
      console.error('LOAD PAYMENTS ERROR:', e);
      setErr(e.message || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, []);

  const filtered = payments.filter((p) => {
    if (filter !== 'all') {
      if (filter === 'paid'    && p.status !== 'paid')    return false;
      if (filter === 'pending' && p.status !== 'pending') return false;
      if (filter === 'failed'  && p.status !== 'failed')  return false;
      if (filter === 'expired' && p.status !== 'expired') return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const hay = [
        p.id,
        p.booking_id,
        p.reference,
        p.paymongo_id,
        p.method,
        p.bookings?.profiles?.full_name,
        p.bookings?.profiles?.email,
        p.bookings?.rooms?.room_number
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const counts = {
    all:     payments.length,
    paid:    payments.filter((p) => p.status === 'paid').length,
    pending: payments.filter((p) => p.status === 'pending').length,
    failed:  payments.filter((p) => p.status === 'failed').length,
    expired: payments.filter((p) => p.status === 'expired').length
  };

  const totalPaid = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const paymongoCount = payments.filter((p) => p.method === 'paymongo').length;

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
          <h1>All Payments ({payments.length})</h1>
          {lastRefresh && (
            <span className="muted">Last refresh: {lastRefresh.toLocaleTimeString()}</span>
          )}
        </div>

        {/* Summary */}
        <div className="feature-grid" style={{ marginBottom: 24 }}>
          <StatMini icon="💳" label="Total"     value={counts.all} />
          <StatMini icon="✅" label="Paid"      value={counts.paid} />
          <StatMini icon="⏳" label="Pending"   value={counts.pending} />
          <StatMini icon="❌" label="Failed"    value={counts.failed} />
          <StatMini icon="💰" label="Revenue"   value={`₱${totalPaid.toLocaleString()}`} />
          <StatMini icon="📱" label="PayMongo"  value={paymongoCount} />
        </div>

        {/* Filters */}
        <div className="neu-card">
          <div className="row" style={{ alignItems: 'center' }}>
            <div className="col">
              <input
                className="neu-input"
                placeholder="Search by ID, booking ID, guest, room, or reference…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ marginBottom: 0 }}
              />
            </div>
            <div className="col" style={{ flex: '0 0 200px' }}>
              <select
                className="neu-select"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{ marginBottom: 0 }}
              >
                <option value="all">All ({counts.all})</option>
                <option value="paid">Paid ({counts.paid})</option>
                <option value="pending">Pending ({counts.pending})</option>
                <option value="failed">Failed ({counts.failed})</option>
                <option value="expired">Expired ({counts.expired})</option>
              </select>
            </div>
            <button className="neu-button" onClick={refresh}>🔄 Refresh</button>
          </div>
        </div>

        {err && <p className="error-text" style={{ marginTop: 12 }}>⚠️ {err}</p>}

        {/* Payments table — FULL columns */}
        <div className="neu-card" style={{ marginTop: 20, overflowX: 'auto' }}>
          {loading && <p className="muted center">Loading…</p>}

          {!loading && filtered.length === 0 && (
            <p className="muted center">No payments match your filter.</p>
          )}

          {!loading && filtered.length > 0 && (
            <table style={{ minWidth: 1200 }}>
              <thead>
                <tr>
                  <th>Payment ID</th>
                  <th>Booking ID</th>
                  <th>Guest</th>
                  <th>Room</th>
                  <th>Amount</th>
                  <th>Currency</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Reference</th>
                  <th>PayMongo ID</th>
                  <th>Paid at</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const guest = p.bookings?.profiles;
                  const room  = p.bookings?.rooms;

                  return (
                    <tr key={p.id}>
                      <td className="muted" title={p.id}>
                        {String(p.id).slice(0, 8)}…
                      </td>
                      <td className="muted" title={p.booking_id}>
                        {String(p.booking_id || '').slice(0, 8)}…
                      </td>
                      <td>
                        <strong>{guest?.full_name || '—'}</strong>
                        <br />
                        <span className="muted">{guest?.email || ''}</span>
                      </td>
                      <td>
                        {room?.room_number ? `#${room.room_number}` : '—'}
                        {room?.room_type && (
                          <>
                            <br />
                            <span className="muted">{room.room_type}</span>
                          </>
                        )}
                      </td>
                      <td>
                        <strong>₱{Number(p.amount || 0).toLocaleString()}</strong>
                      </td>
                      <td className="muted">{p.currency || 'PHP'}</td>
                      <td>
                        <span className={`pill ${p.method === 'paymongo' ? 'confirmed' : ''}`}>
                          {p.method || '—'}
                        </span>
                      </td>
                      <td>
                        <span className={`pill ${p.status}`}>{p.status}</span>
                      </td>
                      <td className="muted" title={p.reference || ''}>
                        {p.reference ? String(p.reference).slice(0, 12) + '…' : '—'}
                      </td>
                      <td className="muted" title={p.paymongo_id || ''}>
                        {p.paymongo_id ? String(p.paymongo_id).slice(0, 12) + '…' : '—'}
                      </td>
                      <td className="muted">
                        {p.paid_at ? new Date(p.paid_at).toLocaleString() : '—'}
                      </td>
                      <td className="muted">
                        {p.created_at ? new Date(p.created_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>
          💡 Tip: i-hover ang truncated IDs para makita ang buong value.
        </p>
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