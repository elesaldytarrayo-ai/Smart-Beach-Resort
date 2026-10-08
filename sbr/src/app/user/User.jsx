import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase.js';
import UserLayout from './UserLayout.jsx';

//REUSABLE SUB-COMPONENTS

// StatCard Component
// Displays a single mini statistic on the dashboard.
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

// StatusPill Component
// Renders a colored pill badge for payment or booking statuses.
function StatusPill({ type, value }) {
  // Determine the appropriate icon based on the status type and value
  let icon = 'fa-circle';
  
  if (type === 'payment') {
    icon = value === 'paid' ? 'fa-circle-check' : 'fa-hourglass-half';
  } else if (type === 'booking') {
    if (value === 'confirmed') icon = 'fa-ticket';
    else if (value === 'checked_out') icon = 'fa-door-open';
    else icon = 'fa-clock';
  }

  return (
    <span className={`admin-pill ${value}`}>
      <i className={`fa-solid ${icon}`}></i>
      {value}
    </span>
  );
}

// MAIN USER DASHBOARD COMPONENT

export default function User() {
  const navigate = useNavigate();

  // --- State Management ---
  const [profile, setProfile] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetches all required dashboard data (profile, rooms, bookings) in parallel.
  // Redirects to login if the user is not authenticated.
  async function fetchDashboardData() {
    try {
      // 1. Verify Authentication
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        navigate('/login');
        return;
      }

      const userId = authData.user.id;

      // 2. Fetch Data in Parallel for Performance
      const [profileRes, roomsRes, bookingsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('rooms').select('*').order('room_number'),
        supabase.from('bookings')
          .select('*, rooms(room_number, room_type)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
      ]);

      // 3. Update State (with safety checks)
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

  useEffect(() => {
    fetchDashboardData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived Statistics
  const availableCount = rooms.filter((r) => r.status === 'available').length;
  const activeBookings = bookings.filter((b) => b.status !== 'checked_out').length;
  const paidCount = bookings.filter((b) => b.payment_status === 'paid').length;

  return (
    <UserLayout>
      {/*WELCOME HEADER*/}
      <div className="admin-welcome">
        <h1>Welcome back, {profile?.full_name?.split(' ')[0] || 'Guest'}!</h1>
        <p>Here's an overview of your bookings and available rooms.</p>
      </div>

      {/*MINI STATS*/}
      <div className="admin-mini-stats">
        <StatCard icon="fa-bed" color="blue" label="Available Rooms" value={availableCount} />
        <StatCard icon="fa-ticket" color="green" label="My Bookings" value={bookings.length} />
        <StatCard icon="fa-clock" color="orange" label="Active Bookings" value={activeBookings} />
        <StatCard icon="fa-circle-check" color="purple" label="Paid" value={paidCount} />
      </div>

      {error && <p className="admin-error">{error}</p>}

      {/*AVAILABLE ROOMS PANEL*/}
      <div className="admin-panel mb-4">
        <div className="admin-panel-header">
          <h3 className="admin-panel-title">
            <i className="fa-solid fa-bed"></i> Available Rooms
          </h3>
          <Link to="/user/booking" className="admin-panel-link">
            View all →
          </Link>
        </div>

        {loading && (
          <div className="admin-loading">
            <i className="fa-solid fa-spinner fa-spin"></i> Loading…
          </div>
        )}

        {!loading && rooms.length === 0 && (
          <div className="admin-empty">
            <i className="fa-solid fa-bed"></i>
            <div className="admin-empty-title">No rooms available</div>
            <div className="admin-empty-desc">Wait for admin to add rooms.</div>
          </div>
        )}

        {!loading && rooms.length > 0 && (
          <div className="room-grid">
            {rooms.slice(0, 4).map((room) => (
              <div key={room.id} className="room-card">
                <span className={`room-badge ${room.status === 'available' ? 'badge-success' : 'badge-danger'}`}>
                  {room.status}
                </span>
                <p className="room-type">{room.room_type}</p>
                <p className="room-number">#{room.room_number}</p>
                <p className="room-price">
                  ₱{Number(room.price).toLocaleString()}
                  <span> / night</span>
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-4">
          <Link to="/user/booking">
            <button className="app-btn app-btn-primary">
              <i className="fa-solid fa-plus"></i> Book a Room
            </button>
          </Link>
        </div>
      </div>

      {/*RECENT BOOKINGS PANEL*/}
      <div className="admin-panel">
        <div className="admin-panel-header">
          <h3 className="admin-panel-title">
            <i className="fa-solid fa-ticket"></i> Recent Bookings
          </h3>
          <Link to="/user/booking" className="admin-panel-link">
            View all →
          </Link>
        </div>

        {!loading && bookings.length === 0 && (
          <div className="admin-empty">
            <i className="fa-solid fa-calendar-xmark"></i>
            <div className="admin-empty-title">No bookings yet</div>
            <div className="admin-empty-desc">Book a room to get started.</div>
          </div>
        )}

        {!loading && bookings.length > 0 && (
          <table className="admin-table">
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
                    <div className="cell-main">Room {booking.rooms?.room_number}</div>
                    <div className="cell-sub">{booking.rooms?.room_type}</div>
                  </td>
                  <td>
                    <div className="cell-main text-sm">{booking.check_in}</div>
                    <div className="cell-sub">→ {booking.check_out}</div>
                  </td>
                  <td>
                    <strong className="text-deep-sea">
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