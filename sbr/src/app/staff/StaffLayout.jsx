// Imports — React hooks, routing, Supabase, NFC reader, and layout wrapper
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase.js';
import { readNFC } from '../../nfc.js';
import StaffLayout from './StaffLayout.jsx';

// ============================================================
// CONSTANTS
// ============================================================

const API = 'http://localhost:5000';         // Backend API URL
const REFRESH_INTERVAL_MS = 10000;           // Refresh dashboard every 10 seconds
const MAX_BOOKINGS_DISPLAYED = 8;            // Max bookings to show in the table

// ============================================================
// REUSABLE SUB-COMPONENTS
// ============================================================

// StatCard — displays a single mini statistic on the dashboard
// Used for the small number cards at the top (total rooms, available, etc.)
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

// BookingRow — renders a single row in the recent bookings table
// Shows guest info, room, dates, and status pill
function BookingRow({ booking }) {
  // Pick the right icon based on booking status
  let statusIcon = 'clock';
  if (booking.status === 'confirmed') statusIcon = 'ticket';
  else if (booking.status === 'checked_out') statusIcon = 'door-open';

  return (
    <tr>
      <td>
        <div className="staff-cell-main">{booking.profiles?.full_name || 'Guest'}</div>
        <div className="staff-cell-sub">{booking.profiles?.email || ''}</div>
      </td>
      <td>
        <div className="staff-cell-main">Room {booking.rooms?.room_number}</div>
        <div className="staff-cell-sub">{booking.rooms?.room_type}</div>
      </td>
      <td>
        <div className="staff-cell-main staff-sm">
          <i className="calendar staff-gap"></i>
          {booking.check_in}
        </div>
        <div className="staff-cell-sub">
          <i className="arrow-right staff-gap"></i>
          {booking.check_out}
        </div>
      </td>
      <td>
        <span className={`staff-pill ${booking.status}`}>
          <i className={statusIcon}></i>
          {booking.status}
        </span>
      </td>
    </tr>
  );
}

// RoomRow — renders a single room with status toggle in the room status panel
// Allows staff to toggle between "available" and "maintenance"
function RoomRow({ room, onToggleStatus }) {
  const nextStatus = room.status === 'available' ? 'maintenance' : 'available';
  const buttonLabel = room.status === 'available' ? '→ Maint' : '→ Available';

  return (
    <div className="staff-room-row staff-between">
      <div>
        <div className="staff-cell-main">Room {room.room_number}</div>
        <div className="staff-cell-sub">
          {room.room_type} · ₱{Number(room.price).toLocaleString()}
        </div>
      </div>
      <div className="staff-room-actions">
        <span className={`staff-pill ${room.status}`}>{room.status}</span>
        <button
          className="staff-btn staff-btn-secondary staff-btn-sm"
          onClick={() => onToggleStatus(room.id, nextStatus)}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// MAIN STAFF DASHBOARD COMPONENT
// ============================================================

// Staff — renders the staff-facing dashboard for front desk operations
export default function Staff() {
  const navigate = useNavigate();

  // State — rooms, bookings, message, error, loading
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // ============================================================
  // DATA FETCHING
  // ============================================================

  // fetchDashboardData — fetches rooms and recent bookings in parallel
  async function fetchDashboardData() {
    try {
      setError('');

      // Fetch rooms and bookings at the same time
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

  // Load data on mount and refresh every 10 seconds
  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================
  // ACTIONS
  // ============================================================

  // handleUpdateRoomStatus — updates the status of a room (available ↔ maintenance)
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

  // handleNfcCheckIn — reads an NFC tag and verifies it as a check-in token
  async function handleNfcCheckIn() {
    setError('');
    setMessage('');

    try {
      // 1. Read the NFC tag
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

  // ============================================================
  // DERIVED STATISTICS
  // ============================================================

  const today = new Date().toISOString().slice(0, 10);

  // Count rooms by status
  const roomCounts = {
    all: rooms.length,
    available: rooms.filter((r) => r.status === 'available').length,
    occupied: rooms.filter((r) => r.status === 'occupied').length
  };

  // Count today's check-ins
  const todayCheckins = bookings.filter((b) => b.check_in === today).length;

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <StaffLayout>

      {/* Welcome header */}
      <div className="staff-welcome">
        <h1>Staff Dashboard</h1>
        <p>Front desk operations · Room management · NFC check-in</p>
      </div>

      {/* Mini stats — total rooms, available, occupied, today's check-ins */}
      <div className="staff-mini-stats">
        <StatCard icon="bed" color="blue" label="Total Rooms" value={roomCounts.all} />
        <StatCard icon="circle-check" color="green" label="Available" value={roomCounts.available} />
        <StatCard icon="user-lock" color="orange" label="Occupied" value={roomCounts.occupied} />
        <StatCard icon="calendar-check" color="purple" label="Today's Check-ins" value={todayCheckins} />
      </div>

      {error && <p className="staff-error">{error}</p>}
      {message && <p className="staff-success">{message}</p>}

      {/* Front desk NFC panel */}
      <div className="staff-panel staff-gap-bottom">
        <div className="staff-panel-header">
          <h3 className="staff-panel-title">
            <i className="bell-concierge"></i> Front Desk
          </h3>
          <button className="staff-btn staff-btn-primary" onClick={handleNfcCheckIn}>
            <i className="wifi staff-gap"></i> Tap NFC to Check-In
          </button>
        </div>
        <div className="staff-info-banner">
          <i className="circle-info"></i>
          <div>
            Tap the guest's NFC tag to verify check-in. Make sure the tag matches the room's NFC reader.
          </div>
        </div>
      </div>

      {/* Two-column grid — recent bookings and room status */}
      <div className="staff-grid">

        {/* Recent bookings panel */}
        <div className="staff-panel">
          <div className="staff-panel-header">
            <h3 className="staff-panel-title">
              <i className="calendar-check"></i> Recent Bookings
            </h3>
          </div>

          {loading && (
            <div className="staff-loading">
              <i className="spinner staff-gap"></i> Loading…
            </div>
          )}

          {!loading && bookings.length === 0 && (
            <div className="staff-empty">
              <i className="calendar-xmark"></i>
              <div className="staff-empty-title">No bookings yet</div>
              <div className="staff-empty-desc">Bookings from guests will appear here.</div>
            </div>
          )}

          {!loading && bookings.length > 0 && (
            <table className="staff-table">
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

        {/* Room status panel */}
        <div className="staff-panel">
          <div className="staff-panel-header">
            <h3 className="staff-panel-title">
              <i className="bed"></i> Room Status
            </h3>
          </div>

          {loading && (
            <div className="staff-loading">
              <i className="spinner staff-gap"></i> Loading…
            </div>
          )}

          {!loading && rooms.length === 0 && (
            <div className="staff-empty">
              <i className="bed"></i>
              <div className="staff-empty-title">No rooms yet</div>
              <div className="staff-empty-desc">Wait for admin to add rooms.</div>
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