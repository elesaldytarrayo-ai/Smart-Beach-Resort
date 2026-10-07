/* ============================================================
   src/app/user/User.jsx
   User Dashboard — with UserLayout.
   ============================================================ */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase.js';
import UserLayout from './UserLayout.jsx';

export default function User() {
  const nav = useNavigate();

  const [profile, setProfile] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) { nav('/login'); return; }

        const { data: p } = await supabase
          .from('profiles').select('*').eq('id', auth.user.id).single();
        setProfile(p);

        const { data: r } = await supabase
          .from('rooms').select('*').order('room_number');
        setRooms(r || []);

        const { data: b } = await supabase
          .from('bookings')
          .select('*, rooms(room_number,room_type)')
          .eq('user_id', auth.user.id)
          .order('created_at', { ascending: false });
        setBookings(b || []);
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [nav]);

  const availableCount = rooms.filter((r) => r.status === 'available').length;
  const activeBookings = bookings.filter((b) => b.status !== 'checked_out').length;
  const paidCount = bookings.filter((b) => b.payment_status === 'paid').length;

  return (
    <UserLayout>
      <div className="admin-welcome">
        <h1>Welcome back, {profile?.full_name?.split(' ')[0] || 'Guest'}!</h1>
        <p>Here's an overview of your bookings and available rooms.</p>
      </div>

      {/* Mini stats */}
      <div className="admin-mini-stats">
        <div className="admin-mini-stat">
          <div className="admin-mini-stat-icon blue">
            <i className="fa-solid fa-bed"></i>
          </div>
          <div className="admin-mini-stat-body">
            <div className="admin-mini-stat-label">Available Rooms</div>
            <div className="admin-mini-stat-value">{availableCount}</div>
          </div>
        </div>
        <div className="admin-mini-stat">
          <div className="admin-mini-stat-icon green">
            <i className="fa-solid fa-ticket"></i>
          </div>
          <div className="admin-mini-stat-body">
            <div className="admin-mini-stat-label">My Bookings</div>
            <div className="admin-mini-stat-value">{bookings.length}</div>
          </div>
        </div>
        <div className="admin-mini-stat">
          <div className="admin-mini-stat-icon orange">
            <i className="fa-solid fa-clock"></i>
          </div>
          <div className="admin-mini-stat-body">
            <div className="admin-mini-stat-label">Active Bookings</div>
            <div className="admin-mini-stat-value">{activeBookings}</div>
          </div>
        </div>
        <div className="admin-mini-stat">
          <div className="admin-mini-stat-icon purple">
            <i className="fa-solid fa-circle-check"></i>
          </div>
          <div className="admin-mini-stat-body">
            <div className="admin-mini-stat-label">Paid</div>
            <div className="admin-mini-stat-value">{paidCount}</div>
          </div>
        </div>
      </div>

      {err && <p className="admin-error">{err}</p>}

      {/* Available Rooms */}
      <div className="admin-panel" style={{ marginBottom: 20 }}>
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
            <i className="fa-solid fa-spinner"></i> Loading…
          </div>
        )}

        {!loading && rooms.length === 0 && (
          <div className="admin-empty">
            <i className="fa-solid fa-bed"></i>
            <div className="admin-empty-title">No rooms available</div>
            <div className="admin-empty-desc">
              Wait for admin to add rooms.
            </div>
          </div>
        )}

        {!loading && rooms.length > 0 && (
          <div className="room-grid">
            {rooms.slice(0, 4).map((r) => (
              <div key={r.id} className="room-card">
                <span className="room-badge" style={{
                  background: r.status === 'available' ? '#d1fae5' : '#fee2e2',
                  color: r.status === 'available' ? '#065f46' : '#991b1b'
                }}>
                  {r.status}
                </span>
                <p className="room-type">{r.room_type}</p>
                <p className="room-number">#{r.room_number}</p>
                <p className="room-price">
                  ₱{Number(r.price).toLocaleString()}
                  <span> / night</span>
                </p>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link to="/user/booking">
            <button className="app-btn app-btn-primary">
              <i className="fa-solid fa-plus"></i> Book a Room
            </button>
          </Link>
        </div>
      </div>

      {/* Recent Bookings */}
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
            <div className="admin-empty-desc">
              Book a room to get started.
            </div>
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
              {bookings.slice(0, 5).map((b) => (
                <tr key={b.id}>
                  <td>
                    <div className="cell-main">Room {b.rooms?.room_number}</div>
                    <div className="cell-sub">{b.rooms?.room_type}</div>
                  </td>
                  <td>
                    <div className="cell-main" style={{ fontSize: 12 }}>
                      {b.check_in}
                    </div>
                    <div className="cell-sub">→ {b.check_out}</div>
                  </td>
                  <td>
                    <strong style={{ color: 'var(--deep-sea)' }}>
                      ₱{Number(b.total_amount).toLocaleString()}
                    </strong>
                  </td>
                  <td>
                    <span className={`admin-pill ${b.payment_status}`}>
                      <i className={
                        b.payment_status === 'paid' ? 'fa-solid fa-circle-check' :
                        'fa-solid fa-hourglass-half'
                      }></i>
                      {b.payment_status}
                    </span>
                  </td>
                  <td>
                    <span className={`admin-pill ${b.status}`}>
                      <i className={
                        b.status === 'confirmed' ? 'fa-solid fa-ticket' :
                        b.status === 'checked_out' ? 'fa-solid fa-door-open' :
                        'fa-solid fa-clock'
                      }></i>
                      {b.status}
                    </span>
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