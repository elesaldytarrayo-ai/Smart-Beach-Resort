// Imports
import { useEffect, useState } from 'react';
import { supabase, secureSelect, secureInsert, secureUpdate } from '../../supabase.js';
import AdminLayout from './AdminLayout.jsx';

const REFRESH_INTERVAL_MS = 10000;

const FILTER_PREDICATES = {
  all: () => true,
  paid: (b) => b.payment_status === 'paid',
  unpaid: (b) => b.payment_status === 'unpaid',
  pending: (b) => b.status === 'pending',
  confirmed: (b) => b.status === 'confirmed',
  checked_out: (b) => b.status === 'checked_out'
};

function StatCard({ color, icon, label, value, sub }) {
  return (
    <div className={`admin-stat-card ${color}`}>
      <div className="admin-stat-top">
        <span className="admin-stat-label">{label}</span>
        <span className="admin-stat-icon"><i className={icon}></i></span>
      </div>
      <div>
        <div className="admin-stat-value">{value}</div>
        <div className="admin-stat-sub">{sub}</div>
      </div>
    </div>
  );
}

function StatusPill({ value }) {
  return <span className={`admin-pill ${value}`}>{value}</span>;
}

function ReservationRow({ booking, updatingId, onMarkPaid, onUpdateStatus }) {
  const isUpdating = updatingId === booking.id;
  const isUnpaid = booking.payment_status !== 'paid';
  const isConfirmed = booking.status === 'confirmed';

  return (
    <tr>
      <td className="admin-muted admin-mono">{String(booking.id).slice(0, 6)}…</td>
      <td>
        <div className="admin-cell-main">{booking.profiles?.full_name || '—'}</div>
        <div className="admin-cell-sub">{booking.profiles?.email}</div>
      </td>
      <td>Room {booking.rooms?.room_number}</td>
      <td className="admin-muted">{booking.check_in}</td>
      <td className="admin-muted">{booking.check_out}</td>
      <td>₱{Number(booking.total_amount || 0).toLocaleString()}</td>
      <td><StatusPill value={booking.payment_status} /></td>
      <td><StatusPill value={booking.status} /></td>
      <td>
        <div className="admin-row-actions">
          {isUnpaid && (
            <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => onMarkPaid(booking)} disabled={isUpdating}>
              <i className={isUpdating ? 'spinner' : 'check'}></i>
              {isUpdating ? 'Marking…' : 'Mark Paid'}
            </button>
          )}
          {isConfirmed && (
            <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => onUpdateStatus(booking, 'checked_out')} disabled={isUpdating}>
              <i className={isUpdating ? 'spinner' : 'door-open'}></i>
              {isUpdating ? 'Checking…' : 'Check-out'}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function fetchBookings(isInitialLoad = false) {
    if (isInitialLoad) setLoading(true);
    try {
      setError('');

      const data = await secureSelect('bookings', {
        columns: '*, profiles(full_name, email), rooms(room_number, room_type, price)',
        order: { column: 'created_at', ascending: false }
      });

      setBookings(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  }

  useEffect(() => {
    fetchBookings(true);
    const interval = setInterval(() => fetchBookings(false), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleMarkPaid(booking) {
    const confirmed = window.confirm(
      `Mark booking as PAID?\n\nGuest: ${booking.profiles?.full_name}\nAmount: ₱${booking.total_amount}`
    );
    if (!confirmed) return;

    setError('');
    setMessage('');
    setUpdatingId(booking.id);

    try {
      await secureUpdate('bookings', { id: booking.id }, { payment_status: 'paid', status: 'confirmed' });

      const existing = await secureSelect('payments', {
        columns: 'id',
        match: { booking_id: booking.id }
      });

      if (!existing || existing.length === 0) {
        await secureInsert('payments', {
          booking_id: booking.id,
          amount: booking.total_amount,
          method: 'manual-admin',
          status: 'paid',
          currency: 'PHP',
          paid_at: new Date().toISOString()
        });
      }

      setMessage('Booking marked as paid.');
      await fetchBookings(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleUpdateStatus(booking, newStatus) {
    const confirmed = window.confirm(`Change status to "${newStatus}"?`);
    if (!confirmed) return;

    setError('');
    setMessage('');
    setUpdatingId(booking.id);

    try {
      await secureUpdate('bookings', { id: booking.id }, { status: newStatus });
      setMessage(`Status updated to "${newStatus}".`);
      await fetchBookings(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  const counts = {
    all: bookings.length,
    paid: bookings.filter(FILTER_PREDICATES.paid).length,
    unpaid: bookings.filter(FILTER_PREDICATES.unpaid).length,
    pending: bookings.filter(FILTER_PREDICATES.pending).length,
    confirmed: bookings.filter(FILTER_PREDICATES.confirmed).length,
    checked_out: bookings.filter(FILTER_PREDICATES.checked_out).length
  };

  const totalRevenue = bookings
    .filter(FILTER_PREDICATES.paid)
    .reduce((sum, b) => sum + Number(b.total_amount || 0), 0);

  const filteredBookings = bookings.filter((booking) => {
    const matchesFilter = FILTER_PREDICATES[filter]?.(booking) ?? true;
    if (!matchesFilter) return false;

    if (search.trim()) {
      const query = search.toLowerCase().trim();
      const searchable = `
        ${booking.profiles?.full_name || ''}
        ${booking.profiles?.email || ''}
        ${booking.rooms?.room_number || ''}
      `.toLowerCase();
      if (!searchable.includes(query)) return false;
    }
    return true;
  });

  return (
    <AdminLayout>

      <div className="admin-welcome">
        <h1>Reservations</h1>
        <p>All bookings from guests.</p>
      </div>

      <div className="admin-stat-grid">
        <StatCard color="blue"   icon="calendar-check" label="Total Bookings" value={counts.all}                         sub={`${counts.pending} pending`} />
        <StatCard color="green"  icon="circle-check"   label="Paid"           value={counts.paid}                        sub={`${counts.confirmed} confirmed`} />
        <StatCard color="orange" icon="hourglass-half" label="Unpaid"         value={counts.unpaid}                      sub="Awaiting payment" />
        <StatCard color="purple" icon="peso-sign"      label="Revenue"        value={`₱${totalRevenue.toLocaleString()}`} sub="From paid bookings" />
      </div>

      <div className="admin-panel admin-gap-bottom">
        <div className="admin-row admin-row-center">
          <div className="admin-col">
            <input
              className="admin-input"
              placeholder="Search guest name, email, or room…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="admin-col admin-col-fixed">
            <select className="admin-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All ({counts.all})</option>
              <option value="paid">Paid ({counts.paid})</option>
              <option value="unpaid">Unpaid ({counts.unpaid})</option>
              <option value="pending">Pending ({counts.pending})</option>
              <option value="confirmed">Confirmed ({counts.confirmed})</option>
              <option value="checked_out">Checked out ({counts.checked_out})</option>
            </select>
          </div>
          <button className="admin-btn admin-btn-secondary" onClick={() => fetchBookings(true)}>
            <i className="rotate"></i> Refresh
          </button>
        </div>
      </div>

      {error && <p className="admin-error admin-gap-top">{error}</p>}
      {message && <p className="admin-success admin-gap-top">{message}</p>}

      <div className="admin-panel admin-scroll-wrapper">
        <div className="admin-panel-header">
          <h3 className="admin-panel-title">
            <i className="calendar-check"></i> All Bookings ({filteredBookings.length})
          </h3>
        </div>

        {loading && <p className="admin-muted admin-center">Loading…</p>}

        {!loading && filteredBookings.length === 0 && (
          <p className="admin-muted admin-center">No bookings match.</p>
        )}

        {!loading && filteredBookings.length > 0 && (
          <table className="admin-table admin-table-wide">
            <thead>
              <tr>
                <th>ID</th>
                <th>Guest</th>
                <th>Room</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map((booking) => (
                <ReservationRow
                  key={booking.id}
                  booking={booking}
                  updatingId={updatingId}
                  onMarkPaid={handleMarkPaid}
                  onUpdateStatus={handleUpdateStatus}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

    </AdminLayout>
  );
}