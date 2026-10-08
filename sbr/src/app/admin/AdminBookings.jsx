import { useEffect, useState } from 'react';
import { supabase } from '../../supabase.js';
import AdminLayout from './AdminLayout.jsx';

// --- Constants ---
const REFRESH_INTERVAL_MS = 10000;

// Filter definitions for the reservation status dropdown.
// A booking matches a filter if BOTH its payment AND status checks pass.
const FILTER_PREDICATES = {
  all: () => true,
  paid: (b) => b.payment_status === 'paid',
  unpaid: (b) => b.payment_status === 'unpaid',
  pending: (b) => b.status === 'pending',
  confirmed: (b) => b.status === 'confirmed',
  checked_out: (b) => b.status === 'checked_out'
};

// REUSABLE SUB-COMPONENTS
// StatCard Component
// Displays a large KPI card on the bookings dashboard.
function StatCard({ color, icon, label, value, sub }) {
  return (
    <div className={`admin-stat-card ${color}`}>
      <div className="admin-stat-top">
        <span className="admin-stat-label">{label}</span>
        <span className="admin-stat-icon">
          <i className={`fa-solid ${icon}`}></i>
        </span>
      </div>
      <div>
        <div className="admin-stat-value">{value}</div>
        <div className="admin-stat-sub">{sub}</div>
      </div>
    </div>
  );
}

// StatusPill Component
// Renders a colored pill for payment or booking status.
function StatusPill({ value }) {
  return <span className={`admin-pill ${value}`}>{value}</span>;
}

