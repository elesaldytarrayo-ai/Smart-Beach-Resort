/* ============================================================
   src/app/admin/Admin.jsx
   Admin Dashboard — LIVE data from Supabase.
   Nakikita lahat ng ginawa ng users: bookings, payments, NFC.
   Auto-refresh every 10 seconds.
   ============================================================ */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase.js';

export default function Admin() {
  const nav = useNavigate();

  const [stats, setStats] = useState({
    rooms: 0,
    availableRooms: 0,
    occupiedRooms: 0,
    users: 0,
    staff: 0,
    admins: 0,
    bookings: 0,
    paidBookings: 0,
    unpaidBookings: 0,
    pendingBookings: 0,
    confirmedBookings: 0,
    checkedOutBookings: 0,
    activeNfc: 0,
    revenue: 0
  });

  const [recentBookings, setRecentBookings] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);

  /* ------------------------------------------------------------
     Load ALL admin data from Supabase
     ------------------------------------------------------------ */
  async function loadData() {
    try {
      setErr('');

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { nav('/login'); return; }

      const [
        roomsRes,
        availRes,
        occupiedRes,
        usersRes,
        staffRes,
        adminsRes,
        bookingsRes,
        paidRes,
        unpaidRes,
        pendingRes,
        confirmedRes,
        checkedOutRes,
        nfcRes,
        paymentsRes,
        recentBookingsRes,
        recentPaymentsRes,
        recentUsersRes
      ] = await Promise.all([
        supabase.from('rooms').select('*', { count: 'exact', head: true }),
        supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('status', 'available'),
        supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('status', 'occupied'),
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
        supabase
          .from('bookings')
          .select('*, profiles(full_name,email), rooms(room_number,room_type)')
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('payments')
          .select('*')
          .order('paid_at', { ascending: false })
          .limit(6),
        supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      const revenue = (paymentsRes.data || [])
        .filter((p) => p.status === 'paid')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

      setStats({
        rooms:              roomsRes.count    || 0,
        availableRooms:     availRes.count    || 0,
        occupiedRooms:      occupiedRes.count || 0,
        users:              usersRes.count    || 0,
        staff:              staffRes.count    || 0,
        admins:             adminsRes.count   || 0,
        bookings:           bookingsRes.count || 0,
        paidBookings:       paidRes.count     || 0,
        unpaidBookings:     unpaidRes.count   || 0,
        pendingBookings:    pendingRes.count  || 0,
        confirmedBookings:  confirmedRes.count || 0,
        checkedOutBookings: checkedOutRes.count || 0,
        activeNfc:          nfcRes.count      || 0,
        revenue
      });

      setRecentBookings(recentBookingsRes.data || []);
      setRecentPayments(recentPaymentsRes.data || []);
      setRecentUsers(recentUsersRes.data || []);
      setLastRefresh(new Date());
    } catch (e) {
      console.error('ADMIN LOAD ERROR:', e);
      setErr(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const t = setInterval(loadData, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    nav('/login');
  }

  return (
    <>
      {/* ---------- Nav ---------- */}
      <nav className="nav">
        <div className="brand">
          <span className="brand-icon">🛡️</span>
          <span>SBR · Admin</span>
        </div>
        <div className="row" style={{ marginLeft: 'auto' }}>
          <Link to="/admin">Dashboard</Link>
          <Link to="/admin/rooms">Rooms</Link>
          <Link to="/admin/users">Users</Link>
          <Link to="/admin/staff">Staff</Link>
          <Link to="/admin/bookings">Bookings</Link>
          <Link to="/admin/payments">Payments</Link>
          <button className="neu-button" onClick={logout}>Logout</button>
        </div>
      </nav>

      <div className="page-pad">
        {/* ---------- Hero ---------- */}
        <section className="hero" style={{ padding: '32px', textAlign: 'left' }}>
          <div className="hero-content">
            <span style={{ fontSize: 36 }}>🛡️</span>
            <h1 style={{ fontSize: 26, marginTop: 8 }}>Admin Dashboard</h1>
            <p style={{ margin: 0, textAlign: 'left' }}>
              Live data from Supabase · Auto-refresh every 10s
              {lastRefresh && (
                <span className="muted"> · Last: {lastRefresh.toLocaleTimeString()}</span>
              )}
            </p>
            <div className="row" style={{ marginTop: 16 }}>
              <button className="neu-button primary" onClick={loadData}>🔄 Refresh Now</button>
            </div>
          </div>
        </section>

        {err && (
          <div className="neu-card" style={{ borderLeft: '4px solid #e11d48', marginTop: 20 }}>
            <strong style={{ color: '#e11d48' }}>⚠️ Error:</strong>
            <p className="muted" style={{ marginTop: 6 }}>{err}</p>
          </div>
        )}

        {loading && (
          <div className="neu-card center" style={{ marginTop: 20 }}>
            Loading dashboard…
          </div>
        )}

        {!loading && (
          <>
            {/* ---------- Overview Stats ---------- */}
            <div className="section-title" style={{ marginTop: 32 }}>
              <h2>Overview</h2>
            </div>

            <div className="feature-grid">
              <Stat icon="🛏️" label="Total Rooms"    value={stats.rooms}          sub={`${stats.availableRooms} available · ${stats.occupiedRooms} occupied`} />
              <Stat icon="👤" label="Users"          value={stats.users} />
              <Stat icon="👨‍💼" label="Staff"          value={stats.staff} />
              <Stat icon="👑" label="Admins"         value={stats.admins} />
              <Stat icon="💰" label="Revenue"        value={`₱${stats.revenue.toLocaleString()}`} />
              <Stat icon="📶" label="Active NFC"     value={stats.activeNfc} />
            </div>

            {/* ---------- Booking Status Breakdown ---------- */}
            <div className="section-title" style={{ marginTop: 40 }}>
              <h2>Booking Status</h2>
              <p>Lahat ng bookings mula sa users</p>
            </div>

            <div className="feature-grid">
              <Stat icon="📅" label="Total Bookings"    value={stats.bookings} />
              <Stat icon="✅" label="Paid"               value={stats.paidBookings} />
              <Stat icon="⏳" label="Unpaid"             value={stats.unpaidBookings} />
              <Stat icon="🕒" label="Pending"            value={stats.pendingBookings} />
              <Stat icon="🎫" label="Confirmed"          value={stats.confirmedBookings} />
              <Stat icon="🚪" label="Checked out"        value={stats.checkedOutBookings} />
            </div>

            {/* ---------- Recent Bookings ---------- */}
            <div className="section-title" style={{ marginTop: 40 }}>
              <h2>Recent Bookings</h2>
              <p>Latest 6 bookings from users</p>
            </div>

            <div className="neu-card">
              {recentBookings.length === 0 ? (
                <p className="muted center">Wala pang bookings.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Guest</th>
                      <th>Room</th>
                      <th>Dates</th>
                      <th>Total</th>
                      <th>Payment</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBookings.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <strong>{b.profiles?.full_name || '—'}</strong>
                          <br />
                          <span className="muted">{b.profiles?.email}</span>
                        </td>
                        <td>
                          #{b.rooms?.room_number}
                          <br />
                          <span className="muted">{b.rooms?.room_type}</span>
                        </td>
                        <td>
                          <span className="muted">{b.check_in} → {b.check_out}</span>
                        </td>
                        <td>₱{Number(b.total_amount || 0).toLocaleString()}</td>
                        <td><span className={`pill ${b.payment_status}`}>{b.payment_status}</span></td>
                        <td><span className={`pill ${b.status}`}>{b.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{ marginTop: 16 }}>
                <Link to="/admin/bookings">
                  <button className="neu-button primary">View all bookings →</button>
                </Link>
              </div>
            </div>

            {/* ---------- Recent Payments ---------- */}
            <div className="section-title" style={{ marginTop: 40 }}>
              <h2>Recent Payments</h2>
              <p>Latest 6 payments (kasama PayMongo test)</p>
            </div>

            <div className="neu-card">
              {recentPayments.length === 0 ? (
                <p className="muted center">Wala pang payments.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Payment ID</th>
                      <th>Booking ID</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Paid at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPayments.map((p) => (
                      <tr key={p.id}>
                        <td className="muted">{String(p.id || '').slice(0, 8)}…</td>
                        <td className="muted">{String(p.booking_id || '').slice(0, 8)}…</td>
                        <td>₱{Number(p.amount || 0).toLocaleString()}</td>
                        <td>{p.method || '—'}</td>
                        <td><span className={`pill ${p.status}`}>{p.status}</span></td>
                        <td className="muted">
                          {p.paid_at ? new Date(p.paid_at).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{ marginTop: 16 }}>
                <Link to="/admin/payments">
                  <button className="neu-button primary">View all payments →</button>
                </Link>
              </div>
            </div>

            {/* ---------- Recent Users ---------- */}
            <div className="section-title" style={{ marginTop: 40 }}>
              <h2>Recent Signups</h2>
              <p>Latest 5 accounts created</p>
            </div>

            <div className="neu-card">
              {recentUsers.length === 0 ? (
                <p className="muted center">Wala pang users.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentUsers.map((u) => (
                      <tr key={u.id}>
                        <td>{u.full_name || '—'}</td>
                        <td>{u.email}</td>
                        <td><span className={`pill ${u.role}`}>{u.role}</span></td>
                        <td className="muted">
                          {u.created_at ? new Date(u.created_at).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{ marginTop: 16 }}>
                <Link to="/admin/users">
                  <button className="neu-button">View all users →</button>
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* -------- Stat card -------- */
function Stat({ icon, label, value, sub }) {
  return (
    <div className="feature-card">
      <span className="feature-icon">{icon}</span>
      <p className="muted">{label}</p>
      <h2 style={{ color: 'var(--accent)', marginTop: 8 }}>{value}</h2>
      {sub && <p className="muted" style={{ marginTop: 4, fontSize: 12 }}>{sub}</p>}
    </div>
  );
}