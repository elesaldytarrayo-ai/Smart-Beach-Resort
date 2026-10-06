/* ============================================================
   src/app/AdminRooms.jsx
   Admin — gumagawa ng rooms dito (walang seed sa SQL).
   ============================================================ */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../supabase.js';

export default function AdminRooms() {
  const [rooms, setRooms] = useState([]);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({
    room_number: '',
    room_type: 'Standard',
    price: '',
    nfc_reader_id: ''
  });
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('room_number', { ascending: true });

      if (error) throw error;
      setRooms(data || []);
    } catch (e) {
      console.error('LOAD ROOMS ERROR:', e);
      setErr('Cannot load rooms: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function addRoom(e) {
    e.preventDefault();
    setErr(''); setMsg('');

    if (!form.room_number || !form.price) {
      return setErr('Kailangan ng room number at price.');
    }

    const { error } = await supabase.from('rooms').insert({
      room_number: form.room_number.trim(),
      room_type: form.room_type,
      price: Number(form.price),
      nfc_reader_id: form.nfc_reader_id || null,
      status: 'available'
    });

    if (error) {
      console.error('ADD ROOM ERROR:', error);
      return setErr(error.message);
    }

    setMsg(`✅ Room ${form.room_number} added.`);
    setForm({ room_number: '', room_type: 'Standard', price: '', nfc_reader_id: '' });
    refresh();
  }

  async function cycleStatus(room) {
    const next = {
      available: 'occupied',
      occupied: 'maintenance',
      maintenance: 'available'
    }[room.status] || 'available';

    await supabase.from('rooms').update({ status: next }).eq('id', room.id);
    refresh();
  }

  async function deleteRoom(id, number) {
    if (!confirm(`Delete Room ${number}?`)) return;
    const { error } = await supabase.from('rooms').delete().eq('id', id);
    if (error) return setErr(error.message);
    setMsg(`🗑️ Room ${number} deleted.`);
    refresh();
  }

  const filtered = filter === 'all'
    ? rooms
    : rooms.filter((r) => r.status === filter);

  const counts = {
    all: rooms.length,
    available: rooms.filter((r) => r.status === 'available').length,
    occupied: rooms.filter((r) => r.status === 'occupied').length,
    maintenance: rooms.filter((r) => r.status === 'maintenance').length
  };

  return (
    <>
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
        </div>
      </nav>

      <div className="page-pad">
        <h1>Room Management</h1>

        <div className="feature-grid" style={{ marginBottom: 24 }}>
          <MiniStat icon="🛏️" label="Total"        value={counts.all} />
          <MiniStat icon="✅" label="Available"    value={counts.available} />
          <MiniStat icon="🚫" label="Occupied"     value={counts.occupied} />
          <MiniStat icon="🔧" label="Maintenance"  value={counts.maintenance} />
        </div>

        {/* Add Room Form */}
        <div className="neu-card">
          <h2>Add Room</h2>
          <p className="muted" style={{ marginBottom: 16 }}>
            Dito ka lang gagawa ng rooms — walang seed sa SQL.
          </p>

          <form onSubmit={addRoom} className="row">
            <div className="col">
              <input
                className="neu-input"
                placeholder="Room number (e.g. 101)"
                value={form.room_number}
                onChange={(e) => setForm({ ...form, room_number: e.target.value })}
                required
              />
            </div>
            <div className="col">
              <select
                className="neu-select"
                value={form.room_type}
                onChange={(e) => setForm({ ...form, room_type: e.target.value })}
              >
                <option>Standard</option>
                <option>Deluxe</option>
                <option>Suite</option>
                <option>Beachfront</option>
              </select>
            </div>
            <div className="col">
              <input
                className="neu-input"
                type="number"
                placeholder="Price per night"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
              />
            </div>
            <div className="col">
              <input
                className="neu-input"
                placeholder="NFC reader ID (optional)"
                value={form.nfc_reader_id}
                onChange={(e) => setForm({ ...form, nfc_reader_id: e.target.value })}
              />
            </div>
            <div className="col" style={{ flex: '0 0 120px' }}>
              <button className="neu-button primary" style={{ width: '100%' }}>
                Add Room
              </button>
            </div>
          </form>

          {err && <p className="error-text">⚠️ {err}</p>}
          {msg && <p className="success-text">{msg}</p>}
        </div>

        {/* Room list */}
        <div className="neu-card" style={{ marginTop: 20 }}>
          <div className="space-between" style={{ marginBottom: 16 }}>
            <h2>All Rooms ({counts.all})</h2>
            <select
              className="neu-select"
              style={{ maxWidth: 200, marginBottom: 0 }}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All ({counts.all})</option>
              <option value="available">Available ({counts.available})</option>
              <option value="occupied">Occupied ({counts.occupied})</option>
              <option value="maintenance">Maintenance ({counts.maintenance})</option>
            </select>
          </div>

          {loading && <p className="muted center">Loading…</p>}

          {!loading && rooms.length === 0 && (
            <p className="muted center">
              Wala pang rooms. Gumawa ng room sa form sa itaas.
            </p>
          )}

          {!loading && rooms.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Type</th>
                  <th>Price</th>
                  <th>NFC Reader</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.room_number}</strong></td>
                    <td>{r.room_type}</td>
                    <td>₱{Number(r.price).toLocaleString()}</td>
                    <td className="muted">{r.nfc_reader_id || '—'}</td>
                    <td><span className={`pill ${r.status}`}>{r.status}</span></td>
                    <td>
                      <button className="neu-button" onClick={() => cycleStatus(r)}>
                        Next Status
                      </button>{' '}
                      <button
                        className="neu-button danger"
                        onClick={() => deleteRoom(r.id, r.room_number)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

function MiniStat({ icon, label, value }) {
  return (
    <div className="feature-card" style={{ padding: '16px 14px' }}>
      <span className="feature-icon" style={{ fontSize: 26 }}>{icon}</span>
      <p className="muted" style={{ fontSize: 12 }}>{label}</p>
      <h2 style={{ color: 'var(--accent)' }}>{value}</h2>
    </div>
  );
}