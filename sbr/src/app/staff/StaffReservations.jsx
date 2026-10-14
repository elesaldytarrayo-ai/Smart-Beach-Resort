// Imports — React hooks, Supabase, and staff layout wrapper
import { useEffect, useState } from 'react';
import { supabase } from '../../supabase.js';
import StaffLayout from './StaffLayout.jsx';

// ============================================================
// CONSTANTS
// ============================================================

const REFRESH_INTERVAL_MS = 10000; // Refresh reservations every 10 seconds

// Filter definitions for the filter chips
const FILTERS = [
  { key: 'all', label: 'All', icon: 'list' },
  { key: 'pending', label: 'Pending', icon: 'clock' },
  { key: 'confirmed', label: 'Confirmed', icon: 'ticket' },
  { key: 'checked_out', label: 'Checked out', icon: 'door-open' }
];

// ============================================================
// REUSABLE SUB-COMPONENTS
// ============================================================

// StatCard — displays a single mini statistic on the reservations dashboard
function StatCard({ icon, color, label, value }) {
  return (
    <div className="staff-mini-stat">
      <div className={`staff-mini-stat-icon ${color}`}>
        <i className={icon}></i>
      </div>
      <div className="staff-mini-stat-body">
        <div className="staff-mini-stat-label">{label}</div>
        <div className="staff-mini-stat-value">{value}</div>
      </div>
    </div>
  );
}

// FilterChip — renders a single filter chip with an active state and count
function FilterChip({ filter, label, icon, count, isActive, onClick }) {
  return (
    <button
      className={`staff-chip ${isActive ? 'active' : ''}`}
      onClick={() => onClick(filter)}
    >
      <i className={icon}></i> {label}
      <span className="staff-chip-count">{count}</span>
    </button>
  );
}

// PaymentPill — renders a colored pill for the payment status
function PaymentPill({ status }) {
  const icon = status === 'paid' ? 'circle-check' : 'hourglass-half';
  return (
    <span className={`staff-pill ${status}`}>
      <i className={icon}></i> {status}
    </span>
  );
}

// StatusPill — renders a colored pill for the booking status
function StatusPill({ status }) {
  let icon = 'clock';
  if (status === 'confirmed') icon = 'ticket';
  else if (status === 'checked_out') icon = 'door-open';

  return (
    <span className={`staff-pill ${status}`}>
      <i className={icon}></i> {status}
    </span>
  );
}

