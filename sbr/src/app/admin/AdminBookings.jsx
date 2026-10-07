/* ============================================================
   src/app/admin/AdminBookings.jsx
   Reservations — lahat ng icons Font Awesome.
   ============================================================ */

import { useEffect, useState } from 'react';
import { supabase } from '../../supabase.js';
import AdminLayout from './AdminLayout.jsx';

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  async function refresh() {
    try {
      setErr('');
      const { data, error } = await supabase
        .from('bookings')
        .select('*, profiles(full_name,email,phone), rooms(room_number,room_type,price)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBookings(data || []);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
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
        .from('payments').select('id').eq('booking_id', booking.id).maybeSingle();

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

      setMsg('Booking marked as paid');
      refresh();
    } catch (e) { setErr(e.message); }
  }

  async function updateStatus(booking, newStatus) {
    if (!confirm(`Change status to "${newStatus}"?`)) return;
    setErr(''); setMsg('');
    const { error } = await supabase.from('bookings').update({ status: newStatus }).eq('id', booking.id);
    if (error) return setErr(error.message);
    setMsg(`Status updated to "${newStatus}"`);
    refresh();
  }

  const filtered = bookings.filter((b) => {
    if (filter !== 'all') {
      if (filter === 'paid' && b.payment_status !== 'paid') return false;
      if (filter === 'unpaid' && b.payment_status !== 'unpaid') return false;
      if (filter === 'pending' && b.status !== 'pending') return false;
      if (filter === 'confirmed' && b.status !== 'confirmed') return false;
      if (filter === 'checked_out' && b.status !== 'checked_out') return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const hay = `${b.profiles?.full_name || ''} ${b.profiles?.email || ''} ${b.rooms?.room_number || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const counts = {
    all: bookings.length,
    paid: bookings.filter((b) => b.payment_status === 'paid').length,
    unpaid: bookings.filter((b) => b.payment_status === 'unpaid').length,
    pending: bookings.filter((b) => b.status === 'pending').length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    checked_out: bookings.filter((b) => b.status === 'checked_out').length
  };

  const totalRevenue = bookings
    .filter((b) => b.payment_status === 'paid')
    .reduce((s, b) => s + Number(b.total_amount || 0), 0);

  return (
    <AdminLayout>
      <div className="admin-welcome">
        <h1>Reservations</h1>
        <p>Lahat ng bookings mula sa mga guests.</p>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat-card blue">
          <div className="admin-stat-top">
            <span className="admin-stat-label">Total Bookings</span>
            <span className="admin-stat-icon"><i className="fa-solid fa-calendar-check"></i></span>
          </div>
          <div>
            <div className="admin-stat-value">{counts.all}</div>
            <div className="admin-stat-sub">{counts.pending} pending</div>
          </div>
        </div>
        <div className="admin-stat-card green">
          <div className="admin-stat-top">
            <span className="admin-stat-label">Paid</span>
            <span className="admin-stat-icon"><i className="fa-solid fa-circle-check"></i></span>
          </div>
          <div>
            <div className="admin-stat-value">{counts.paid}</div>
            <div className="admin-stat-sub">{counts.confirmed} confirmed</div>
          </div>
        </div>
        <div className="admin-stat-card orange">
          <div className="admin-stat-top">
            <span className="admin-stat-label">Unpaid</span>
            <span className="admin-stat-icon"><i className="fa-solid fa-hourglass-half"></i></span>
          </div>
          <div>
            <div className="admin-stat-value">{counts.unpaid}</div>
            <div className="admin-stat-sub">Awaiting payment</div>
          </div>
        </div>
        <div className="admin-stat-card purple">
          <div className="admin-stat-top">
            <span className="admin-stat-label">Revenue</span>
            <span className="admin-stat-icon"><i className="fa-solid fa-peso-sign"></i></span>
          </div>
          <div>
            <div className="admin-stat-value">₱{totalRevenue.toLocaleString()}</div>
            <div className="admin-stat-sub">From paid bookings</div>
          </div>
        </div>
      </div>

      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <div className="row" style={{ alignItems: 'center' }}>
          <div className="col">
            <input className="admin-input" placeholder="Search guest name, email, or room…"
              value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 0 }} />
          </div>
          <div className="col" style={{ flex: '0 0 220px' }}>
            <select className="admin-select" value={filter}
              onChange={(e) => setFilter(e.target.value)} style={{ marginBottom: 0 }}>
              <option value="all">All ({counts.all})</option>
              <option value="paid">Paid ({counts.paid})</option>
              <option value="unpaid">Unpaid ({counts.unpaid})</option>
              <option value="pending">Pending ({counts.pending})</option>
              <option value="confirmed">Confirmed ({counts.confirmed})</option>
              <option value="checked_out">Checked out ({counts.checked_out})</option>
            </select>
          </div>
          <button className="app-btn app-btn-secondary" onClick={refresh}>
            <i className="fa-solid fa-rotate"></i> Refresh
          </button>
        </div>
      </div>

      {err && <p className="admin-error" style={{ marginBottom: 12 }}>{err}</p>}
      {msg && <p className="admin-success" style={{ marginBottom: 12 }}>{msg}</p>}

      <div className="admin-panel">
        <div className="admin-panel-header">
          <h3 className="admin-panel-title">
            <i className="fa-solid fa-calendar-check"></i> All Bookings ({filtered.length})
          </h3>
        </div>

        {loading && <p className="muted center">Loading…</p>}
        {!loading && filtered.length === 0 && <p className="muted center">No bookings match.</p>}

        {!loading && filtered.length > 0 && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th><th>Guest</th><th>Room</th>
                <th>Check-in</th><th>Check-out</th><th>Total</th>
                <th>Payment</th><th>Status</th><th>Actions</th>
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
                  </td>
                  <td>Room {b.rooms?.room_number}</td>
                  <td className="muted">{b.check_in}</td>
                  <td className="muted">{b.check_out}</td>
                  <td>₱{Number(b.total_amount || 0).toLocaleString()}</td>
                  <td>
                    <span className={`admin-pill ${b.payment_status}`}>{b.payment_status}</span>
                  </td>
                  <td>
                    <span className={`admin-pill ${b.status}`}>{b.status}</span>
                  </td>
                  <td>
                    {b.payment_status !== 'paid' && (
                      <button className="app-btn app-btn-primary"
                        onClick={() => markPaid(b)}
                        style={{ padding: '6px 10px', fontSize: 12 }}>
                        <i className="fa-solid fa-check"></i> Mark Paid
                      </button>
                    )}
                    {b.status === 'confirmed' && (
                      <button className="app-btn app-btn-danger"
                        onClick={() => updateStatus(b, 'checked_out')}
                        style={{ padding: '6px 10px', fontSize: 12, marginLeft: 4 }}>
                        <i className="fa-solid fa-door-open"></i> Check-out
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}