/* ============================================================
   src/app/admin/Admin.jsx
   Admin Dashboard — lahat ng icons Font Awesome.
   ============================================================ */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../supabase.js';
import AdminLayout from './AdminLayout.jsx';

export default function Admin() {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({
    rooms: 0, availableRooms: 0, occupiedRooms: 0, maintenanceRooms: 0,
    users: 0, staff: 0, admins: 0, bookings: 0, paidBookings: 0,
    unpaidBookings: 0, pendingBookings: 0, confirmedBookings: 0,
    checkedOutBookings: 0, activeNfc: 0, revenue: 0, todayRevenue: 0, todayCheckins: 0
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        const { data: p } = await supabase
          .from('profiles').select('*').eq('id', auth.user.id).single();
        setProfile(p);
      }

      const today = new Date().toISOString().slice(0, 10);

      const [
        roomsRes, availRes, occupiedRes, maintenanceRes,
        usersRes, staffRes, adminsRes, bookingsRes, paidRes, unpaidRes,
        pendingRes, confirmedRes, checkedOutRes, nfcRes, paymentsRes,
        todayPaymentsRes, todayCheckinsRes, recentBookingsRes
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
          .select('*, profiles(full_name,email), rooms(room_number,room_type)')
          .order('created_at', { ascending: false }).limit(6)
      ]);

      const revenue = (paymentsRes.data || []).filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
      const todayRevenue = (todayPaymentsRes.data || []).reduce((s, p) => s + Number(p.amount || 0), 0);

      setStats({
        rooms: roomsRes.count || 0, availableRooms: availRes.count || 0,
        occupiedRooms: occupiedRes.count || 0, maintenanceRooms: maintenanceRes.count || 0,
        users: usersRes.count || 0, staff: staffRes.count || 0, admins: adminsRes.count || 0,
        bookings: bookingsRes.count || 0, paidBookings: paidRes.count || 0,
        unpaidBookings: unpaidRes.count || 0, pendingBookings: pendingRes.count || 0,
        confirmedBookings: confirmedRes.count || 0, checkedOutBookings: checkedOutRes.count || 0,
        activeNfc: nfcRes.count || 0, revenue, todayRevenue, todayCheckins: todayCheckinsRes.count || 0
      });

      setRecentBookings(recentBookingsRes.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    loadData();
    const t = setInterval(loadData, 10000);
    return () => clearInterval(t);
  }, []);

  const first = profile?.full_name?.split(' ')[0] || 'Admin';
  const total = stats.rooms || 1;
  const occupiedPct = Math.round((stats.occupiedRooms / total) * 100);
  const radius = 70;
  const circ = 2 * Math.PI * radius;
  const occupiedDash = (stats.occupiedRooms / total) * circ;
  const availableDash = (stats.availableRooms / total) * circ;

  return (
    <AdminLayout>
      <div className="admin-welcome">
        <h1>Welcome, {first}!</h1>
        <p>Here's what's happening with your beach resort today.</p>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat-card blue">
          <div className="admin-stat-top">
            <span className="admin-stat-label">Total Rooms</span>
            <span className="admin-stat-icon">
              <i className="fa-solid fa-bed"></i>
            </span>
          </div>
          <div>
            <div className="admin-stat-value">{stats.rooms}</div>
            <div className="admin-stat-sub">{stats.availableRooms} available</div>
          </div>
        </div>

        <div className="admin-stat-card green">
          <div className="admin-stat-top">
            <span className="admin-stat-label">Current Guests</span>
            <span className="admin-stat-icon">
              <i className="fa-solid fa-users"></i>
            </span>
          </div>
          <div>
            <div className="admin-stat-value">{stats.occupiedRooms}</div>
            <div className="admin-stat-sub">{occupiedPct}% occupancy</div>
          </div>
        </div>

        <div className="admin-stat-card orange">
          <div className="admin-stat-top">
            <span className="admin-stat-label">Today's Check-ins</span>
            <span className="admin-stat-icon">
              <i className="fa-solid fa-calendar-check"></i>
            </span>
          </div>
          <div>
            <div className="admin-stat-value">{stats.todayCheckins}</div>
            <div className="admin-stat-sub">{stats.checkedOutBookings} check-outs total</div>
          </div>
        </div>

        <div className="admin-stat-card purple">
          <div className="admin-stat-top">
            <span className="admin-stat-label">Today's Payments</span>
            <span className="admin-stat-icon">
              <i className="fa-solid fa-credit-card"></i>
            </span>
          </div>
          <div>
            <div className="admin-stat-value">₱{stats.todayRevenue.toLocaleString()}</div>
            <div className="admin-stat-sub">{stats.paidBookings} paid booking(s)</div>
          </div>
        </div>
      </div>

      <div className="admin-dashboard-grid">
        <div className="admin-panel">
          <div className="admin-panel-header">
            <h3 className="admin-panel-title">
              <i className="fa-solid fa-calendar-check"></i> Recent Reservations
            </h3>
            <Link to="/admin/bookings" className="admin-panel-link">View all</Link>
          </div>

          {loading && <p className="muted center">Loading…</p>}
          {!loading && recentBookings.length === 0 && <p className="muted center">Wala pang bookings.</p>}

          {!loading && recentBookings.length > 0 && (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Guest Name</th><th>Room</th><th>Check-in</th><th>Check-out</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((b) => (
                  <tr key={b.id}>
                    <td><strong>{b.profiles?.full_name || '—'}</strong></td>
                    <td>Room {b.rooms?.room_number}</td>
                    <td className="muted">{b.check_in}</td>
                    <td className="muted">{b.check_out}</td>
                    <td><span className={`admin-pill ${b.status}`}>{b.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="admin-panel">
          <div className="admin-panel-header">
            <h3 className="admin-panel-title">
              <i className="fa-solid fa-chart-pie"></i> Room Occupancy
            </h3>
          </div>

          <div className="admin-donut-wrap">
            <div className="admin-donut">
              <svg viewBox="0 0 200 200">
                <circle cx="100" cy="100" r={radius} fill="none" stroke="#e5ebf0" strokeWidth="20" />
                <circle cx="100" cy="100" r={radius} fill="none" stroke="#1e5fa8" strokeWidth="20"
                  strokeDasharray={`${occupiedDash} ${circ - occupiedDash}`} strokeDashoffset="0" strokeLinecap="round" />
                <circle cx="100" cy="100" r={radius} fill="none" stroke="#22c55e" strokeWidth="20"
                  strokeDasharray={`${availableDash} ${circ - availableDash}`} strokeDashoffset={-occupiedDash} strokeLinecap="round" />
              </svg>
              <div className="admin-donut-center">
                <div className="admin-donut-percent">{occupiedPct}%</div>
                <div className="admin-donut-label">Occupied</div>
              </div>
            </div>
            <div className="admin-donut-legend">
              <div className="admin-legend-item">
                <span className="admin-legend-left">
                  <span className="admin-legend-dot" style={{ background: '#1e5fa8' }} />Occupied
                </span>
                <strong>{stats.occupiedRooms}</strong>
              </div>
              <div className="admin-legend-item">
                <span className="admin-legend-left">
                  <span className="admin-legend-dot" style={{ background: '#22c55e' }} />Available
                </span>
                <strong>{stats.availableRooms}</strong>
              </div>
              <div className="admin-legend-item">
                <span className="admin-legend-left">
                  <span className="admin-legend-dot" style={{ background: '#9ca3af' }} />Maintenance
                </span>
                <strong>{stats.maintenanceRooms}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}