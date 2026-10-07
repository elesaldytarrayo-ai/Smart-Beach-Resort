/* ============================================================
   src/app/staff/Staff.jsx
   Staff Dashboard — Front desk operations with StaffLayout.
   ============================================================ */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase.js';
import { readNFC } from '../../nfc.js';
import StaffLayout from './StaffLayout.jsx';

const API = 'http://localhost:5000';

export default function Staff() {
  const nav = useNavigate();

  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      setErr('');

      const { data: r, error: rErr } = await supabase
        .from('rooms').select('*').order('room_number');
      if (rErr) throw rErr;
      setRooms(r || []);

      const { data: b, error: bErr } = await supabase
        .from('bookings')
        .select('*, profiles(full_name,email), rooms(room_number,room_type)')
        .order('created_at', { ascending: false })
        .limit(20);
      if (bErr) throw bErr;
      setBookings(b || []);
    } catch (e) {
      console.error('STAFF LOAD ERROR:', e);
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, []);

  async function updateRoomStatus(id, status) {
    setErr('');
    const { error } = await supabase
      .from('rooms').update({ status }).eq('id', id);
    if (error) return setErr(error.message);
    refresh();
  }

  async function tapCheckIn() {
    setErr(''); setMsg('');
    const read = await readNFC();
    if (!read.ok) return setErr('NFC read failed: ' + read.error);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${API}/api/nfc/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ rawToken: read.text, purpose: 'check_in' })
    });
    const json = await res.json();
    if (!json.ok) return setErr(json.error);
    setMsg(`Check-in verified for booking ${json.bookingId.slice(0, 8)}…`);
  }

  const roomCounts = {
    all: rooms.length,
    available: rooms.filter((r) => r.status === 'available').length,
    occupied: rooms.filter((r) => r.status === 'occupied').length,
    maintenance: rooms.filter((r) => r.status === 'maintenance').length
  };

  const todayCheckins = bookings.filter((b) =>
    b.check_in === new Date().toISOString().slice(0, 10)
  ).length;

  return (
    <StaffLayout>
      <div className="admin-welcome">
        <h1>Staff Dashboard</h1>
        <p>Front desk operations · Room management · NFC check-in</p>
      </div>

      {/* Mini stats */}
      <div className="admin-mini-stats">
        <div className="admin-mini-stat">
          <div className="admin-mini-stat-icon blue">
            <i className="fa-solid fa-bed"></i>
          </div>
          <div className="admin-mini-stat-body">
            <div className="admin-mini-stat-label">Total Rooms</div>
            <div className="admin-mini-stat-value">{roomCounts.all}</div>
          </div>
        </div>
        <div className="admin-mini-stat">
          <div className="admin-mini-stat-icon green">
            <i className="fa-solid fa-circle-check"></i>
          </div>
          <div className="admin-mini-stat-body">
            <div className="admin-mini-stat-label">Available</div>
            <div className="admin-mini-stat-value">{roomCounts.available}</div>
          </div>
        </div>
        <div className="admin-mini-stat">
          <div className="admin-mini-stat-icon orange">
            <i className="fa-solid fa-user-lock"></i>
          </div>
          <div className="admin-mini-stat-body">
            <div className="admin-mini-stat-label">Occupied</div>
            <div className="admin-mini-stat-value">{roomCounts.occupied}</div>
          </div>
        </div>
        <div className="admin-mini-stat">
          <div className="admin-mini-stat-icon purple">
            <i className="fa-solid fa-calendar-check"></i>
          </div>
          <div className="admin-mini-stat-body">
            <div className="admin-mini-stat-label">Today's Check-ins</div>
            <div className="admin-mini-stat-value">{todayCheckins}</div>
          </div>
        </div>
      </div>

      {err && <p className="admin-error">{err}</p>}
      {msg && <p className="admin-success">{msg}</p>}

      {/* Front Desk NFC */}
      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <div className="admin-panel-header">
          <h3 className="admin-panel-title">
            <i className="fa-solid fa-bell-concierge"></i> Front Desk
          </h3>
          <button className="app-btn app-btn-primary" onClick={tapCheckIn}>
            <i className="fa-solid fa-wifi"></i> Tap NFC to Check-In
          </button>
        </div>
        <div className="admin-info-banner">
          <i className="fa-solid fa-circle-info"></i>
          <div>
            Tap the guest's NFC tag to verify check-in. Make sure the tag matches the room's NFC reader.
          </div>
        </div>
      </div>

      {/* Two-column: bookings + rooms */}
      <div className="admin-dashboard-grid">
        {/* Recent Bookings */}
        <div className="admin-panel">
          <div className="admin-panel-header">
            <h3 className="admin-panel-title">
              <i className="fa-solid fa-calendar-check"></i> Recent Bookings
            </h3>
          </div>

          {loading && (
            <div className="admin-loading">
              <i className="fa-solid fa-spinner"></i> Loading…
            </div>
          )}

          {!loading && bookings.length === 0 && (
            <div className="admin-empty">
              <i className="fa-solid fa-calendar-xmark"></i>
              <div className="admin-empty-title">No bookings yet</div>
              <div className="admin-empty-desc">
                Bookings from guests will appear here.
              </div>
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
                {bookings.slice(0, 8).map((b) => (
                  <tr key={b.id}>
                    <td>
                      <div className="cell-main">{b.profiles?.full_name || 'Guest'}</div>
                      <div className="cell-sub">{b.profiles?.email || ''}</div>
                    </td>
                    <td>
                      <div className="cell-main">Room {b.rooms?.room_number}</div>
                      <div className="cell-sub">{b.rooms?.room_type}</div>
                    </td>
                    <td>
                      <div className="cell-main" style={{ fontSize: 12 }}>
                        <i className="fa-solid fa-calendar" style={{ marginRight: 6 }}></i>
                        {b.check_in}
                      </div>
                      <div className="cell-sub">
                        <i className="fa-solid fa-arrow-right" style={{ marginRight: 6 }}></i>
                        {b.check_out}
                      </div>
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

        {/* All Rooms */}
        <div className="admin-panel">
          <div className="admin-panel-header">
            <h3 className="admin-panel-title">
              <i className="fa-solid fa-bed"></i> Room Status
            </h3>
          </div>

          {loading && (
            <div className="admin-loading">
              <i className="fa-solid fa-spinner"></i> Loading…
            </div>
          )}

          {!loading && rooms.length === 0 && (
            <div className="admin-empty">
              <i className="fa-solid fa-bed"></i>
              <div className="admin-empty-title">No rooms yet</div>
              <div className="admin-empty-desc">
                Wait for admin to add rooms.
              </div>
            </div>
          )}

          {!loading && rooms.length > 0 && (
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              {rooms.map((r) => (
                <div
                  key={r.id}
                  className="space-between"
                  style={{
                    padding: '12px 0',
                    borderBottom: '1px solid #f0f4f8'
                  }}
                >
                  <div>
                    <div className="cell-main">Room {r.room_number}</div>
                    <div className="cell-sub">
                      {r.room_type} · ₱{Number(r.price).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className={`admin-pill ${r.status}`}>
                      {r.status}
                    </span>
                    <button
                      className="app-btn app-btn-secondary app-btn-sm"
                      onClick={() => updateRoomStatus(
                        r.id,
                        r.status === 'available' ? 'maintenance' : 'available'
                      )}
                    >
                      {r.status === 'available' ? '→ Maint' : '→ Available'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </StaffLayout>
  );
}