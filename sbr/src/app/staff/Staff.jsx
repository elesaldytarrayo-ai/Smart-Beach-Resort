import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase.js';
import { readNFC } from '../../nfc.js';
import StaffLayout from './StaffLayout.jsx';

// --- Constants ---
const API = 'http://localhost:5000';
const REFRESH_INTERVAL_MS = 10000;
const MAX_BOOKINGS_DISPLAYED = 8;

// REUSABLE SUB-COMPONENTS
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

// BookingRow Component
// Renders a single row in the recent bookings table.
function BookingRow({ booking }) {
  let statusIcon = 'fa-clock';
  if (booking.status === 'confirmed') statusIcon = 'fa-ticket';
  else if (booking.status === 'checked_out') statusIcon = 'fa-door-open';

  return (
    <tr>
      <td>
        <div className="cell-main">{booking.profiles?.full_name || 'Guest'}</div>
        <div className="cell-sub">{booking.profiles?.email || ''}</div>
      </td>
      <td>
        <div className="cell-main">Room {booking.rooms?.room_number}</div>
        <div className="cell-sub">{booking.rooms?.room_type}</div>
      </td>
      <td>
        <div className="cell-main text-sm">
          <i className="fa-solid fa-calendar mr-1"></i>
          {booking.check_in}
        </div>
        <div className="cell-sub">
          <i className="fa-solid fa-arrow-right mr-1"></i>
          {booking.check_out}
        </div>
      </td>
      <td>
        <span className={`admin-pill ${booking.status}`}>
          <i className={`fa-solid ${statusIcon}`}></i>
          {booking.status}
        </span>
      </td>
    </tr>
  );
}

