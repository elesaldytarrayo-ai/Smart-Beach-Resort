/* ============================================================
   src/app/admin/AdminRooms.jsx
   Room Management — lahat ng icons Font Awesome.
   ============================================================ */

import { useEffect, useState } from 'react';
import { supabase } from '../../supabase.js';
import AdminLayout from './AdminLayout.jsx';

export default function AdminRooms() {
  const [rooms, setRooms] = useState([]);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({
    room_number: '', room_type: 'Standard', price: '', nfc_reader_id: ''
  });
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const { data, error } = await supabase
        .from('rooms').select('*').order('room_number', { ascending: true });
      if (error) throw error;
      setRooms(data || []);
    } catch (e) {
      setErr('Cannot load rooms: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function addRoom(e) {
    e.preventDefault();
    setErr(''); setMsg('');
    if (!form.room_number || !form.price) return setErr('Kailangan ng room number at price.');

    const { error } = await supabase.from('rooms').insert({
      room_number: form.room_number.trim(),
      room_type: form.room_type,
      price: Number(form.price),
      nfc_reader_id: form.nfc_reader_id || null,
      status: 'available'
    });

    if (error) return setErr(error.message);
    setMsg(`Room ${form.room_number} added.`);
    setForm({ room_number: '', room_type: 'Standard', price: '', nfc_reader_id: '' });
    refresh();
  }

  async function cycleStatus(room) {
    const next = { available: 'occupied', occupied: 'maintenance', maintenance: 'available' }[room.status] || 'available';
    await supabase.from('rooms').update({ status: next }).eq('id', room.id);
    refresh();
  }

  async function deleteRoom(id, number) {
    if (!confirm(`Delete Room ${number}?`)) return;
    await supabase.from('rooms').delete().eq('id', id);
    setMsg(`Room ${number} deleted.`);
    refresh();
  }

  const filtered = filter === 'all' ? rooms : rooms.filter((r) => r.status === filter);
  const counts = {
    all: rooms.length,
    available: rooms.filter((r) => r.status === 'available').length,
    occupied: rooms.filter((r) => r.status === 'occupied').length,
    maintenance: rooms.filter((r) => r.status === 'maintenance').length
  };

  return (
    <AdminLayout>
      <div className="admin-welcome">
        <h1>Room Management</h1>
        <p>Add, update, at i-manage ang lahat ng rooms ng resort.</p>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat-card blue">
          <div className="admin-stat-top">
            <span className="admin-stat-label">Total Rooms</span>
            <span className="admin-stat-icon"><i className="fa-solid fa-bed"></i></span>
          </div>
          <div>
            <div className="admin-stat-value">{counts.all}</div>
            <div className="admin-stat-sub">All rooms</div>
          </div>
        </div>
        <div className="admin-stat-card green">
          <div className="admin-stat-top">
            <span className="admin-stat-label">Available</span>
            <span className="admin-stat-icon"><i className="fa-solid fa-circle-check"></i></span>
          </div>
          <div>
            <div className="admin-stat-value">{counts.available}</div>
            <div className="admin-stat-sub">Ready to book</div>
          </div>
        </div>
        <div className="admin-stat-card orange">
          <div className="admin-stat-top">
            <span className="admin-stat-label">Occupied</span>
            <span className="admin-stat-icon"><i className="fa-solid fa-user-lock"></i></span>
          </div>
          <div>
            <div className="admin-stat-value">{counts.occupied}</div>
            <div className="admin-stat-sub">Currently in use</div>
          </div>
        </div>
        <div className="admin-stat-card purple">
          <div className="admin-stat-top">
            <span className="admin-stat-label">Maintenance</span>
            <span className="admin-stat-icon"><i className="fa-solid fa-screwdriver-wrench"></i></span>
          </div>
          <div>
            <div className="admin-stat-value">{counts.maintenance}</div>
            <div className="admin-stat-sub">Under repair</div>
          </div>
        </div>
      </div>

      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <div className="admin-panel-header">
          <h3 className="admin-panel-title">
            <i className="fa-solid fa-plus"></i> Add New Room
          </h3>
        </div>

        <form onSubmit={addRoom} className="row">
          <div className="col">
            <label className="admin-label">Room Number</label>
            <input className="admin-input" placeholder="e.g. 101"
              value={form.room_number}
              onChange={(e) => setForm({ ...form, room_number: e.target.value })} required />
          </div>
          <div className="col">
            <label className="admin-label">Room Type</label>
            <select className="admin-select" value={form.room_type}
              onChange={(e) => setForm({ ...form, room_type: e.target.value })}>
              <option>Standard</option>
              <option>Deluxe</option>
              <option>Suite</option>
              <option>Beachfront</option>
            </select>
          </div>
          <div className="col">
            <label className="admin-label">Price per Night</label>
            <input className="admin-input" type="number" placeholder="1500"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })} required />
          </div>
          <div className="col">
            <label className="admin-label">NFC Reader ID</label>
            <input className="admin-input" placeholder="Optional"
              value={form.nfc_reader_id}
              onChange={(e) => setForm({ ...form, nfc_reader_id: e.target.value })} />
          </div>
          <div className="col" style={{ flex: '0 0 140px' }}>
            <label className="admin-label" style={{ visibility: 'hidden' }}>Add</label>
            <button className="app-btn app-btn-primary" style={{ width: '100%' }}>
              <i className="fa-solid fa-plus"></i> Add Room
            </button>
          </div>
        </form>

        {err && <p className="admin-error">{err}</p>}
        {msg && <p className="admin-success">{msg}</p>}
      </div>

      <div className="admin-panel">
        <div className="admin-panel-header">
          <h3 className="admin-panel-title">
            <i className="fa-solid fa-bed"></i> All Rooms ({counts.all})
          </h3>
          <select className="admin-select" style={{ maxWidth: 180, marginBottom: 0 }}
            value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All ({counts.all})</option>
            <option value="available">Available ({counts.available})</option>
            <option value="occupied">Occupied ({counts.occupied})</option>
            <option value="maintenance">Maintenance ({counts.maintenance})</option>
          </select>
        </div>

        {loading && <p className="muted center">Loading…</p>}
        {!loading && rooms.length === 0 && <p className="muted center">Wala pang rooms.</p>}

        {!loading && rooms.length > 0 && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Room #</th><th>Type</th><th>Price</th>
                <th>NFC Reader</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.room_number}</strong></td>
                  <td>{r.room_type}</td>
                  <td>₱{Number(r.price).toLocaleString()}</td>
                  <td className="muted">{r.nfc_reader_id || '—'}</td>
                  <td>
                    <span className={`admin-pill ${r.status}`}>{r.status}</span>
                  </td>
                  <td>
                    <button className="app-btn app-btn-secondary"
                      onClick={() => cycleStatus(r)}
                      style={{ padding: '6px 10px', fontSize: 12 }}>
                      <i className="fa-solid fa-rotate"></i> Next
                    </button>{' '}
                    <button className="app-btn app-btn-danger"
                      onClick={() => deleteRoom(r.id, r.room_number)}
                      style={{ padding: '6px 10px', fontSize: 12 }}>
                      <i className="fa-solid fa-trash"></i> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}