// ReservationRow — renders a single row of the reservations table with actions
function ReservationRow({ booking, updatingId, onSetStatus }) {
  const isUpdating = updatingId === booking.id;

  return (
    <tr>
      <td>
        <div className="staff-cell-main">{booking.profiles?.full_name || '—'}</div>
        <div className="staff-cell-sub">{booking.profiles?.email}</div>
      </td>
      <td>
        <div className="staff-cell-main">Room {booking.rooms?.room_number}</div>
        <div className="staff-cell-sub">{booking.rooms?.room_type}</div>
      </td>
      <td className="staff-muted">{booking.check_in}</td>
      <td className="staff-muted">{booking.check_out}</td>
      <td><PaymentPill status={booking.payment_status} /></td>
      <td><StatusPill status={booking.status} /></td>
      <td>
        <div className="staff-row-actions staff-row-end">

          {/* Pending → Confirm button */}
          {booking.status === 'pending' && (
            <button
              className="staff-btn staff-btn-primary staff-btn-sm"
              onClick={() => onSetStatus(booking, 'confirmed')}
              disabled={isUpdating}
            >
              <i className={isUpdating ? 'spinner' : 'check'}></i>
              {isUpdating ? 'Confirming…' : 'Confirm'}
            </button>
          )}

          {/* Confirmed → Check-out button */}
          {booking.status === 'confirmed' && (
            <button
              className="staff-btn staff-btn-danger staff-btn-sm"
              onClick={() => onSetStatus(booking, 'checked_out')}
              disabled={isUpdating}
            >
              <i className={isUpdating ? 'spinner' : 'door-open'}></i>
              {isUpdating ? 'Checking out…' : 'Check-out'}
            </button>
          )}

          {/* Checked out → Done label */}
          {booking.status === 'checked_out' && (
            <span className="staff-muted staff-sm">
              <i className="circle-check staff-gap"></i> Done
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

// ============================================================
// MAIN STAFF RESERVATIONS COMPONENT
// ============================================================

// StaffReservations — displays all reservations with filters, search, and actions
export default function StaffReservations() {

  // State — bookings, filter, search, loading, updatingId, error, message
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // ============================================================
  // DATA FETCHING
  // ============================================================

  // fetchReservations — fetches all reservations from the database
  // isInitialLoad controls whether to show the loading spinner
  async function fetchReservations(isInitialLoad = false) {
    if (isInitialLoad) setLoading(true);
    try {
      setError('');
      const { data, error: fetchError } = await supabase
        .from('bookings')
        .select('*, profiles(full_name, email, phone), rooms(room_number, room_type)')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setBookings(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  }

  // Load reservations on mount + auto-refresh every 10 seconds
  useEffect(() => {
    fetchReservations(true);
    const interval = setInterval(() => fetchReservations(false), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================
  // ACTIONS
  // ============================================================

  // handleSetStatus — updates the status of a booking after confirmation
  async function handleSetStatus(booking, newStatus) {
    const confirmed = window.confirm(`Change status to "${newStatus}"?`);
    if (!confirmed) return;

    setError('');
    setMessage('');
    setUpdatingId(booking.id);

    try {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', booking.id);

      if (updateError) throw updateError;

      setMessage(`Status updated to "${newStatus}"`);
      await fetchReservations(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  // ============================================================
  // DERIVED DATA
  // ============================================================

  // Counts per status for stat cards and filter chips
  const counts = {
    all: bookings.length,
    pending: bookings.filter((b) => b.status === 'pending').length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    checked_out: bookings.filter((b) => b.status === 'checked_out').length
  };

  // Bookings after applying filter and search
  const filteredBookings = bookings.filter((booking) => {
    if (filter !== 'all' && booking.status !== filter) return false;

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

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <StaffLayout>

      {/* Welcome header */}
      <div className="staff-welcome">
        <h1>Reservations</h1>
        <p>All bookings from guests. Auto-refreshes every 10 seconds.</p>
      </div>

      {/* Mini stats — total, pending, confirmed, checked out */}
      <div className="staff-mini-stats">
        <StatCard icon="calendar-check" color="blue"   label="Total" value={counts.all} />
        <StatCard icon="clock" color="orange" label="Pending" value={counts.pending} />
        <StatCard icon="ticket" color="green"  label="Confirmed" value={counts.confirmed} />
        <StatCard icon="door-open" color="purple" label="Checked out" value={counts.checked_out} />
      </div>

      <div className="staff-panel">
        <div className="staff-panel-header">
          <h3 className="staff-panel-title">
            <i className="calendar-check"></i> All Reservations
          </h3>
        </div>

        {/* Filter chips — all, pending, confirmed, checked out */}
        <div className="staff-chips">
          {FILTERS.map((f) => (
            <FilterChip
              key={f.key}
              filter={f.key}
              label={f.label}
              icon={f.icon}
              count={counts[f.key]}
              isActive={filter === f.key}
              onClick={setFilter}
            />
          ))}
        </div>

        {/* Toolbar — search bar and refresh button */}
        <div className="staff-toolbar">
          <div className="staff-toolbar-search">
            <i className="search"></i>
            <input
              placeholder="Search by guest name, email, or room…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="staff-btn staff-btn-secondary" onClick={() => fetchReservations(true)}>
            <i className="rotate"></i> Refresh
          </button>
        </div>

        {/* Feedback messages */}
        {error && <p className="staff-error">{error}</p>}
        {message && <p className="staff-success">{message}</p>}

        {/* Loading state */}
        {loading && (
          <div className="staff-loading">
            <i className="spinner"></i> Loading…
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredBookings.length === 0 && (
          <div className="staff-empty">
            <i className="calendar-xmark"></i>
            <div className="staff-empty-title">No reservations match</div>
            <div className="staff-empty-desc">Try adjusting your search or filter.</div>
          </div>
        )}

        {/* Reservations table */}
        {!loading && filteredBookings.length > 0 && (
          <table className="staff-table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Room</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Payment</th>
                <th>Status</th>
                <th className="staff-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map((booking) => (
                <ReservationRow
                  key={booking.id}
                  booking={booking}
                  updatingId={updatingId}
                  onSetStatus={handleSetStatus}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </StaffLayout>
  );
}