// RoomRow Component
// Renders a single room with status toggle in the room status panel.
function RoomRow({ room, onToggleStatus }) {
  const nextStatus = room.status === 'available' ? 'maintenance' : 'available';
  const buttonLabel = room.status === 'available' ? '→ Maint' : '→ Available';

  return (
    <div className="staff-room-row space-between">
      <div>
        <div className="cell-main">Room {room.room_number}</div>
        <div className="cell-sub">
          {room.room_type} · ₱{Number(room.price).toLocaleString()}
        </div>
      </div>
      <div className="staff-room-actions">
        <span className={`admin-pill ${room.status}`}>{room.status}</span>
        <button
          className="app-btn app-btn-secondary app-btn-sm"
          onClick={() => onToggleStatus(room.id, nextStatus)}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

// MAIN STAFF DASHBOARD COMPONENT
// Staff Component
// Renders the staff-facing dashboard for front desk operations.
export default function Staff() {
  const navigate = useNavigate();

  // --- State Management ---
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // DATA FETCHING
  // Fetches rooms and recent bookings in parallel.
  async function fetchDashboardData() {
    try {
      setError('');

      const [roomsRes, bookingsRes] = await Promise.all([
        supabase.from('rooms').select('*').order('room_number'),
        supabase.from('bookings')
          .select('*, profiles(full_name, email), rooms(room_number, room_type)')
          .order('created_at', { ascending: false })
          .limit(20)
      ]);

      if (roomsRes.error) throw roomsRes.error;
      if (bookingsRes.error) throw bookingsRes.error;

      setRooms(roomsRes.data || []);
      setBookings(bookingsRes.data || []);
    } catch (err) {
      console.error('Staff data fetch error:', err);
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ACTIONS
  // Updates the status of a room (available ↔ maintenance).
  async function handleUpdateRoomStatus(roomId, status) {
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('rooms')
        .update({ status })
        .eq('id', roomId);

      if (updateError) throw updateError;
      await fetchDashboardData();
    } catch (err) {
      setError(err.message);
    }
  }

  // Reads an NFC tag and verifies it as a check-in token.
  async function handleNfcCheckIn() {
    setError('');
    setMessage('');

    try {
      // 1. Read NFC tag
      const readResult = await readNFC();
      if (!readResult.ok) {
        throw new Error(`NFC read failed: ${readResult.error}`);
      }

      // 2. Send to backend for verification
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired. Please log in again.');

      const response = await fetch(`${API}/api/nfc/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ rawToken: readResult.text, purpose: 'check_in' })
      });

      const json = await response.json();
      if (!json.ok) throw new Error(json.error);

      setMessage(`Check-in verified for booking ${json.bookingId.slice(0, 8)}…`);
      await fetchDashboardData();
    } catch (err) {
      setError(err.message);
    }
  }

  // DERIVED STATISTICS
  const today = new Date().toISOString().slice(0, 10);

  const roomCounts = {
    all: rooms.length,
    available: rooms.filter((r) => r.status === 'available').length,
    occupied: rooms.filter((r) => r.status === 'occupied').length
  };

  const todayCheckins = bookings.filter((b) => b.check_in === today).length;

  // RENDER
  return (
    <StaffLayout>
      <div className="admin-welcome">
        <h1>Staff Dashboard</h1>
        <p>Front desk operations · Room management · NFC check-in</p>
      </div>

      {/*MINI STATS*/}
      <div className="admin-mini-stats">
        <StatCard icon="fa-bed" color="blue" label="Total Rooms" value={roomCounts.all} />
        <StatCard icon="fa-circle-check" color="green" label="Available" value={roomCounts.available} />
        <StatCard icon="fa-user-lock" color="orange" label="Occupied" value={roomCounts.occupied} />
        <StatCard icon="fa-calendar-check" color="purple" label="Today's Check-ins" value={todayCheckins} />
      </div>

      {error && <p className="admin-error">{error}</p>}
      {message && <p className="admin-success">{message}</p>}

      {/*FRONT DESK NFC*/}
      <div className="admin-panel mb-4">
        <div className="admin-panel-header">
          <h3 className="admin-panel-title">
            <i className="fa-solid fa-bell-concierge"></i> Front Desk
          </h3>
          <button className="app-btn app-btn-primary" onClick={handleNfcCheckIn}>
            <i className="fa-solid fa-wifi mr-1"></i> Tap NFC to Check-In
          </button>
        </div>
        <div className="admin-info-banner">
          <i className="fa-solid fa-circle-info"></i>
          <div>
            Tap the guest's NFC tag to verify check-in. Make sure the tag matches the room's NFC reader.
          </div>
        </div>
      </div>

      {/*TWO-COLUMN GRID*/}
      <div className="admin-dashboard-grid">
        
        {/* ---- Recent Bookings ---- */}
        <div className="admin-panel">
          <div className="admin-panel-header">
            <h3 className="admin-panel-title">
              <i className="fa-solid fa-calendar-check"></i> Recent Bookings
            </h3>
          </div>

          {loading && (
            <div className="admin-loading">
              <i className="fa-solid fa-spinner fa-spin mr-1"></i> Loading…
            </div>
          )}

          {!loading && bookings.length === 0 && (
            <div className="admin-empty">
              <i className="fa-solid fa-calendar-xmark"></i>
              <div className="admin-empty-title">No bookings yet</div>
              <div className="admin-empty-desc">Bookings from guests will appear here.</div>
            </div>
          )}

          {!loading && bookings.length > 0 && (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Room</th>
                  <th>Dates</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.slice(0, MAX_BOOKINGS_DISPLAYED).map((booking) => (
                  <BookingRow key={booking.id} booking={booking} />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ---- Room Status ---- */}
        <div className="admin-panel">
          <div className="admin-panel-header">
            <h3 className="admin-panel-title">
              <i className="fa-solid fa-bed"></i> Room Status
            </h3>
          </div>

          {loading && (
            <div className="admin-loading">
              <i className="fa-solid fa-spinner fa-spin mr-1"></i> Loading…
            </div>
          )}

          {!loading && rooms.length === 0 && (
            <div className="admin-empty">
              <i className="fa-solid fa-bed"></i>
              <div className="admin-empty-title">No rooms yet</div>
              <div className="admin-empty-desc">Wait for admin to add rooms.</div>
            </div>
          )}

          {!loading && rooms.length > 0 && (
            <div className="staff-room-list">
              {rooms.map((room) => (
                <RoomRow key={room.id} room={room} onToggleStatus={handleUpdateRoomStatus} />
              ))}
            </div>
          )}
        </div>

      </div>
    </StaffLayout>
  );
}