/* ============================================================
   src/app/staff/StaffReservations.jsx
   Reservations list — with StaffLayout.
   ============================================================ */

import { useEffect, useState } from 'react';
import { supabase } from '../../supabase.js';
import StaffLayout from './StaffLayout.jsx';

export default function StaffReservations() {
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
        .select('*, profiles(full_name,email,phone), rooms(room_number,room_type)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBookings(data || []);
    } catch (e) {
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

  async function setStatus(booking, status) {
    if (!confirm(`Change status to "${status}"?`)) return;
    setErr(''); setMsg('');
    const { error } = await supabase
      .from('bookings').update({ status }).eq('id', booking.id);
    if (error) return setErr(error.message);
    setMsg(`Status updated to "${status}"`);
    refresh();
  }

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
    all: bookings.length,
    pending: bookings.filter((b) => b.status === 'pending').length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    checked_out: bookings.filter((b) => b.status === 'checked_out').length
  };

  return (
    <StaffLayout>
      <div className="admin-welcome">
        <h1>Reservations</h1>
        <p>Lahat ng bookings mula sa guests. Auto-refresh every 10s.</p>
      </div>

      {/* Mini stats */}
      <div className="admin-mini-stats">
        <div className="admin-mini-stat">
          <div className="admin-mini-stat-icon blue">
            <i className="fa-solid fa-calendar-check"></i>
          </div>
          <div className="admin-mini-stat-body">
            <div className="admin-mini-stat-label">Total</div>
            <div className="admin-mini-stat-value">{counts.all}</div>
          </div>
        </div>
        <div className="admin-mini-stat">
          <div className="admin-mini-stat-icon orange">
            <i className="fa-solid fa-clock"></i>
          </div>
          <div className="admin-mini-stat-body">
            <div className="admin-mini-stat-label">Pending</div>
            <div className="admin-mini-stat-value">{counts.pending}</div>
          </div>
        </div>
        <div className="admin-mini-stat">
          <div className="admin-mini-stat-icon green">
            <i className="fa-solid fa-ticket"></i>
          </div>
          <div className="admin-mini-stat-body">
            <div className="admin-mini-stat-label">Confirmed</div>
            <div className="admin-mini-stat-value">{counts.confirmed}</div>
          </div>
        </div>
        <div className="admin-mini-stat">
          <div className="admin-mini-stat-icon purple">
            <i className="fa-solid fa-door-open"></i>
          </div>
          <div className="admin-mini-stat-body">
            <div className="admin-mini-stat-label">Checked out</div>
            <div className="admin-mini-stat-value">{counts.checked_out}</div>
          </div>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-header">
          <h3 className="admin-panel-title">
            <i className="fa-solid fa-calendar-check"></i> All Reservations
          </h3>
        </div>

        {/* Filter chips */}
        <div className="admin-chips">
          <button className={`admin-chip ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}>
            <i className="fa-solid fa-list"></i> All
            <span className="admin-chip-count">{counts.all}</span>
          </button>
          <button className={`admin-chip ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}>
            <i className="fa-solid fa-clock"></i> Pending
            <span className="admin-chip-count">{counts.pending}</span>
          </button>
          <button className={`admin-chip ${filter === 'confirmed' ? 'active' : ''}`}
            onClick={() => setFilter('confirmed')}>
            <i className="fa-solid fa-ticket"></i> Confirmed
            <span className="admin-chip-count">{counts.confirmed}</span>
          </button>
          <button className={`admin-chip ${filter === 'checked_out' ? 'active' : ''}`}
            onClick={() => setFilter('checked_out')}>
            <i className="fa-solid fa-door-open"></i> Checked out
            <span className="admin-chip-count">{counts.checked_out}</span>
          </button>
        </div>

        {/* Toolbar */}
        <div className="admin-toolbar">
          <div className="admin-toolbar-search">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input
              placeholder="Search by guest name, email, or room…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="app-btn app-btn-secondary" onClick={refresh}>
            <i className="fa-solid fa-rotate"></i> Refresh
          </button>
        </div>

        {err && <p className="admin-error">{err}</p>}
        {msg && <p className="admin-success">{msg}</p>}

        {loading && (
          <div className="admin-loading">
            <i className="fa-solid fa-spinner"></i> Loading…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="admin-empty">
            <i className="fa-solid fa-calendar-xmark"></i>
            <div className="admin-empty-title">No reservations match</div>
            <div className="admin-empty-desc">
              Try adjusting your search or filter.
            </div>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Room</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Payment</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div className="cell-main">{b.profiles?.full_name || '—'}</div>
                    <div className="cell-sub">{b.profiles?.email}</div>
                  </td>
                  <td>
                    <div className="cell-main">Room {b.rooms?.room_number}</div>
                    <div className="cell-sub">{b.rooms?.room_type}</div>
                  </td>
                  <td className="muted">{b.check_in}</td>
                  <td className="muted">{b.check_out}</td>
                  <td>
                    <span className={`admin-pill ${b.payment_status}`}>
                      <i className={
                        b.payment_status === 'paid' ? 'fa-solid fa-circle-check' :
                        'fa-solid fa-hourglass-half'
                      }></i>
                      {b.payment_status}
                    </span>
                  </td>
                  <td>
                    <span className={`admin-pill ${b.status}`}>
                      <i className={
                        b.status === 'confirmed' ? 'fa-solid fa-ticket' :
                        b.status === 'checked_out' ? 'fa-solid fa-door-open' :
                        'fa-solid fa-clock'
                      }></i>
                      {b.status}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                      {b.status === 'pending' && (
                        <button
                          className="app-btn app-btn-primary app-btn-sm"
                          onClick={() => setStatus(b, 'confirmed')}
                        >
                          <i className="fa-solid fa-check"></i> Confirm
                        </button>
                      )}
                      {b.status === 'confirmed' && (
                        <button
                          className="app-btn app-btn-danger app-btn-sm"
                          onClick={() => setStatus(b, 'checked_out')}
                        >
                          <i className="fa-solid fa-door-open"></i> Check-out
                        </button>
                      )}
                      {b.status === 'checked_out' && (
                        <span className="muted" style={{ fontSize: 12 }}>
                          <i className="fa-solid fa-circle-check"></i> Done
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </StaffLayout>
  );
}