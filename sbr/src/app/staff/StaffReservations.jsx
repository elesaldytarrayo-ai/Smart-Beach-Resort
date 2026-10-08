import { useEffect, useState } from 'react';
import { supabase } from '../../supabase.js';
import StaffLayout from './StaffLayout.jsx';

// --- Constants ---
const REFRESH_INTERVAL_MS = 10000;

const FILTERS = [
  { key: 'all',         label: 'All',         icon: 'fa-list' },
  { key: 'pending',     label: 'Pending',     icon: 'fa-clock' },
  { key: 'confirmed',   label: 'Confirmed',   icon: 'fa-ticket' },
  { key: 'checked_out', label: 'Checked out', icon: 'fa-door-open' }
];

// REUSABLE SUB-COMPONENTS
// StatCard Component
// Displays a single mini statistic on the reservations dashboard.
function StatCard({ icon, color, label, value }) {
  return (
    <div className="admin-mini-stat">
      <div className={`admin-mini-stat-icon ${color}`}>
        <i className={`fa-solid ${icon}`}></i>
      </div>
      <div className="admin-mini-stat-body">
        <div className="admin-mini-stat-label">{label}</div>
        <div className="admin-mini-stat-value">{value}</div>
      </div>
    </div>
  );
}

// FilterChip Component
// Renders a single filter chip with an active state and count.
function FilterChip({ filter, label, icon, count, isActive, onClick }) {
  return (
    <button
      className={`admin-chip ${isActive ? 'active' : ''}`}
      onClick={() => onClick(filter)}
    >
      <i className={`fa-solid ${icon}`}></i> {label}
      <span className="admin-chip-count">{count}</span>
    </button>
  );
}

// PaymentPill Component
// Renders a colored pill for the payment status.
function PaymentPill({ status }) {
  const icon = status === 'paid' ? 'fa-circle-check' : 'fa-hourglass-half';
  return (
    <span className={`admin-pill ${status}`}>
      <i className={`fa-solid ${icon}`}></i> {status}
    </span>
  );
}

// StatusPill Component
// Renders a colored pill for the booking status.
function StatusPill({ status }) {
  let icon = 'fa-clock';
  if (status === 'confirmed') icon = 'fa-ticket';
  else if (status === 'checked_out') icon = 'fa-door-open';

  return (
    <span className={`admin-pill ${status}`}>
      <i className={`fa-solid ${icon}`}></i> {status}
    </span>
  );
}

// ReservationRow Component
// Renders a single row of the reservations table with actions.
function ReservationRow({ booking, updatingId, onSetStatus }) {
  const isUpdating = updatingId === booking.id;

  return (
    <tr>
      <td>
        <div className="cell-main">{booking.profiles?.full_name || '—'}</div>
        <div className="cell-sub">{booking.profiles?.email}</div>
      </td>
      <td>
        <div className="cell-main">Room {booking.rooms?.room_number}</div>
        <div className="cell-sub">{booking.rooms?.room_type}</div>
      </td>
      <td className="muted">{booking.check_in}</td>
      <td className="muted">{booking.check_out}</td>
      <td><PaymentPill status={booking.payment_status} /></td>
      <td><StatusPill status={booking.status} /></td>
      <td>
        <div className="row-actions row-actions-end">
          {booking.status === 'pending' && (
            <button
              className="app-btn app-btn-primary app-btn-sm"
              onClick={() => onSetStatus(booking, 'confirmed')}
              disabled={isUpdating}
            >
              <i className={`fa-solid ${isUpdating ? 'fa-spinner fa-spin' : 'fa-check'}`}></i>
              {isUpdating ? 'Confirming…' : 'Confirm'}
            </button>
          )}

          {booking.status === 'confirmed' && (
            <button
              className="app-btn app-btn-danger app-btn-sm"
              onClick={() => onSetStatus(booking, 'checked_out')}
              disabled={isUpdating}
            >
              <i className={`fa-solid ${isUpdating ? 'fa-spinner fa-spin' : 'fa-door-open'}`}></i>
              {isUpdating ? 'Checking out…' : 'Check-out'}
            </button>
          )}

          {booking.status === 'checked_out' && (
            <span className="muted text-sm">
              <i className="fa-solid fa-circle-check mr-1"></i> Done
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

// MAIN STAFF RESERVATIONS COMPONENT
// StaffReservations Component
// Displays all reservations with filters, search, and status actions.
export default function StaffReservations() {
  // --- State Management ---
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // DATA FETCHING
  // Fetches all reservations.
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

  useEffect(() => {
    fetchReservations(true);
    const interval = setInterval(() => fetchReservations(false), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ACTIONS
  // Updates the status of a booking after user confirmation.
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

  // DERIVED DATA
  /** Counts per status for stat cards and filter chips. */
  const counts = {
    all: bookings.length,
    pending: bookings.filter((b) => b.status === 'pending').length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    checked_out: bookings.filter((b) => b.status === 'checked_out').length
  };

  /** Bookings after applying filter and search. */
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

  // RENDER
  return (
    <StaffLayout>
      <div className="admin-welcome">
        <h1>Reservations</h1>
        <p>All bookings from guests. Auto-refreshes every 10 seconds.</p>
      </div>

      {/*MINI STATS*/}
      <div className="admin-mini-stats">
        <StatCard icon="fa-calendar-check" color="blue"   label="Total" value={counts.all} />
        <StatCard icon="fa-clock" color="orange" label="Pending" value={counts.pending} />
        <StatCard icon="fa-ticket" color="green"  label="Confirmed" value={counts.confirmed} />
        <StatCard icon="fa-door-open" color="purple" label="Checked out" value={counts.checked_out} />
      </div>

      <div className="admin-panel">
        <div className="admin-panel-header">
          <h3 className="admin-panel-title">
            <i className="fa-solid fa-calendar-check"></i> All Reservations
          </h3>
        </div>

        {/*FILTER CHIPS*/}
        <div className="admin-chips">
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

        {/*TOOLBAR*/}
        <div className="admin-toolbar">
          <div className="admin-toolbar-search">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input
              placeholder="Search by guest name, email, or room…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="app-btn app-btn-secondary" onClick={() => fetchReservations(true)}>
            <i className="fa-solid fa-rotate"></i> Refresh
          </button>
        </div>

        {/*FEEDBACK*/}
        {error && <p className="admin-error">{error}</p>}
        {message && <p className="admin-success">{message}</p>}

        {/*LOADING*/}
        {loading && (
          <div className="admin-loading">
            <i className="fa-solid fa-spinner fa-spin"></i> Loading…
          </div>
        )}

        {/*EMPTY*/}
        {!loading && filteredBookings.length === 0 && (
          <div className="admin-empty">
            <i className="fa-solid fa-calendar-xmark"></i>
            <div className="admin-empty-title">No reservations match</div>
            <div className="admin-empty-desc">Try adjusting your search or filter.</div>
          </div>
        )}

        {/*TABLE*/}
        {!loading && filteredBookings.length > 0 && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Room</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Payment</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
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