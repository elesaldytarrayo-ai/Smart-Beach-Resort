// Imports — React hooks, routing, Supabase client, and user layout wrapper
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase.js';
import UserLayout from './UserLayout.jsx';

// ============================================================
// REUSABLE SUB-COMPONENTS
// ============================================================

// StatCard — displays a single mini statistic on the dashboard
// Used for the small number cards at the top (available rooms, bookings, etc.)
function StatCard({ icon, color, label, value }) {
  return (
    <div className="user-mini-stat">
      <div className={`user-mini-stat-icon ${color}`}>
        <i className={icon}></i>
      </div>
      <div className="user-mini-stat-body">
        <div className="user-mini-stat-label">{label}</div>
        <div className="user-mini-stat-value">{value}</div>
      </div>
    </div>
  );
}

// StatusPill — renders a colored pill badge for payment or booking statuses
// Shows a small colored badge (paid, pending, confirmed, etc.)
function StatusPill({ type, value }) {
  // Pick the right icon based on the status type and value
  // Different icons depending on whether it's a payment or booking status
  let icon = 'circle';

  if (type === 'payment') {
    icon = value === 'paid' ? 'circle-check' : 'hourglass-half';
  } else if (type === 'booking') {
    if (value === 'confirmed') icon = 'ticket';
    else if (value === 'checked_out') icon = 'door-open';
    else icon = 'clock';
  }

  return (
    <span className={`user-pill ${value}`}>
      <i className={icon}></i>
      {value}
    </span>
  );
}

// ============================================================
// MAIN USER DASHBOARD COMPONENT
// ============================================================

export default function User() {
  const navigate = useNavigate();

  // State — profile, rooms, bookings, loading, and error
  // Stores all the data needed for the dashboard
  const [profile, setProfile] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // fetchDashboardData — loads profile, rooms, and bookings in parallel
  // Redirects to login if the user is not authenticated
  // Fetches all three data sources at the same time for speed
  async function fetchDashboardData() {
    try {
      // 1. Verify authentication
      // Make sure the user is logged in before fetching data
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        navigate('/login');
        return;
      }

      const userId = authData.user.id;

      // 2. Fetch data in parallel for performance
      // Gets profile, rooms, and the user's bookings all at once
      const [profileRes, roomsRes, bookingsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('rooms').select('*').order('room_number'),
        supabase.from('bookings')
          .select('*, rooms(room_number, room_type)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
      ]);

      // 3. Update state (with safety checks)
      // Saves the data into state if any was returned
      if (profileRes.data) setProfile(profileRes.data);
      if (roomsRes.data) setRooms(roomsRes.data);
      if (bookingsRes.data) setBookings(bookingsRes.data);

    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }

  // Load dashboard data on mount
  // Calls fetch when the page first loads
  useEffect(() => {
    fetchDashboardData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived statistics
  // Calculates the numbers shown in the mini stats
  const availableCount = rooms.filter((r) => r.status === 'available').length;
  const activeBookings = bookings.filter((b) => b.status !== 'checked_out').length;
  const paidCount = bookings.filter((b) => b.payment_status === 'paid').length;

  // Render — welcome header, mini stats, available rooms, recent bookings
  return (
    <UserLayout>

      {/* Welcome header — greeting with the user's name */}
      <div className="user-welcome">
        <h1>Welcome back, {profile?.full_name?.split(' ')[0] || 'Guest'}!</h1>
        <p>Here's an overview of your bookings and available rooms.</p>
      </div>

      {/* Mini stats — available rooms, bookings, active, paid */}
      {/* Four small cards showing the counts */}
      <div className="user-mini-stats">
        <StatCard icon="bed" color="blue" label="Available Rooms" value={availableCount} />
        <StatCard icon="ticket" color="green" label="My Bookings" value={bookings.length} />
        <StatCard icon="clock" color="orange" label="Active Bookings" value={activeBookings} />
        <StatCard icon="circle-check" color="purple" label="Paid" value={paidCount} />
      </div>

      {error && <p className="user-error">{error}</p>}

      {/* Available rooms panel — grid of available rooms */}
      <div className="user-panel user-gap">
        <div className="user-panel-header">
          <h3 className="user-panel-title">
            <i className="bed"></i> Available Rooms
          </h3>
          <Link to="/user/booking" className="user-panel-link">
            View all →
          </Link>
        </div>

        {/* Loading state — spinner while data is loading */}
        {loading && (
          <div className="user-loading">
            <i className="spinner"></i> Loading…
          </div>
        )}

        {/* Empty state — no rooms */}
        {!loading && rooms.length === 0 && (
          <div className="user-empty">
            <i className="bed"></i>
            <div className="user-empty-title">No rooms available</div>
            <div className="user-empty-desc">Wait for admin to add rooms.</div>
          </div>
        )}

        {/* Room cards — only the first 4 rooms are shown */}
        {!loading && rooms.length > 0 && (
          <div className="user-room-grid">
            {rooms.slice(0, 4).map((room) => (
              <div key={room.id} className="user-room-card">
                <span className={`user-room-badge ${room.status === 'available' ? 'badge-success' : 'badge-danger'}`}>
                  {room.status}
                </span>
                <p className="user-room-type">{room.room_type}</p>
                <p className="user-room-number">#{room.room_number}</p>
                <p className="user-room-price">
                  ₱{Number(room.price).toLocaleString()}
                  <span> / night</span>
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Book a Room button */}
        <div className="user-center user-gap-lg">
          <Link to="/user/booking">
            <button className="user-btn user-btn-primary">
              <i className="plus"></i> Book a Room
            </button>
          </Link>
        </div>
      </div>

      {/* Recent bookings panel — table of the latest 5 bookings */}
      <div className="user-panel">
        <div className="user-panel-header">
          <h3 className="user-panel-title">
            <i className="ticket"></i> Recent Bookings
          </h3>
          <Link to="/user/booking" className="user-panel-link">
            View all →
          </Link>
        </div>

        {/* Empty state — no bookings */}
        {!loading && bookings.length === 0 && (
          <div className="user-empty">
            <i className="calendar-xmark"></i>
            <div className="user-empty-title">No bookings yet</div>
            <div className="user-empty-desc">Book a room to get started.</div>
          </div>
        )}

        {/* Bookings table — only the first 5 bookings */}
        {!loading && bookings.length > 0 && (
          <table className="user-table">
            <thead>
              <tr>
                <th>Room</th>
                <th>Dates</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.slice(0, 5).map((booking) => (
                <tr key={booking.id}>
                  <td>
                    <div className="user-cell-main">Room {booking.rooms?.room_number}</div>
                    <div className="user-cell-sub">{booking.rooms?.room_type}</div>
                  </td>
                  <td>
                    <div className="user-cell-main user-sm">{booking.check_in}</div>
                    <div className="user-cell-sub">→ {booking.check_out}</div>
                  </td>
                  <td>
                    <strong className="user-deep-sea">
                      ₱{Number(booking.total_amount).toLocaleString()}
                    </strong>
                  </td>
                  <td>
                    <StatusPill type="payment" value={booking.payment_status} />
                  </td>
                  <td>
                    <StatusPill type="booking" value={booking.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </UserLayout>
  );
}