// ReservationRow Component
// Renders a single row in the bookings table with action buttons.
function ReservationRow({ booking, updatingId, onMarkPaid, onUpdateStatus }) {
  const isUpdating = updatingId === booking.id;
  const isUnpaid = booking.payment_status !== 'paid';
  const isConfirmed = booking.status === 'confirmed';

  return (
    <tr>
      <td className="muted text-mono">{String(booking.id).slice(0, 6)}…</td>
      <td>
        <div className="cell-main">{booking.profiles?.full_name || '—'}</div>
        <div className="cell-sub">{booking.profiles?.email}</div>
      </td>
      <td>Room {booking.rooms?.room_number}</td>
      <td className="muted">{booking.check_in}</td>
      <td className="muted">{booking.check_out}</td>
      <td>₱{Number(booking.total_amount || 0).toLocaleString()}</td>
      <td><StatusPill value={booking.payment_status} /></td>
      <td><StatusPill value={booking.status} /></td>
      <td>
        <div className="row-actions">
          {isUnpaid && (
            <button
              className="app-btn app-btn-primary app-btn-sm"
              onClick={() => onMarkPaid(booking)}
              disabled={isUpdating}
            >
              <i className={`fa-solid ${isUpdating ? 'fa-spinner fa-spin' : 'fa-check'}`}></i>
              {isUpdating ? 'Marking…' : 'Mark Paid'}
            </button>
          )}

          {isConfirmed && (
            <button
              className="app-btn app-btn-danger app-btn-sm"
              onClick={() => onUpdateStatus(booking, 'checked_out')}
              disabled={isUpdating}
            >
              <i className={`fa-solid ${isUpdating ? 'fa-spinner fa-spin' : 'fa-door-open'}`}></i>
              {isUpdating ? 'Checking…' : 'Check-out'}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// MAIN ADMIN BOOKINGS COMPONENT
// AdminBookings Component
// Displays all reservations with filtering, search, and management actions.
export default function AdminBookings() {
  // --- State Management ---
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // DATA FETCHING
  // Fetches all bookings.
  async function fetchBookings(isInitialLoad = false) {
    if (isInitialLoad) setLoading(true);
    try {
      setError('');
      const { data, error: fetchError } = await supabase
        .from('bookings')
        .select('*, profiles(full_name, email, phone), rooms(room_number, room_type, price)')
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
    fetchBookings(true);
    const interval = setInterval(() => fetchBookings(false), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ACTIONS
  // Marks a booking as paid and creates a payment record if missing.
  async function handleMarkPaid(booking) {
    const confirmed = window.confirm(
      `Mark booking as PAID?\n\nGuest: ${booking.profiles?.full_name}\nAmount: ₱${booking.total_amount}`
    );
    if (!confirmed) return;

    setError('');
    setMessage('');
    setUpdatingId(booking.id);

    try {
      // 1. Update the booking record
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ payment_status: 'paid', status: 'confirmed' })
        .eq('id', booking.id);

      if (bookingError) throw bookingError;

      // 2. Create payment record if one doesn't exist
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id')
        .eq('booking_id', booking.id)
        .maybeSingle();

      if (!existingPayment) {
        const { error: paymentError } = await supabase.from('payments').insert({
          booking_id: booking.id,
          amount: booking.total_amount,
          method: 'manual-admin',
          status: 'paid',
          currency: 'PHP',
          paid_at: new Date().toISOString()
        });
        if (paymentError) throw paymentError;
      }

      setMessage('Booking marked as paid.');
      await fetchBookings(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  // Updates the status of a booking after confirmation.
  async function handleUpdateStatus(booking, newStatus) {
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

      setMessage(`Status updated to "${newStatus}".`);
      await fetchBookings(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  // DERIVED DATA
  /** Counts per filter key for stat cards and dropdown labels. */
  const counts = {
    all: bookings.length,
    paid: bookings.filter(FILTER_PREDICATES.paid).length,
    unpaid: bookings.filter(FILTER_PREDICATES.unpaid).length,
    pending: bookings.filter(FILTER_PREDICATES.pending).length,
    confirmed: bookings.filter(FILTER_PREDICATES.confirmed).length,
    checked_out: bookings.filter(FILTER_PREDICATES.checked_out).length
  };

  /** Total revenue from paid bookings. */
  const totalRevenue = bookings
    .filter(FILTER_PREDICATES.paid)
    .reduce((sum, b) => sum + Number(b.total_amount || 0), 0);

  /** Bookings after applying the active filter and search query. */
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

  // RENDER
  return (
    <AdminLayout>
      <div className="admin-welcome">
        <h1>Reservations</h1>
        <p>All bookings from guests.</p>
      </div>

      {/*KPI STAT CARDS*/}
      <div className="admin-stat-grid">
        <StatCard
          color="blue"
          icon="fa-calendar-check"
          label="Total Bookings"
          value={counts.all}
          sub={`${counts.pending} pending`}
        />
        <StatCard
          color="green"
          icon="fa-circle-check"
          label="Paid"
          value={counts.paid}
          sub={`${counts.confirmed} confirmed`}
        />
        <StatCard
          color="orange"
          icon="fa-hourglass-half"
          label="Unpaid"
          value={counts.unpaid}
          sub="Awaiting payment"
        />
        <StatCard
          color="purple"
          icon="fa-peso-sign"
          label="Revenue"
          value={`₱${totalRevenue.toLocaleString()}`}
          sub="From paid bookings"
        />
      </div>

      {/*TOOLBAR*/}
      <div className="admin-panel mb-4">
        <div className="row row-center">
          <div className="col">
            <input
              className="admin-input"
              placeholder="Search guest name, email, or room…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="col col-fixed-220">
            <select
              className="admin-select"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All ({counts.all})</option>
              <option value="paid">Paid ({counts.paid})</option>
              <option value="unpaid">Unpaid ({counts.unpaid})</option>
              <option value="pending">Pending ({counts.pending})</option>
              <option value="confirmed">Confirmed ({counts.confirmed})</option>
              <option value="checked_out">Checked out ({counts.checked_out})</option>
            </select>
          </div>
          <button className="app-btn app-btn-secondary" onClick={() => fetchBookings(true)}>
            <i className="fa-solid fa-rotate"></i> Refresh
          </button>
        </div>
      </div>

      {/*FEEDBACK*/}
      {error && <p className="admin-error mb-2">{error}</p>}
      {message && <p className="admin-success mb-2">{message}</p>}

      {/*BOOKINGS TABLE*/}
      <div className="admin-panel">
        <div className="admin-panel-header">
          <h3 className="admin-panel-title">
            <i className="fa-solid fa-calendar-check"></i> All Bookings ({filteredBookings.length})
          </h3>
        </div>

        {loading && <p className="muted center">Loading…</p>}

        {!loading && filteredBookings.length === 0 && (
          <p className="muted center">No bookings match.</p>
        )}

        {!loading && filteredBookings.length > 0 && (
          <table className="admin-table">
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