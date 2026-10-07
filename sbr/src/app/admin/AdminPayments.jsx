/* ============================================================
   src/app/admin/AdminPayments.jsx
   Payments — lahat ng icons Font Awesome.
   ============================================================ */

import { useEffect, useState } from 'react';
import { supabase } from '../../supabase.js';
import AdminLayout from './AdminLayout.jsx';

export default function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  async function refresh() {
    try {
      setErr('');
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          bookings (
            id, check_in, check_out, total_amount, payment_status, status,
            profiles (full_name, email, phone),
            rooms (room_number, room_type)
          )
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPayments(data || []);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, []);

  const filtered = payments.filter((p) => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [
        p.id, p.booking_id, p.reference, p.paymongo_id, p.method,
        p.bookings?.profiles?.full_name, p.bookings?.profiles?.email,
        p.bookings?.rooms?.room_number
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const counts = {
    all: payments.length,
    paid: payments.filter((p) => p.status === 'paid').length,
    pending: payments.filter((p) => p.status === 'pending').length,
    failed: payments.filter((p) => p.status === 'failed').length
  };

  const totalPaid = payments
    .filter((p) => p.status === 'paid')
    .reduce((s, p) => s + Number(p.amount || 0), 0);

  const paymongoCount = payments.filter((p) => p.method === 'paymongo').length;

  return (
    <AdminLayout>
      <div className="admin-welcome">
        <h1>Payments</h1>
        <p>Lahat ng payment transactions (PayMongo + manual).</p>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat-card blue">
          <div className="admin-stat-top">
            <span className="admin-stat-label">Total Payments</span>
            <span className="admin-stat-icon"><i className="fa-solid fa-credit-card"></i></span>
          </div>
          <div>
            <div className="admin-stat-value">{counts.all}</div>
            <div className="admin-stat-sub">{paymongoCount} via PayMongo</div>
          </div>
        </div>
        <div className="admin-stat-card green">
          <div className="admin-stat-top">
            <span className="admin-stat-label">Paid</span>
            <span className="admin-stat-icon"><i className="fa-solid fa-circle-check"></i></span>
          </div>
          <div>
            <div className="admin-stat-value">{counts.paid}</div>
            <div className="admin-stat-sub">Completed</div>
          </div>
        </div>
        <div className="admin-stat-card orange">
          <div className="admin-stat-top">
            <span className="admin-stat-label">Pending</span>
            <span className="admin-stat-icon"><i className="fa-solid fa-hourglass-half"></i></span>
          </div>
          <div>
            <div className="admin-stat-value">{counts.pending}</div>
            <div className="admin-stat-sub">Awaiting</div>
          </div>
        </div>
        <div className="admin-stat-card purple">
          <div className="admin-stat-top">
            <span className="admin-stat-label">Total Revenue</span>
            <span className="admin-stat-icon"><i className="fa-solid fa-peso-sign"></i></span>
          </div>
          <div>
            <div className="admin-stat-value">₱{totalPaid.toLocaleString()}</div>
            <div className="admin-stat-sub">All-time</div>
          </div>
        </div>
      </div>

      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <div className="row" style={{ alignItems: 'center' }}>
          <div className="col">
            <input className="admin-input" placeholder="Search ID, guest, reference…"
              value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 0 }} />
          </div>
          <div className="col" style={{ flex: '0 0 180px' }}>
            <select className="admin-select" value={filter}
              onChange={(e) => setFilter(e.target.value)} style={{ marginBottom: 0 }}>
              <option value="all">All ({counts.all})</option>
              <option value="paid">Paid ({counts.paid})</option>
              <option value="pending">Pending ({counts.pending})</option>
              <option value="failed">Failed ({counts.failed})</option>
            </select>
          </div>
          <button className="app-btn app-btn-secondary" onClick={refresh}>
            <i className="fa-solid fa-rotate"></i> Refresh
          </button>
        </div>
      </div>

      {err && <p className="admin-error" style={{ marginBottom: 12 }}>{err}</p>}

      <div className="admin-panel" style={{ overflowX: 'auto' }}>
        <div className="admin-panel-header">
          <h3 className="admin-panel-title">
            <i className="fa-solid fa-credit-card"></i> All Payments ({filtered.length})
          </h3>
        </div>

        {loading && <p className="muted center">Loading…</p>}
        {!loading && filtered.length === 0 && <p className="muted center">No payments yet.</p>}

        {!loading && filtered.length > 0 && (
          <table className="admin-table" style={{ minWidth: 1100 }}>
            <thead>
              <tr>
                <th>Payment ID</th><th>Booking ID</th><th>Guest</th><th>Room</th>
                <th>Amount</th><th>Method</th><th>Status</th>
                <th>Reference</th><th>PayMongo ID</th><th>Paid at</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const guest = p.bookings?.profiles;
                const room = p.bookings?.rooms;
                return (
                  <tr key={p.id}>
                    <td className="muted" title={p.id}>{String(p.id).slice(0, 8)}…</td>
                    <td className="muted" title={p.booking_id}>{String(p.booking_id || '').slice(0, 8)}…</td>
                    <td>
                      <strong>{guest?.full_name || '—'}</strong>
                      <br />
                      <span className="muted">{guest?.email}</span>
                    </td>
                    <td>Room {room?.room_number}</td>
                    <td><strong>₱{Number(p.amount || 0).toLocaleString()}</strong></td>
                    <td>
                      <i className={
                        p.method === 'paymongo' ? 'fa-solid fa-mobile-screen' :
                        p.method === 'manual-admin' ? 'fa-solid fa-user-shield' :
                        'fa-solid fa-credit-card'
                      } style={{ marginRight: 6 }}></i>
                      {p.method || '—'}
                    </td>
                    <td>
                      <span className={`admin-pill ${p.status}`}>{p.status}</span>
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}