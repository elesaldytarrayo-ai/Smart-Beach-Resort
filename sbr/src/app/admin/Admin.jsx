// Imports — React hooks, routing, Supabase, and admin layout wrapper
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../supabase.js';
import AdminLayout from './AdminLayout.jsx';

//Constans
const REFRESH_INTERVAL_MS = 10000;            // Refresh dashboard every 10 seconds
const RECENT_BOOKINGS_LIMIT = 6;              // Max recent bookings to show
const DONUT_RADIUS = 70;                      // Donut chart radius
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

// Default state for the stats object — makes the shape explicit
const INITIAL_STATS = {
  rooms: 0, availableRooms: 0, occupiedRooms: 0, maintenanceRooms: 0,
  users: 0, staff: 0, admins: 0,
  bookings: 0, paidBookings: 0, unpaidBookings: 0,
  pendingBookings: 0, confirmedBookings: 0, checkedOutBookings: 0,
  activeNfc: 0,
  revenue: 0, todayRevenue: 0, todayCheckins: 0
};

// Reusable Sub-Components
// StatCard — displays a large KPI card on the admin dashboard
// Used for the big colored cards at the top (total rooms, guests, etc.)
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

// RecentReservationsTable — renders the recent reservations panel
// Shows a table of the latest bookings with loading/empty states
function RecentReservationsTable({ bookings, loading }) {
  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <h3 className="admin-panel-title">
          <i className="fa-solid fa-calendar-check"></i> Recent Reservations
        </h3>
        <Link to="/admin/bookings" className="admin-panel-link">View all</Link>
      </div>

      {loading && <p className="muted center">Loading…</p>}

      {!loading && bookings.length === 0 && (
        <p className="muted center">No bookings yet.</p>
      )}

      {!loading && bookings.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Guest Name</th>
              <th>Room</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <tr key={booking.id}>
                <td><strong>{booking.profiles?.full_name || '—'}</strong></td>
                <td>Room {booking.rooms?.room_number}</td>
                <td className="muted">{booking.check_in}</td>
                <td className="muted">{booking.check_out}</td>
                <td>
                  <span className={`admin-pill ${booking.status}`}>{booking.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// RoomOccupancyChart — renders the SVG donut chart showing room occupancy
// Shows occupied, available, and maintenance counts
function RoomOccupancyChart({ stats }) {
  const totalRooms = stats.rooms || 1;
  const occupiedPercent = Math.round((stats.occupiedRooms / totalRooms) * 100);

  // Calculate arc lengths for the donut segments
  const occupiedDash = (stats.occupiedRooms / totalRooms) * DONUT_CIRCUMFERENCE;
  const availableDash = (stats.availableRooms / totalRooms) * DONUT_CIRCUMFERENCE;

  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <h3 className="admin-panel-title">
          <i className="fa-solid fa-chart-pie"></i> Room Occupancy
        </h3>
      </div>

      <div className="admin-donut-wrap">
        <div className="admin-donut">
          <svg viewBox="0 0 200 200">
            {/* Background ring */}
            <circle cx="100" cy="100" r={DONUT_RADIUS} fill="none"
              stroke="#e5ebf0" strokeWidth="20" />

            {/* Occupied arc */}
            <circle cx="100" cy="100" r={DONUT_RADIUS} fill="none"
              className="donut-stroke-occupied" strokeWidth="20"
              strokeDasharray={`${occupiedDash} ${DONUT_CIRCUMFERENCE - occupiedDash}`}
              strokeDashoffset="0" strokeLinecap="round" />

            {/* Available arc (offset by occupied) */}
            <circle cx="100" cy="100" r={DONUT_RADIUS} fill="none"
              className="donut-stroke-available" strokeWidth="20"
              strokeDasharray={`${availableDash} ${DONUT_CIRCUMFERENCE - availableDash}`}
              strokeDashoffset={-occupiedDash} strokeLinecap="round" />
          </svg>

          <div className="admin-donut-center">
            <div className="admin-donut-percent">{occupiedPercent}%</div>
            <div className="admin-donut-label">Occupied</div>
          </div>
        </div>

        {/* Legend — occupied, available, maintenance */}
        <div className="admin-donut-legend">
          <div className="admin-legend-item">
            <span className="admin-legend-left">
              <span className="admin-legend-dot donut-legend-occupied" />Occupied
            </span>
            <strong>{stats.occupiedRooms}</strong>
          </div>
          <div className="admin-legend-item">
            <span className="admin-legend-left">
              <span className="admin-legend-dot donut-legend-available" />Available
            </span>
            <strong>{stats.availableRooms}</strong>
          </div>
          <div className="admin-legend-item">
            <span className="admin-legend-left">
              <span className="admin-legend-dot donut-legend-maintenance" />Maintenance
            </span>
            <strong>{stats.maintenanceRooms}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Admin Dashboard Components
// Admin — renders the admin dashboard with KPIs, recent reservations,
// and room occupancy. Auto-refreshes every 10 seconds.
export default function Admin() {

  // State — profile, stats, recent bookings, loading
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(INITIAL_STATS);
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Data Fetching
  // fetchDashboardData — fetches all dashboard data in parallel
  // isInitialLoad controls whether to show the loading spinner
  async function fetchDashboardData(isInitialLoad = false) {
    if (isInitialLoad) setLoading(true);

    try {
      const today = new Date().toISOString().slice(0, 10);

      // --- Profile fetch (independent) ---
      const { data: auth } = await supabase.auth.getUser();
      if (auth?.user) {
        const { data: profileData } = await supabase
          .from('profiles').select('*').eq('id', auth.user.id).single();
        setProfile(profileData);
      }

      // --- Count queries (18 parallel requests) ---
      // Fetches all counts at the same time for speed
      const [
        roomsRes, availableRes, occupiedRes, maintenanceRes,
        usersRes, staffRes, adminsRes,
        bookingsRes, paidRes, unpaidRes,
        pendingRes, confirmedRes, checkedOutRes,
        activeNfcRes,
        allPaymentsRes, todayPaymentsRes, todayCheckinsRes,
        recentBookingsRes
      ] = await Promise.all([
        supabase.from('rooms').select('*', { count: 'exact', head: true }),
        supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('status', 'available'),
        supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('status', 'occupied'),
        supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('status', 'maintenance'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'user'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'staff'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('payment_status', 'paid'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('payment_status', 'unpaid'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'checked_out'),
        supabase.from('nfc_tokens').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('payments').select('amount, status'),
        supabase.from('payments').select('amount').gte('paid_at', today),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('check_in', today),
        supabase.from('bookings')
          .select('*, profiles(full_name, email), rooms(room_number, room_type)')
          .order('created_at', { ascending: false })
          .limit(RECENT_BOOKINGS_LIMIT)
      ]);

      // --- Derive revenue ---
      const totalRevenue = (allPaymentsRes.data || [])
        .filter((p) => p.status === 'paid')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

      const todayRevenue = (todayPaymentsRes.data || [])
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

      // --- Consolidate stats ---
      setStats({
        rooms: roomsRes.count || 0,
        availableRooms: availableRes.count || 0,
        occupiedRooms: occupiedRes.count || 0,
        maintenanceRooms: maintenanceRes.count || 0,
        users: usersRes.count || 0,
        staff: staffRes.count || 0,
        admins: adminsRes.count || 0,
        bookings: bookingsRes.count || 0,
        paidBookings: paidRes.count || 0,
        unpaidBookings: unpaidRes.count || 0,
        pendingBookings: pendingRes.count || 0,
        confirmedBookings: confirmedRes.count || 0,
        checkedOutBookings: checkedOutRes.count || 0,
        activeNfc: activeNfcRes.count || 0,
        revenue: totalRevenue,
        todayRevenue,
        todayCheckins: todayCheckinsRes.count || 0
      });

      setRecentBookings(recentBookingsRes.data || []);
    } catch (err) {
      console.error('Admin dashboard load error:', err);
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  }

  // Load dashboard on mount + auto-refresh every 10 seconds
  useEffect(() => {
    fetchDashboardData(true);
    const interval = setInterval(() => fetchDashboardData(false), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived Values
  const firstName = profile?.full_name?.split(' ')[0] || 'Admin';
  const totalRooms = stats.rooms || 1;
  const occupiedPercent = Math.round((stats.occupiedRooms / totalRooms) * 100);

  // Render
  return (
    <AdminLayout>

      {/* Welcome header */}
      <div className="admin-welcome">
        <h1>Welcome, {firstName}!</h1>
        <p>Here's what's happening with your beach resort today.</p>
      </div>

      {/* KPI stat cards — total rooms, guests, check-ins, payments */}
      <div className="admin-stat-grid">
        <StatCard
          color="blue"
          icon="fa-bed"
          label="Total Rooms"
          value={stats.rooms}
          sub={`${stats.availableRooms} available`}
        />
        <StatCard
          color="green"
          icon="fa-users"
          label="Current Guests"
          value={stats.occupiedRooms}
          sub={`${occupiedPercent}% occupancy`}
        />
        <StatCard
          color="orange"
          icon="fa-calendar-check"
          label="Today's Check-ins"
          value={stats.todayCheckins}
          sub={`${stats.checkedOutBookings} check-outs total`}
        />
        <StatCard
          color="purple"
          icon="fa-credit-card"
          label="Today's Payments"
          value={`₱${stats.todayRevenue.toLocaleString()}`}
          sub={`${stats.paidBookings} paid booking(s)`}
        />
      </div>

      {/* Dashboard grid — recent reservations + room occupancy */}
      <div className="admin-dashboard-grid">
        <RecentReservationsTable bookings={recentBookings} loading={loading} />
        <RoomOccupancyChart stats={stats} />
      </div>

    </AdminLayout>
  );
}